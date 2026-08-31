import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pricing')
export class PricingController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/pricing
   * Returns all garment/service price mappings.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    const prices = await this.catalogService.findAllPrices();
    return {
      success: true,
      data: prices,
    };
  }
}
