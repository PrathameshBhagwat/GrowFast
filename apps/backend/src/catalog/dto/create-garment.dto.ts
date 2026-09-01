import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { GarmentCategory } from '@growfast/shared-types';

/**
 * DTO for POST /api/garments.
 */
export class CreateGarmentDto {
  @IsString()
  name!: string;

  @IsEnum(GarmentCategory, {
    message: `category must be one of: ${Object.values(GarmentCategory).join(', ')}`,
  })
  category!: GarmentCategory;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
