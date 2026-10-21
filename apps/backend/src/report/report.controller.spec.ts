import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { Role } from '@growfast/shared-types';

describe('ReportController', () => {
  let controller: ReportController;
  let reportService: any;

  const mockResponse = {
    success: true,
    data: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    summary: {
      totalOrders: 0,
      totalPieces: 0,
      totalWeight: 0,
      totalGrossAmount: 0,
      totalDiscount: 0,
      totalNetAmount: 0,
      totalAdvance: 0,
      totalBalance: 0,
    },
  };

  beforeEach(async () => {
    reportService = {
      getDailyOrdersReport: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [{ provide: ReportService, useValue: reportService }],
    }).compile();

    controller = module.get<ReportController>(ReportController);
  });

  it('delegates to reportService.getDailyOrdersReport with storeId from authenticated user', async () => {
    const mockReq = {
      user: {
        id: 'emp-owner-001',
        role: Role.OWNER,
        storeId: 'store-kp-001',
      },
    };
    const query = { startDate: '2026-10-19', endDate: '2026-10-19' };

    const result = await controller.getDailyOrdersReport(mockReq, query);

    expect(reportService.getDailyOrdersReport).toHaveBeenCalledWith('store-kp-001', query);
    expect(result).toEqual(mockResponse);
  });
});
