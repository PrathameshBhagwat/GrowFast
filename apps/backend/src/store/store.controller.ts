import { Controller, Get, Patch, Put, Post, Body, UseGuards, Request } from '@nestjs/common';
import { StoreService } from './store.service';
import { UpdateStoreConfigDto } from './dto/update-store-config.dto';
import { UpdateTagDesignDto } from './dto/update-tag-design.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@growfast/shared-types';

@Controller('store')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('config')
  getStoreConfig(@Request() req: any) {
    return this.storeService.getStoreConfig(req.user.storeId);
  }

  @Patch('config')
  @Roles(Role.OWNER)
  updateStoreConfig(@Request() req: any, @Body() updateStoreConfigDto: UpdateStoreConfigDto) {
    return this.storeService.updateStoreConfig(req.user.storeId, updateStoreConfigDto);
  }

  @Get('tag-design')
  async getTagDesign(@Request() req: any) {
    const template = await this.storeService.getTagDesign(req.user.storeId);
    return {
      success: true,
      data: template.layout,
      message: 'Active physical tag design retrieved successfully',
    };
  }

  @Put('tag-design')
  @Roles(Role.OWNER)
  async updateTagDesign(@Request() req: any, @Body() updateTagDesignDto: UpdateTagDesignDto) {
    const template = await this.storeService.updateTagDesign(req.user.storeId, updateTagDesignDto);
    return {
      success: true,
      data: template.layout,
      message: 'Physical tag design updated successfully',
    };
  }

  @Post('tag-design/reset')
  @Roles(Role.OWNER)
  async resetTagDesign(@Request() req: any) {
    const template = await this.storeService.resetTagDesign(req.user.storeId);
    return {
      success: true,
      data: template.layout,
      message: 'Physical tag design reset to canonical default',
    };
  }
}
