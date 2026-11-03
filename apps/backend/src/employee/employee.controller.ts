import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeeService, STAFF_DOCUMENT_MAX_SIZE } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BranchAuthGuard } from '../auth/branch-auth.guard';

@Controller('employees')
@UseGuards(JwtAuthGuard, BranchAuthGuard, RolesGuard)
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
   * POST /api/employees/upload-document
   * Upload an optional staff photograph, passport-size photo, or Aadhaar card image.
   * Allowed roles: OWNER, MANAGER
   */
  @Post('upload-document')
  @Roles('OWNER', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: STAFF_DOCUMENT_MAX_SIZE },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('storeId') storeId: string,
    @Request() req: any,
  ) {
    const result = await this.employeeService.uploadDocument(file, storeId, req.user);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/employees/:id/documents/:docType
   * Retrieve secure, authenticated access URL for a staff document.
   * Allowed roles: OWNER, MANAGER
   */
  @Get(':id/documents/:docType')
  @Roles('OWNER', 'MANAGER')
  async getDocumentUrl(
    @Param('id') id: string,
    @Param('docType') docType: string,
    @Request() req: any,
  ) {
    const accessUrl = await this.employeeService.getDocumentAccessUrl(id, docType, req.user);
    return {
      success: true,
      data: { accessUrl },
    };
  }

  /**
   * GET /api/employees/:id
   * Get employee by ID with store isolation and complete profile.
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
   * Create a new employee account with optional profile details.
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
   * Update existing employee account (details, role, status, PIN, or optional profile).
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

  /**
   * DELETE /api/employees/:id
   * Permanently delete an employee account with historical and financial preservation.
   * Allowed roles: OWNER, MANAGER
   */
  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  async remove(@Param('id') id: string, @Request() req: any) {
    const result = await this.employeeService.remove(id, req.user);
    return {
      success: true,
      message: result.message,
      data: {
        permanentDeleteType: result.permanentDeleteType,
      },
    };
  }
}
