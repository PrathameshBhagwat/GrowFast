import { R2StorageProvider } from './r2-storage.provider';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('R2StorageProvider', () => {
  let mockSend: jest.Mock;
  const mockOptions = {
    accountId: 'test-account-id',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    bucketName: 'test-bucket',
    endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
    region: 'auto',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn().mockResolvedValue({});
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://test-bucket.r2.cloudflarestorage.com/stores/store-1/photo.jpg?X-Amz-Signature=mock',
    );
  });

  describe('Initialization', () => {
    it('initializes S3Client with valid R2 configuration', () => {
      const provider = new R2StorageProvider(mockOptions);
      expect(provider).toBeDefined();
      expect(S3Client).toHaveBeenCalledWith({
        region: 'auto',
        endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    });

    it('falls back to environment variables when options not provided', () => {
      const oldEnv = process.env;
      process.env = {
        ...oldEnv,
        R2_ACCOUNT_ID: 'env-account',
        R2_ACCESS_KEY_ID: 'env-key',
        R2_SECRET_ACCESS_KEY: 'env-secret',
        R2_BUCKET_NAME: 'env-bucket',
        R2_ENDPOINT: 'https://env-account.r2.cloudflarestorage.com',
        R2_REGION: 'auto',
      };

      try {
        const provider = new R2StorageProvider();
        expect(provider).toBeDefined();
        expect(S3Client).toHaveBeenCalledWith({
          region: 'auto',
          endpoint: 'https://env-account.r2.cloudflarestorage.com',
          credentials: {
            accessKeyId: 'env-key',
            secretAccessKey: 'env-secret',
          },
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        });
      } finally {
        process.env = oldEnv;
      }
    });

    it('throws clear error when required R2 configuration is missing', () => {
      expect(() => {
        new R2StorageProvider({
          accessKeyId: '',
          secretAccessKey: '',
          endpoint: '',
        });
      }).toThrow('Cloudflare R2 configuration missing required environment variables');
    });

    it('does not log or leak secret access key on missing configuration', () => {
      let thrownMessage = '';
      try {
        new R2StorageProvider({
          accessKeyId: 'some-key',
          secretAccessKey: '',
          endpoint: 'https://r2.test',
        });
      } catch (err: any) {
        thrownMessage = err.message;
      }

      expect(thrownMessage).toContain('R2_SECRET_ACCESS_KEY');
      expect(thrownMessage).not.toContain('some-key');
    });
  });

  describe('store()', () => {
    it('sends PutObjectCommand with correct bucket, key, buffer body, and Content-Type', async () => {
      const provider = new R2StorageProvider(mockOptions);
      const testBuffer = Buffer.from('test-image-binary');
      const testKey = 'stores/store-1/orders/order-1/garments/garment-1/front_uuid.jpg';
      const testMime = 'image/jpeg';

      const returnedKey = await provider.store(testKey, testBuffer, testMime);

      expect(returnedKey).toBe(testKey);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandCall = (PutObjectCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(commandCall).toEqual({
        Bucket: 'test-bucket',
        Key: testKey,
        Body: testBuffer,
        ContentType: testMime,
      });
    });

    it('rethrows error if PutObjectCommand fails', async () => {
      mockSend.mockRejectedValue(new Error('S3 Network Timeout'));
      const provider = new R2StorageProvider(mockOptions);

      await expect(provider.store('key', Buffer.from('data'), 'image/png')).rejects.toThrow(
        'S3 Network Timeout',
      );
    });
  });

  describe('getAccessUrl()', () => {
    it('returns presigned GET URL with 3600s expiration for stored object key', async () => {
      const provider = new R2StorageProvider(mockOptions);
      const testKey = 'stores/store-1/orders/order-1/garments/garment-1/front_uuid.jpg';

      const signedUrl = await provider.getAccessUrl(testKey);

      expect(signedUrl).toContain('https://test-bucket.r2.cloudflarestorage.com');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: testKey,
      });
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 3600,
      });
    });

    it('passes through full URLs (http/https) without presigning', async () => {
      const provider = new R2StorageProvider(mockOptions);
      const fullUrl = 'https://example.com/test-photo.jpg';

      const result = await provider.getAccessUrl(fullUrl);

      expect(result).toBe(fullUrl);
      expect(GetObjectCommand).not.toHaveBeenCalled();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('passes through local mock paths without presigning', async () => {
      const provider = new R2StorageProvider(mockOptions);
      const localPath = '/api/photos/local/uploads/photos/test.jpg?sig=abc';

      const result = await provider.getAccessUrl(localPath);

      expect(result).toBe(localPath);
      expect(GetObjectCommand).not.toHaveBeenCalled();
    });

    it('returns empty string for empty input', async () => {
      const provider = new R2StorageProvider(mockOptions);
      expect(await provider.getAccessUrl('')).toBe('');
      expect(getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('targets correct bucket and key with DeleteObjectCommand', async () => {
      const provider = new R2StorageProvider(mockOptions);
      const testKey = 'stores/store-1/orders/order-1/photo.jpg';

      await provider.delete(testKey);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: testKey,
      });
    });

    it('extracts object key if given full URL', async () => {
      const provider = new R2StorageProvider(mockOptions);
      const fullUrl =
        'https://growfast-photos-dev.r2.cloudflarestorage.com/stores/store-1/photo.jpg';

      await provider.delete(fullUrl);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'stores/store-1/photo.jpg',
      });
    });

    it('catches and logs warning on delete failure without rethrowing (best effort)', async () => {
      mockSend.mockRejectedValue(new Error('Access Denied'));
      const provider = new R2StorageProvider(mockOptions);

      await expect(provider.delete('some-key')).resolves.not.toThrow();
    });

    it('handles empty key gracefully', async () => {
      const provider = new R2StorageProvider(mockOptions);
      await expect(provider.delete('')).resolves.not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
