import { Module } from '@nestjs/common';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';
import { PhotoStorageService } from './photo-storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';

/**
 * PhotoModule — NestJS feature module for photo infrastructure.
 *
 * Provides:
 * - PhotoController (HTTP endpoints)
 * - PhotoService (business logic)
 * - PhotoStorageService (abstract storage, bound to LocalStorageProvider for dev)
 *
 * The storage provider is selected via a factory pattern.
 * To add S3/GCS support, create a new provider extending PhotoStorageService
 * and update the factory to read PHOTO_STORAGE_PROVIDER env var.
 *
 * PrismaService is available globally via PrismaModule (@Global).
 */
@Module({
  controllers: [PhotoController],
  providers: [
    PhotoService,
    {
      provide: PhotoStorageService,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [PhotoService],
})
export class PhotoModule {}
