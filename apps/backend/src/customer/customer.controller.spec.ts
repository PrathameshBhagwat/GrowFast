import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { MembershipTier, RegistrationSource } from '@growfast/shared-types';
import { NotFoundException } from '@nestjs/common';

describe('CustomerController', () => {
  let controller: CustomerController;
  let service: CustomerService;

  const mockCustomer = {
    id: 'cust-100',
    name: 'Aarav Kumar',
    phone: '9876512345',
    email: 'aarav@example.com',
    address: '123 MG Road',
    pincode: '411001',
    membership: MembershipTier.NONE,
    discountPercent: 0,
    preferences: null,
    registrationSource: RegistrationSource.WALK_IN,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockCustomerService = {
    createCustomer: jest.fn(),
    searchCustomers: jest.fn(),
    getCustomerById: jest.fn(),
    updateCustomer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        {
          provide: CustomerService,
          useValue: mockCustomerService,
        },
      ],
    }).compile();

    controller = module.get<CustomerController>(CustomerController);
    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCustomer', () => {
    it('should call customerService.createCustomer and return wrapped success payload', async () => {
      mockCustomerService.createCustomer.mockResolvedValue(mockCustomer);

      const dto = {
        name: 'Aarav Kumar',
        phone: '9876512345',
        email: 'aarav@example.com',
      };

      const result = await controller.createCustomer(dto);

      expect(service.createCustomer).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        data: mockCustomer,
      });
    });
  });

  describe('searchCustomers', () => {
    it('should delegate search parameters to customerService.searchCustomers', async () => {
      const searchResult = {
        success: true,
        data: [mockCustomer],
        total: 1,
        page: 1,
        pageSize: 10,
      };
      mockCustomerService.searchCustomers.mockResolvedValue(searchResult);

      const result = await controller.searchCustomers('98765', '1', '10');

      expect(service.searchCustomers).toHaveBeenCalledWith('98765', '1', '10');
      expect(result).toEqual(searchResult);
    });
  });

  describe('getCustomerById', () => {
    it('should return wrapped customer object if found', async () => {
      mockCustomerService.getCustomerById.mockResolvedValue(mockCustomer);

      const result = await controller.getCustomerById('cust-100');

      expect(service.getCustomerById).toHaveBeenCalledWith('cust-100');
      expect(result).toEqual({
        success: true,
        data: mockCustomer,
      });
    });

    it('should throw NotFoundException if customer is not found', async () => {
      mockCustomerService.getCustomerById.mockResolvedValue(null);

      await expect(controller.getCustomerById('cust-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCustomer', () => {
    it('should call customerService.updateCustomer and return wrapped success response', async () => {
      const updatedCustomer = { ...mockCustomer, name: 'Aarav Updated' };
      mockCustomerService.updateCustomer.mockResolvedValue(updatedCustomer);

      const updateDto = { name: 'Aarav Updated' };
      const result = await controller.updateCustomer('cust-100', updateDto);

      expect(service.updateCustomer).toHaveBeenCalledWith('cust-100', updateDto);
      expect(result).toEqual({
        success: true,
        data: updatedCustomer,
      });
    });
  });
});
