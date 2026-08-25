/**
 * PhotoStorageService — provider-independent storage abstraction.
 *
 * The application layer depends on this abstract class rather than
 * directly depending on S3/GCS/local filesystem implementations.
 *
 * Concrete providers (LocalStorageProvider, S3StorageProvider, etc.)
 * extend this class and are injected via the PhotoModule factory.
 */
export abstract class PhotoStorageService {
  /**
   * Store a photo in the configured storage backend.
   *
   * @param key - The generated object key (path/filename without provider prefix)
   * @param buffer - The raw file data
   * @param mimeType - The validated MIME type of the file
   * @returns The storage reference to persist in the database (e.g., relative path or full URL)
   */
  abstract store(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Produce a controlled-access URL for a stored photo.
   *
   * For local dev: returns the relative path as-is.
   * For S3/GCS: returns a presigned URL with time-limited access.
   *
   * @param storedUrl - The storage reference from the database
   * @returns A URL the client can use to display the photo
   */
  abstract getAccessUrl(storedUrl: string): Promise<string>;

  /**
   * Delete a stored photo. Used for cleanup when database persistence
   * fails after a successful storage write.
   *
   * Implementations should be best-effort — log errors but do not throw
   * if the file is already missing.
   *
   * @param storedUrl - The storage reference to delete
   */
  abstract delete(storedUrl: string): Promise<void>;
}
