import { IsOptional, IsEnum } from 'class-validator';
import { GarmentCategory } from '@prisma/client';

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
