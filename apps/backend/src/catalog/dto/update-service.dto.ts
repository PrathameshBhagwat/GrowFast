import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ServiceCategory } from '@growfast/shared-types';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
