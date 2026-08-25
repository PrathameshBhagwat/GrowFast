import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { GarmentCategory } from '@prisma/client';

/**
 * DTO for PATCH /api/garments/:id.
 * All fields are optional — only provided fields are updated.
 */
export class UpdateGarmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(GarmentCategory, {
    message: `category must be one of: ${Object.values(GarmentCategory).join(', ')}`,
  })
  category?: GarmentCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
