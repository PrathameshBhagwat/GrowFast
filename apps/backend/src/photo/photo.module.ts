import { Module } from '@nestjs/common';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';
import { PhotoStorageService } from './photo-storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { R2StorageProvider } from './providers/r2-storage.provider';

/**
 * PhotoModule — NestJS feature module for photo infrastructure.
 *
 * Provides:
 * - PhotoController (HTTP endpoints)
 * - PhotoService (business logic)
 * - PhotoStorageService (abstract storage, bound to R2StorageProvider or LocalStorageProvider)
 *
 * The storage provider is selected via a factory pattern reading
 * the PHOTO_STORAGE_PROVIDER environment variable.
 */
@Module({
  controllers: [PhotoController],
  providers: [
    PhotoService,
    {
      provide: PhotoStorageService,
      useFactory: () => {
        const provider = (process.env.PHOTO_STORAGE_PROVIDER || 'local').toLowerCase();
        if (provider === 'r2' || provider === 's3') {
          return new R2StorageProvider();
        }
        return new LocalStorageProvider();
      },
    },
  ],
  exports: [PhotoService, PhotoStorageService],
})
export class PhotoModule {}
