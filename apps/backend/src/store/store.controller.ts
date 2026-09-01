import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { StoreService } from './store.service';
import { UpdateStoreConfigDto } from './dto/update-store-config.dto';
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
}
