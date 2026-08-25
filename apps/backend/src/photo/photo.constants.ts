/**
 * Photo module configuration constants.
 *
 * Centralizes all magic numbers and configuration for the photo domain.
 * Values can be overridden via environment variables where noted.
 */

/** Maximum file size in bytes. Default 10MB. Override via PHOTO_MAX_FILE_SIZE env var. */
export const PHOTO_MAX_FILE_SIZE = parseInt(process.env.PHOTO_MAX_FILE_SIZE || '10485760', 10);

/** Allowed MIME types for photo uploads. */
export const PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** Allowed file extensions for photo uploads. */
export const PHOTO_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
] as const;

/** Default upload directory for local storage provider. Override via PHOTO_UPLOAD_DIR env var. */
export const PHOTO_UPLOAD_DIR = process.env.PHOTO_UPLOAD_DIR || 'uploads/photos';

/** Storage provider selection. Override via PHOTO_STORAGE_PROVIDER env var. */
export const PHOTO_STORAGE_PROVIDER = process.env.PHOTO_STORAGE_PROVIDER || 'local';
