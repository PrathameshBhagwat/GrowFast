import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, NotificationEventType, NotificationStatus } from '@growfast/shared-types';

/**
 * Notification Controller — C8 Foundation
 *
 * Read-only endpoints for viewing notification event history.
 * All endpoints enforce store isolation from the authenticated user's context.
 * No endpoint accepts storeId from client input.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/notifications?eventType=...&status=...&orderId=...
   *
   * List notification events for the authenticated user's store.
   * Restricted to OWNER and MANAGER roles.
   */
  @Get()
  @Roles(Role.OWNER, Role.MANAGER)
  async findAll(
    @Request() req: any,
    @Query('eventType') eventType?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
  ) {
    const storeId: string = req.user.storeId;

    const filters: {
      eventType?: NotificationEventType;
      status?: NotificationStatus;
      orderId?: string;
    } = {};

    if (
      eventType &&
      Object.values(NotificationEventType).includes(eventType as NotificationEventType)
    ) {
      filters.eventType = eventType as NotificationEventType;
    }

    if (status && Object.values(NotificationStatus).includes(status as NotificationStatus)) {
      filters.status = status as NotificationStatus;
    }

    if (orderId) {
      filters.orderId = orderId;
    }

    const notifications = await this.notificationService.findNotifications(storeId, filters);

    return { success: true, data: notifications };
  }

  /**
   * GET /api/notifications/:id
   *
   * Get a single notification event by ID.
   * Store isolation enforced — cannot access notifications from other stores.
   */
  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId: string = req.user.storeId;
    const notification = await this.notificationService.findById(id, storeId);
    return { success: true, data: notification };
  }
}
