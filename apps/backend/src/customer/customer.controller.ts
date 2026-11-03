import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BranchAuthGuard } from '../auth/branch-auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { CreateCustomerRequest, UpdateCustomerRequest } from '@growfast/shared-types';

@Controller('customers')
@UseGuards(JwtAuthGuard, BranchAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * POST /api/customers
   * Create a new customer record bound to the active branch.
   * Allowed roles: OWNER, MANAGER, COUNTER
   */
  @Post()
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async createCustomer(@Body() dto: CreateCustomerRequest, @Request() req?: any) {
    const storeId = req?.user?.storeId;
    const customer = storeId
      ? await this.customerService.createCustomer(dto, storeId)
      : await this.customerService.createCustomer(dto);
    return {
      success: true,
      data: customer,
    };
  }

  /**
   * GET /api/customers/search
   * Search customers with branch isolation.
   * Allowed roles: ALL (OWNER, MANAGER, COUNTER, DELIVERY)
   */
  @Get('search')
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async searchCustomers(
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: any,
  ) {
    const storeId = req?.user?.storeId;
    return storeId
      ? this.customerService.searchCustomers(query, page, pageSize, storeId)
      : this.customerService.searchCustomers(query, page, pageSize);
  }

  /**
   * GET /api/customers/:id
   * Get single customer by ID with branch isolation.
   * Allowed roles: ALL (OWNER, MANAGER, COUNTER, DELIVERY)
   */
  @Get(':id')
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async getCustomerById(@Param('id') id: string, @Request() req?: any) {
    const storeId = req?.user?.storeId;
    const userRole = req?.user?.role;
    const customer =
      storeId || userRole
        ? await this.customerService.getCustomerById(id, storeId, userRole)
        : await this.customerService.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return {
      success: true,
      data: customer,
    };
  }

  /**
   * PATCH /api/customers/:id
   * Update an existing customer record with branch ownership verification.
   * Allowed roles: OWNER, MANAGER, COUNTER
   */
  @Patch(':id')
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerRequest,
    @Request() req?: any,
  ) {
    const storeId = req?.user?.storeId;
    const userRole = req?.user?.role;
    const customer =
      storeId || userRole
        ? await this.customerService.updateCustomer(id, dto, storeId, userRole)
        : await this.customerService.updateCustomer(id, dto);
    return {
      success: true,
      data: customer,
    };
  }
}
