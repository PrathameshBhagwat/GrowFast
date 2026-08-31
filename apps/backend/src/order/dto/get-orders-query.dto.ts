import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@growfast/shared-types';

export class GetOrdersQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status must be a valid OrderStatus' })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'paymentStatus must be a valid PaymentStatus' })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
