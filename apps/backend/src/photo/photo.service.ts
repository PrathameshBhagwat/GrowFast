import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoStorageService } from './photo-storage.service';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import {
  PHOTO_MAX_FILE_SIZE,
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_ALLOWED_EXTENSIONS,
} from './photo.constants';
import type { OrderPhotoDTO } from '@growfast/shared-types';

/**
 * PhotoService — core business logic for photo upload and retrieval.
 *
 * Responsibilities:
 * - Validate upload requests (order existence, item ownership, file type/size)
 * - Generate secure, unpredictable object keys
 * - Delegate storage to PhotoStorageService abstraction
 * - Persist OrderPhoto metadata in PostgreSQL via Prisma
 * - Handle failure consistency (storage ↔ database)
 * - Retrieve and map photos to OrderPhotoDTO
 */
@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorageService,
  ) {}

  /**
   * Upload a photo: validate → generate key → store → persist metadata.
   *
   * Failure consistency:
   * - Validation fails → nothing stored, nothing persisted
   * - Storage fails → no metadata created
   * - Storage succeeds, DB fails → attempt storage cleanup, throw error
   */
  async uploadPhoto(
    dto: UploadPhotoDto,
    file: Express.Multer.File,
    storeId: string,
  ): Promise<OrderPhotoDTO> {
    // ── 1. Validate file ──────────────────────────────────────────
    this.validateFile(file);

    // ── 2. Validate order exists and belongs to the user's store ─
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, storeId: true },
    });

    if (!order || order.storeId !== storeId) {
      throw new NotFoundException('Order not found');
    }

    // ── 3. Validate order item (if provided) ──────────────────────
    if (dto.orderItemId) {
      const orderItem = await this.prisma.orderItem.findUnique({
        where: { id: dto.orderItemId },
        select: { id: true, orderId: true },
      });

      if (!orderItem) {
        throw new NotFoundException('Order item not found');
      }

      if (orderItem.orderId !== dto.orderId) {
        throw new BadRequestException('Order item does not belong to the specified order');
      }
    }

    // ── 4. Generate secure object key ─────────────────────────────
    const extension = this.extractExtension(file.originalname, file.mimetype);
    const objectKey = this.generateObjectKey(dto.orderId, dto.type, extension);

    // ── 5. Store file ─────────────────────────────────────────────
    let storedUrl: string;
    try {
      storedUrl = await this.storage.store(objectKey, file.buffer, file.mimetype);
    } catch (error) {
      this.logger.error('Photo storage failed', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to store photo');
    }

    // ── 6. Persist metadata ───────────────────────────────────────
    try {
      const photo = await this.prisma.orderPhoto.create({
        data: {
          orderId: dto.orderId,
          orderItemId: dto.orderItemId || null,
          type: dto.type,
          url: storedUrl,
        },
      });

      return this.mapToDto(photo);
    } catch (error) {
      // Storage succeeded but DB failed — attempt cleanup
      this.logger.error(
        'Photo metadata persistence failed, attempting storage cleanup',
        error instanceof Error ? error.stack : undefined,
      );

      try {
        await this.storage.delete(storedUrl);
        this.logger.log(`Cleaned up orphaned storage object: ${objectKey}`);
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to clean up orphaned storage object: ${objectKey}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }

      throw new BadRequestException('Failed to save photo metadata');
    }
  }

  /**
   * Retrieve all photos for a given order.
   */
  async getOrderPhotos(orderId: string, storeId: string): Promise<OrderPhotoDTO[]> {
    // Verify order exists and belongs to the user's store
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, storeId: true },
    });

    if (!order || order.storeId !== storeId) {
      throw new NotFoundException('Order not found');
    }

    const photos = await this.prisma.orderPhoto.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Map to DTOs with access URLs
    const dtos: OrderPhotoDTO[] = [];
    for (const photo of photos) {
      const dto = this.mapToDto(photo);
      dto.url = await this.storage.getAccessUrl(photo.url);
      dtos.push(dto);
    }

    return dtos;
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * Validate file MIME type, extension, and size.
   * Does NOT trust only the client-provided MIME type —
   * also checks the file extension.
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    // Validate size
    if (file.size > PHOTO_MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${PHOTO_MAX_FILE_SIZE} bytes`,
      );
    }

    // Validate MIME type
    const mimeTypes: readonly string[] = PHOTO_ALLOWED_MIME_TYPES;
    if (!mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed types: ${PHOTO_ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validate extension
    const ext = path.extname(file.originalname).toLowerCase();
    const extensions: readonly string[] = PHOTO_ALLOWED_EXTENSIONS;
    if (ext && !extensions.includes(ext)) {
      throw new BadRequestException(
        `Unsupported file extension: ${ext}. Allowed extensions: ${PHOTO_ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }
  }

  /**
   * Generate a secure, unpredictable object key.
   *
   * Format: <orderId-prefix>/<uuid>.<ext>
   *
   * The orderId prefix (first 8 chars) aids debugging/grouping
   * without exposing the full ID. The UUID portion ensures
   * unpredictability.
   */
  private generateObjectKey(orderId: string, type: string, extension: string): string {
    const uniqueId = crypto.randomUUID();
    const orderPrefix = orderId.substring(0, 8);
    return `${orderPrefix}/${type.toLowerCase()}_${uniqueId}${extension}`;
  }

  /**
   * Extract file extension from original filename or derive from MIME type.
   */
  private extractExtension(originalname: string, mimeType: string): string {
    const ext = path.extname(originalname).toLowerCase();
    if (ext) return ext;

    // Fallback: derive from MIME type
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
    };
    return mimeToExt[mimeType] || '.jpg';
  }

  /**
   * Map a Prisma OrderPhoto record to the shared OrderPhotoDTO.
   */
  private mapToDto(photo: {
    id: string;
    orderId: string;
    orderItemId: string | null;
    type: string;
    url: string;
    uploadedAt: Date;
  }): OrderPhotoDTO {
    return {
      id: photo.id,
      orderItemId: photo.orderItemId || '',
      type: photo.type as any,
      url: photo.url,
      uploadedAt: photo.uploadedAt.toISOString(),
    };
  }
}
