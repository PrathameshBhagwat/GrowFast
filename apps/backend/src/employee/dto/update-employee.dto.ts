import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Role } from '@growfast/shared-types';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Invalid employee role' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 numeric digits' })
  pin?: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}
