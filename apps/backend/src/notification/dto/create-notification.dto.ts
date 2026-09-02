import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { NotificationEventType, NotificationChannel } from '@growfast/shared-types';

/**
 * DTO for creating a notification event.
 *
 * storeId is NEVER accepted from the client — it is always derived
 * from the authenticated user's context.
 */
export class CreateNotificationDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsEnum(NotificationEventType)
  eventType!: NotificationEventType;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsString()
  recipient!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
