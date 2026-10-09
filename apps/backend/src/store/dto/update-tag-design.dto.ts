import { IsOptional, IsString, IsObject } from 'class-validator';
import { TagDesignConfig, UpdateTagDesignRequest } from '@growfast/shared-types';

export class UpdateTagDesignDto implements UpdateTagDesignRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsObject()
  layout!: TagDesignConfig;
}
