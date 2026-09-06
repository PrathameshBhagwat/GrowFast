import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderPickupRequest, PaymentMode } from '@growfast/shared-types';

export class LegacyPickupItemDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PickupPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class OrderPickupDto implements OrderPickupRequest {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  garmentIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegacyPickupItemDto)
  legacyItems?: LegacyPickupItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PickupPaymentDto)
  payment?: PickupPaymentDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
