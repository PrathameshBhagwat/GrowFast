import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@growfast/shared-types';
import type { DashboardSummaryDTO } from '@growfast/shared-types';

@Controller('dashboard')
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

    const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

    let startDate: Date;
    let endDate: Date;

    if (startDateStr) {
      if (DATE_ONLY_REGEX.test(startDateStr.trim())) {
        startDate = new Date(`${startDateStr.trim()}T00:00:00.000+05:30`);
      } else {
        startDate = new Date(startDateStr);
      }
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException(`Invalid startDate: "${startDateStr}"`);
      }
    } else {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = formatter.format(new Date());
      startDate = new Date(`${todayStr}T00:00:00.000+05:30`);
    }

    if (endDateStr) {
      if (DATE_ONLY_REGEX.test(endDateStr.trim())) {
        endDate = new Date(`${endDateStr.trim()}T23:59:59.999+05:30`);
      } else {
        endDate = new Date(endDateStr);
      }
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException(`Invalid endDate: "${endDateStr}"`);
      }
    } else {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = formatter.format(new Date());
      endDate = new Date(`${todayStr}T23:59:59.999+05:30`);
    }

    // Reject inverted ranges
    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return this.dashboardService.getSummary(storeId, startDate, endDate);
  }
}
