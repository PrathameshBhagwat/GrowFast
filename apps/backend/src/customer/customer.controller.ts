import { Controller, Get, Query, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

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
}
