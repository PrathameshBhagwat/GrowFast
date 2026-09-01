import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateStoreConfigDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  expressSurchargePercent?: number | null;
}
