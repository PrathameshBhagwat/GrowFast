import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportService } from './report.service';
import { DailyOrdersReportQueryDto } from './dto/daily-orders-report-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, DailyOrdersReportResponseDTO } from '@growfast/shared-types';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * GET /api/reports/daily-orders
   *
   * Generates the Daily Orders Report for the authenticated user's store.
   * Access restricted to Store Owners and Managers.
   */
  @Get('daily-orders')
  @Roles(Role.OWNER, Role.MANAGER)
  async getDailyOrdersReport(
    @Request() req: any,
    @Query() query: DailyOrdersReportQueryDto,
  ): Promise<DailyOrdersReportResponseDTO> {
    const storeId: string = req.user.storeId;
    return this.reportService.getDailyOrdersReport(storeId, query);
  }
}
