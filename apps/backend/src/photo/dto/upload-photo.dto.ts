import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PhotoType } from '@growfast/shared-types';

/**
 * DTO for photo upload — validates the non-file multipart fields.
 *
 * The file itself is validated separately via FileInterceptor and
 * manual MIME/size checks in the service layer.
 */
export class UploadPhotoDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsString()
  orderItemId?: string;

  @IsEnum(PhotoType, {
    message: `type must be one of: ${Object.values(PhotoType).join(', ')}`,
  })
  type!: PhotoType;
}
