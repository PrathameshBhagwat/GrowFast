import { IsNumber, Min } from 'class-validator';

/**
 * DTO for POST /api/pricing
 */
export class SetPriceDto {
  @IsNumber()
  @Min(0)
  price!: number;
}
