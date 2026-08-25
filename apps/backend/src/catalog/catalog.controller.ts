import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { GetGarmentsQueryDto } from './dto/get-garments-query.dto';
import { UpdateGarmentDto } from './dto/update-garment.dto';
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
  async findAll(@Query() query: GetGarmentsQueryDto) {
    const garments = await this.catalogService.findAllGarments(query.category);
    return {
      success: true,
      data: garments,
    };
  }

  /**
   * PATCH /api/garments/:id
   * Update a garment catalog item. OWNER role required.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async update(@Param('id') id: string, @Body() dto: UpdateGarmentDto) {
    const garment = await this.catalogService.updateGarment(id, dto);
    return {
      success: true,
      data: garment,
    };
  }
}
