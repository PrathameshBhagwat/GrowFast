import { Controller, Get, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { GetServicesQueryDto } from './dto/get-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Services Controller — thin HTTP layer for service types endpoints.
 *
 * GET  /api/services       — List services (all authenticated roles)
 * PATCH /api/services/:id  — Update service (OWNER only)
 */
@Controller('services')
export class ServicesController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/services?category=DRY_CLEAN
   * Returns the service types, optionally filtered by category.
   * Accessible to all authenticated employees.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any, @Query() query: GetServicesQueryDto) {
    const storeId = req.user.storeId;
    const services = await this.catalogService.findAllServices(storeId, query.category);
    return {
      success: true,
      data: services,
    };
  }

  /**
   * PATCH /api/services/:id
   * Update a service type. OWNER or MANAGER role required.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    const storeId = req.user.storeId;
    const service = await this.catalogService.updateService(id, storeId, dto);
    return {
      success: true,
      data: service,
    };
  }
}
