import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SetPriceDto } from './dto/set-price.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/pricing
   * Returns all garment/service price mappings.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any) {
    const storeId = req.user.storeId;
    const prices = await this.catalogService.findAllPrices(storeId);
    return {
      success: true,
      data: prices,
    };
  }

  /**
   * POST /api/pricing/:garmentId/:serviceId
   * Set price for a garment and service combo. OWNER role required.
   */
  @Post(':garmentId/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async setPrice(
    @Req() req: any,
    @Param('garmentId') garmentId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: SetPriceDto,
  ) {
    const storeId = req.user.storeId;
    const priceRecord = await this.catalogService.setPrice(garmentId, serviceId, storeId, dto);
    return {
      success: true,
      data: priceRecord,
    };
  }
}
