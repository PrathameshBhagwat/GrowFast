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

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsOptional()
  @IsString()
  passportPhotoUrl?: string | null;

  @IsOptional()
  @IsString()
  aadhaarFrontUrl?: string | null;

  @IsOptional()
  @IsString()
  aadhaarBackUrl?: string | null;

  @IsOptional()
  @IsString()
  currentAddress?: string | null;

  @IsOptional()
  @IsString()
  permanentAddress?: string | null;

  @IsOptional()
  @IsBoolean()
  sameAsCurrentAddress?: boolean;
}
