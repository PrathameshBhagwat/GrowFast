import { IsEnum, IsOptional } from 'class-validator';
import { ServiceCategory } from '@growfast/shared-types';

export class GetServicesQueryDto {
  @IsOptional()
  @IsEnum(ServiceCategory, { message: 'category must be a valid ServiceCategory' })
  category?: ServiceCategory;
}
