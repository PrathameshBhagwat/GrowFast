import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { Role } from '@growfast/shared-types';

describe('EmployeeController', () => {
  let controller: EmployeeController;
  let service: any;

  const mockEmployeeDto = {
    id: 'emp-001',
    name: 'Prathamesh Bhagwat',
    phone: '+919876543210',
    email: 'owner@example.com',
    role: Role.OWNER,
    storeId: 'store-001',
    storeName: 'Koregaon Park Branch',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockReqUser = {
    user: {
      id: 'emp-001',
      role: Role.OWNER,
      storeId: 'store-001',
    },
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [{ provide: EmployeeService, useValue: service }],
    }).compile();

    controller = module.get<EmployeeController>(EmployeeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return employee list wrapped in success response with req.user', async () => {
      service.findAll.mockResolvedValue([mockEmployeeDto]);

      const result = await controller.findAll('store-001', 'true', mockReqUser);

      expect(result).toEqual({
        success: true,
        data: [mockEmployeeDto],
      });
      expect(service.findAll).toHaveBeenCalledWith('store-001', true, mockReqUser.user);
    });
  });

  describe('findOne', () => {
    it('should return single employee wrapped in success response with req.user', async () => {
      service.findOne.mockResolvedValue(mockEmployeeDto);

      const result = await controller.findOne('emp-001', mockReqUser);

      expect(result).toEqual({
        success: true,
        data: mockEmployeeDto,
      });
      expect(service.findOne).toHaveBeenCalledWith('emp-001', mockReqUser.user);
    });
  });

  describe('create', () => {
    it('should call service.create with DTO and req.user', async () => {
      service.create.mockResolvedValue(mockEmployeeDto);

      const dto = {
        name: 'New Staff',
        pin: '123456',
        role: Role.COUNTER,
      };

      const result = await controller.create(dto, mockReqUser);

      expect(result).toEqual({
        success: true,
        data: mockEmployeeDto,
      });
      expect(service.create).toHaveBeenCalledWith(dto, mockReqUser.user);
    });
  });

  describe('update', () => {
    it('should call service.update with ID, DTO and req.user', async () => {
      service.update.mockResolvedValue({ ...mockEmployeeDto, name: 'Updated Name' });

      const dto = { name: 'Updated Name' };

      const result = await controller.update('emp-001', dto, mockReqUser);

      expect(result).toEqual({
        success: true,
        data: { ...mockEmployeeDto, name: 'Updated Name' },
      });
      expect(service.update).toHaveBeenCalledWith('emp-001', dto, mockReqUser.user);
    });
  });
});
