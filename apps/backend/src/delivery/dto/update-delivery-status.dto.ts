import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { DeliveryStatus } from '@growfast/shared-types';

export class UpdateDeliveryStatusDto {
  @IsEnum(DeliveryStatus)
  @IsNotEmpty()
  status!: DeliveryStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
