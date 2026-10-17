import { IsNumber, IsOptional, Min, Max, IsArray } from 'class-validator';
import { TopUpServiceItem } from '@growfast/shared-types';

export class UpdateStoreConfigDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  expressSurchargePercent?: number | null;

  @IsOptional()
  @IsArray()
  topUpServices?: TopUpServiceItem[];
}
