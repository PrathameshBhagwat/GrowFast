import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateDeliveryDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
