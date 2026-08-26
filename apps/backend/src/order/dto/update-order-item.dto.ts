import { IsOptional, IsString, IsInt, Min, IsArray, IsEnum, MaxLength } from 'class-validator';
import { ItemStatus, UpdateOrderItemRequest } from '@growfast/shared-types';

export class UpdateOrderItemDto implements UpdateOrderItemRequest {
  @IsOptional()
  @IsString()
  garmentCatalogId?: string;

  @IsOptional()
  @IsString()
  serviceTypeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colorTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defectNotes?: string;

  @IsOptional()
  @IsEnum(ItemStatus)
  itemStatus?: ItemStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveredQuantity?: number;
}
