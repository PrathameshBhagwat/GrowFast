import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PhotoStorageService } from '../photo-storage.service';

export interface R2StorageProviderOptions {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
  region?: string;
}

/**
 * R2StorageProvider — Cloudflare R2 S3-compatible private object storage.
 *
 * Implements PhotoStorageService:
 * - Stores files in a private Cloudflare R2 bucket
 * - Persists stable, tenant-safe object keys in PostgreSQL
 * - Resolves short-lived presigned GET URLs (1-hour expiry) on demand
 * - Handles best-effort deletion cleanup
 *
 * Security:
 * - Bucket remains strictly private (public access is disabled)
 * - R2 credentials remain strictly server-side
 * - No credentials or secrets are logged
 */
@Injectable()
export class R2StorageProvider extends PhotoStorageService {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(options?: R2StorageProviderOptions) {
    super();

    const accountId = options?.accountId || process.env.R2_ACCOUNT_ID;
    const accessKeyId = options?.accessKeyId || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = options?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
    const bucket = options?.bucketName || process.env.R2_BUCKET_NAME || 'growfast-photos-dev';
    const region = options?.region || process.env.R2_REGION || 'auto';
    const endpoint =
      options?.endpoint ||
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      const missing: string[] = [];
      if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
      if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
      if (!endpoint) missing.push('R2_ENDPOINT (or R2_ACCOUNT_ID)');
      throw new Error(
        `Cloudflare R2 configuration missing required environment variables: ${missing.join(', ')}`,
      );
    }

    this.bucket = bucket;
    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.logger.log(`Initialized Cloudflare R2 storage provider (bucket: ${this.bucket})`);
  }

  /**
   * Store a photo binary in the private Cloudflare R2 bucket.
   *
   * @param key - The deterministic, tenant-safe object key
   * @param buffer - The raw image data
   * @param mimeType - The validated MIME type
   * @returns The stable storage key to persist in the database
   */
  async store(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully stored photo in R2: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(
        `Failed to store photo in R2 (${key})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Generate a time-limited presigned GET URL for controlled, private access.
   *
   * @param storedUrl - The object key stored in the database
   * @returns Short-lived signed URL (valid for 1 hour)
   */
  async getAccessUrl(storedUrl: string): Promise<string> {
    if (!storedUrl) return '';

    // If storedUrl is already a complete URL (legacy or test URL), return as-is
    if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
      return storedUrl;
    }

    // If storedUrl is a local development mock path, return as-is
    if (storedUrl.startsWith('/api/photos/local')) {
      return storedUrl;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storedUrl,
      });

      // Generate a short-lived presigned GET URL (3600 seconds = 1 hour)
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL for R2 key (${storedUrl})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Delete a photo from the R2 bucket.
   * Best-effort: logs warning on failure but does not throw.
   *
   * @param storedUrl - The object key or URL to delete
   */
  async delete(storedUrl: string): Promise<void> {
    if (!storedUrl) return;

    try {
      let key = storedUrl;
      if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
        try {
          const parsed = new URL(storedUrl);
          key = parsed.pathname.replace(/^\/+/, '');
        } catch {
          // Keep key as storedUrl
        }
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Deleted photo from R2: ${key}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete photo from R2 (${storedUrl})`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
