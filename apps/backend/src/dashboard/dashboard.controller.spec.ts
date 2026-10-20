import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BadRequestException } from '@nestjs/common';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<Partial<DashboardService>>;

  const STORE_ID = 'test-store-1';
  const mockReq = {
    user: {
      storeId: STORE_ID,
      role: 'OWNER',
    },
  };

  beforeEach(async () => {
    service = {
      getSummary: jest.fn().mockResolvedValue({} as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should default to today in Asia/Kolkata when no date params are provided', async () => {
    await controller.getSummary(mockReq);

    expect(service.getSummary).toHaveBeenCalledTimes(1);
    const [storeId, start, end] = (service.getSummary as jest.Mock).mock.calls[0];

    expect(storeId).toBe(STORE_ID);
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it('should parse YYYY-MM-DD date strings into Asia/Kolkata boundaries', async () => {
    await controller.getSummary(mockReq, '2026-09-01', '2026-09-05');

    expect(service.getSummary).toHaveBeenCalledTimes(1);
    const [, start, end] = (service.getSummary as jest.Mock).mock.calls[0];

    // 2026-09-01T00:00:00.000+05:30 -> UTC 2026-08-31T18:30:00.000Z
    expect(start.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    // 2026-09-05T23:59:59.999+05:30 -> UTC 2026-09-05T18:29:59.999Z
    expect(end.toISOString()).toBe('2026-09-05T18:29:59.999Z');
  });

  it('should parse ISO timestamp strings directly without shifting', async () => {
    await controller.getSummary(mockReq, '2026-09-01T10:00:00.000Z', '2026-09-05T18:00:00.000Z');

    expect(service.getSummary).toHaveBeenCalledTimes(1);
    const [, start, end] = (service.getSummary as jest.Mock).mock.calls[0];

    expect(start.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-05T18:00:00.000Z');
  });

  it('should throw BadRequestException when startDate is invalid', async () => {
    await expect(controller.getSummary(mockReq, 'invalid-date', '2026-09-05')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when endDate is invalid', async () => {
    await expect(controller.getSummary(mockReq, '2026-09-01', 'invalid-date')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when startDate is after endDate', async () => {
    await expect(controller.getSummary(mockReq, '2026-09-05', '2026-09-01')).rejects.toThrow(
      new BadRequestException('startDate must be before or equal to endDate'),
    );
  });
});
