import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class ArchiveOrdersDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one order ID must be provided' })
  @IsString({ each: true, message: 'Each order ID must be a string' })
  orderIds!: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
