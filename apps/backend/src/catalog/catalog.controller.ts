import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { GetGarmentsQueryDto } from './dto/get-garments-query.dto';
import { UpdateGarmentDto } from './dto/update-garment.dto';
import { CreateGarmentDto } from './dto/create-garment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Catalog Controller — thin HTTP layer for garment catalog endpoints.
 *
 * GET  /api/garments       — List garments (all authenticated roles)
 * PATCH /api/garments/:id  — Update garment (OWNER only)
 */
@Controller('garments')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/garments?category=MEN
   * Returns the garment catalog, optionally filtered by category.
   * Accessible to all authenticated employees.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any, @Query() query: GetGarmentsQueryDto) {
    const storeId = req.user.storeId;
    const garments = await this.catalogService.findAllGarments(storeId, query.category);
    return {
      success: true,
      data: garments,
    };
  }

  /**
   * POST /api/garments
   * Create a new garment. OWNER, MANAGER, or COUNTER (Employee) role required.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async create(@Req() req: any, @Body() dto: CreateGarmentDto) {
    const storeId = req.user.storeId;
    const garment = await this.catalogService.createGarment(storeId, dto);
    return {
      success: true,
      data: garment,
    };
  }

  /**
   * PATCH /api/garments/:id
   * Update a garment catalog item. OWNER, MANAGER, or COUNTER (Employee) role required.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateGarmentDto) {
    const storeId = req.user.storeId;
    const garment = await this.catalogService.updateGarment(id, storeId, dto);
    return {
      success: true,
      data: garment,
    };
  }
}
