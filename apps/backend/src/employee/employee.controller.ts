import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  /**
   * GET /api/employees
   * List employees with store isolation.
   * Allowed roles: OWNER, MANAGER
   */
  @Get()
  @Roles('OWNER', 'MANAGER')
  async findAll(
    @Query('storeId') storeId?: string,
    @Query('isActive') isActiveStr?: string,
    @Request() req?: any,
  ) {
    const isActive = isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;
    const employees = await this.employeeService.findAll(storeId, isActive, req?.user);
    return {
      success: true,
      data: employees,
    };
  }

  /**
   * GET /api/employees/:id
   * Get employee by ID with store isolation.
   * Allowed roles: OWNER, MANAGER
   */
  @Get(':id')
  @Roles('OWNER', 'MANAGER')
  async findOne(@Param('id') id: string, @Request() req?: any) {
    const employee = await this.employeeService.findOne(id, req?.user);
    return {
      success: true,
      data: employee,
    };
  }

  /**
   * POST /api/employees
   * Create a new employee account.
   * Allowed roles: OWNER, MANAGER
   */
  @Post()
  @Roles('OWNER', 'MANAGER')
  async create(@Body() dto: CreateEmployeeDto, @Request() req: any) {
    const employee = await this.employeeService.create(dto, req.user);
    return {
      success: true,
      data: employee,
    };
  }

  /**
   * PATCH /api/employees/:id
   * Update existing employee account (details, role, status, or PIN).
   * Allowed roles: OWNER, MANAGER
   */
  @Patch(':id')
  @Roles('OWNER', 'MANAGER')
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @Request() req: any) {
    const employee = await this.employeeService.update(id, dto, req.user);
    return {
      success: true,
      data: employee,
    };
  }
}
