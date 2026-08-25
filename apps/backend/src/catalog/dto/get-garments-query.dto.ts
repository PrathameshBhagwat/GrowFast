import { IsOptional, IsEnum } from 'class-validator';
import { GarmentCategory } from '@growfast/shared-types';

/**
 * Query DTO for GET /api/garments.
 * Supports optional category filtering.
 */
export class GetGarmentsQueryDto {
  @IsOptional()
  @IsEnum(GarmentCategory, {
    message: `category must be one of: ${Object.values(GarmentCategory).join(', ')}`,
  })
  category?: GarmentCategory;
}
