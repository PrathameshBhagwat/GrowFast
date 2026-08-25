import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { CreateCustomerRequest, UpdateCustomerRequest } from '@growfast/shared-types';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * POST /api/customers
   * Create a new customer record.
   * Allowed roles: OWNER, MANAGER, COUNTER
   */
  @Post()
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async createCustomer(@Body() dto: CreateCustomerRequest) {
    const customer = await this.customerService.createCustomer(dto);
    return {
      success: true,
      data: customer,
    };
  }

  /**
   * GET /api/customers/search
   * Search customers by phone, name, or ID with pagination.
   * Allowed roles: ALL (OWNER, MANAGER, COUNTER, DELIVERY)
   */
  @Get('search')
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async searchCustomers(
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.customerService.searchCustomers(query, page, pageSize);
  }

  /**
   * GET /api/customers/:id
   * Get single customer by ID.
   * Allowed roles: ALL (OWNER, MANAGER, COUNTER, DELIVERY)
   */
  @Get(':id')
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async getCustomerById(@Param('id') id: string) {
    const customer = await this.customerService.getCustomerById(id);
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
   * Update an existing customer record.
   * Allowed roles: OWNER, MANAGER, COUNTER
   */
  @Patch(':id')
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerRequest) {
    const customer = await this.customerService.updateCustomer(id, dto);
    return {
      success: true,
      data: customer,
    };
  }
}
