import { IsISO8601, IsString, MinLength } from 'class-validator';
import { UpdateDueDateRequest } from '@growfast/shared-types';

export class UpdateDueDateDto implements UpdateDueDateRequest {
  @IsISO8601()
  effectiveDueDate!: string;

  @IsString()
  @MinLength(5)
  reason!: string;
}
