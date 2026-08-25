import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PhotoStorageService } from '../photo-storage.service';
import { PHOTO_UPLOAD_DIR } from '../photo.constants';

/**
 * LocalStorageProvider — development-safe local filesystem storage.
 *
 * Stores photos under the configured PHOTO_UPLOAD_DIR directory
 * (default: uploads/photos) relative to the project root.
 *
 * This provider does NOT require any cloud credentials or external services.
 * It is intended for local development and testing only.
 *
 * For production, replace with an S3StorageProvider or GCSStorageProvider
 * by changing the PHOTO_STORAGE_PROVIDER environment variable.
 */
@Injectable()
export class LocalStorageProvider extends PhotoStorageService implements OnModuleInit {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;

  constructor() {
    super();
    // Resolve relative to process.cwd() (project root when started via nest start)
    this.uploadDir = path.resolve(process.cwd(), PHOTO_UPLOAD_DIR);
  }

  /**
   * Ensure the upload directory exists on module initialization.
   */
  async onModuleInit(): Promise<void> {
    try {
      await fs.promises.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Photo upload directory ready: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(
        `Failed to create upload directory: ${this.uploadDir}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Store a photo to the local filesystem.
   *
   * @param key - The secure object key (used as filename)
   * @param buffer - The raw image data
   * @param _mimeType - The validated MIME type (unused for local FS, kept for interface)
   * @returns The relative storage path to persist in the database
   */
  async store(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = path.join(this.uploadDir, key);

    // Ensure subdirectory exists (key may contain path separators)
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    await fs.promises.writeFile(filePath, buffer);

    // Return the relative path from the upload root for database storage
    return `${PHOTO_UPLOAD_DIR}/${key}`;
  }

  /**
   * For local development, generates a signed URL to a secure local endpoint.
   * This simulates the architecture of S3 presigned URLs without exposing
   * the local storage directory statically.
   */
  async getAccessUrl(storedUrl: string): Promise<string> {
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const signature = crypto.createHmac('sha256', secret).update(storedUrl).digest('hex');
    // We use the Vite proxy path pattern: /api/photos/local/...
    return `/api/photos/local/${storedUrl}?sig=${signature}`;
  }

  /**
   * Delete a stored photo from the local filesystem.
   * Best-effort: logs errors but does not throw if the file is already missing.
   */
  async delete(storedUrl: string): Promise<void> {
    try {
      const filePath = path.resolve(process.cwd(), storedUrl);
      await fs.promises.unlink(filePath);
    } catch (error) {
      // File may already be missing — log but do not throw
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(
          `Failed to delete stored photo: ${storedUrl}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
