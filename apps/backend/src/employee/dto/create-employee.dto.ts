import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Role } from '@growfast/shared-types';

export class CreateEmployeeDto {
  @IsNotEmpty({ message: 'Employee name is required' })
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsNotEmpty({ message: 'PIN is required' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 numeric digits' })
  pin!: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(Role, { message: 'Invalid employee role' })
  role!: Role;

  @IsOptional()
  @IsString()
  storeId?: string;
}
