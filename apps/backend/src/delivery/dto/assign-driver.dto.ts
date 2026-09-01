import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class AssignDriverDto {
  @IsString()
  @IsNotEmpty()
  riderId!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
