import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import {
  CreateOrderRequest,
  CreateOrderItemRequest,
  CreateOrderPieceRequest,
  PickupType,
  OrderWorkflowType,
  OrderEntryMode,
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
  @IsNumber()
  @Min(2.0, { message: 'Minimum permitted weight is 2.00 kg.' })
  weight?: number;

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

  @IsOptional()
  @IsIn(['LAUNDRY', 'DRY_CLEANING'])
  workflow?: OrderWorkflowType;

  @IsOptional()
  @IsIn(['WEIGHT', 'PIECES'])
  entryMode?: OrderEntryMode;
}
