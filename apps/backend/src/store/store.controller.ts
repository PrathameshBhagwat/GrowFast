import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  Response,
  StreamableFile,
} from '@nestjs/common';
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

  @Get('top-up-services')
  async getTopUpServices(@Request() req: any) {
    const config = await this.storeService.getStoreConfig(req.user.storeId);
    return {
      success: true,
      data: config.topUpServices,
    };
  }

  @Patch('config')
  @Roles(Role.OWNER, Role.MANAGER)
  updateStoreConfig(@Request() req: any, @Body() updateStoreConfigDto: UpdateStoreConfigDto) {
    return this.storeService.updateStoreConfig(req.user.storeId, updateStoreConfigDto);
  }

  @Get('tag-design')
  @Roles(Role.OWNER)
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
    const template = await this.storeService.updateTagDesign(
      req.user.storeId,
      updateTagDesignDto,
      req.user,
    );
    return {
      success: true,
      data: template.layout,
      message: 'Physical tag design updated successfully',
    };
  }

  @Post('tag-design/reset')
  @Roles(Role.OWNER)
  async resetTagDesign(@Request() req: any) {
    const template = await this.storeService.resetTagDesign(req.user.storeId, req.user);
    return {
      success: true,
      data: template.layout,
      message: 'Physical tag design reset to canonical default',
    };
  }

  @Get('tag-design/history')
  @Roles(Role.OWNER)
  async getTagDesignHistory(@Request() req: any) {
    const history = await this.storeService.getTagDesignHistory(req.user.storeId);
    return {
      success: true,
      data: history,
      message: 'Tag design change history retrieved successfully',
    };
  }

  @Get('tag-design/download-font')
  @Roles(Role.OWNER)
  downloadFont(@Response({ passthrough: true }) res: any) {
    const file = this.storeService.getFontFile('C39HrP36DmT.ttf');
    res.set({
      'Content-Type': 'font/ttf',
      'Content-Disposition': 'attachment; filename="C39HrP36DmT.ttf"',
    });
    return file;
  }
}
