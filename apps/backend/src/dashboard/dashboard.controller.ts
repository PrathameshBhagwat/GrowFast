import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@growfast/shared-types';
import type { DashboardSummaryDTO } from '@growfast/shared-types';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/dashboard/summary?startDate=...&endDate=...
   *
   * Returns the dashboard KPI summary for the authenticated user's store.
   * Defaults to "today" if no date parameters are provided.
   * Read-only — no mutations.
   */
  @Get('summary')
  @Roles(Role.OWNER, Role.MANAGER, Role.COUNTER)
  async getSummary(
    @Request() req: any,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ): Promise<DashboardSummaryDTO> {
    const storeId: string = req.user.storeId;

    // Default to today if no dates provided
    let startDate: Date;
    let endDate: Date;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException(`Invalid startDate: "${startDateStr}"`);
      }
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    }

    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException(`Invalid endDate: "${endDateStr}"`);
      }
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Reject inverted ranges
    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return this.dashboardService.getSummary(storeId, startDate, endDate);
  }
}
