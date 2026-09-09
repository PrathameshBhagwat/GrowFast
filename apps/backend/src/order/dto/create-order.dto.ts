import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CreateOrderRequest,
  CreateOrderItemRequest,
  CreateOrderPieceRequest,
  PickupType,
} from '@growfast/shared-types';

export class CreateOrderPieceDto implements CreateOrderPieceRequest {
  @IsInt()
  @Min(1)
  unitNumber!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  photoCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class CreateOrderItemDto implements CreateOrderItemRequest {
  @IsString()
  garmentCatalogId!: string;

  @IsString()
  serviceTypeId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colorTags?: string[];

  @IsOptional()
  @IsString()
  defectNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPieceDto)
  pieces?: CreateOrderPieceDto[];
}

export class CreateOrderDto implements CreateOrderRequest {
  @IsString()
  customerId!: string;

  @IsBoolean()
  isExpress!: boolean;

  @IsEnum(PickupType)
  pickupType!: PickupType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
