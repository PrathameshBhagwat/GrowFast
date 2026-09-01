import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async createDelivery(@Body() dto: CreateDeliveryDto, @Request() req: any) {
    const delivery = await this.deliveryService.createDelivery(
      dto.orderId,
      dto.address,
      dto.scheduledAt,
      req.user.storeId,
    );
    return { success: true, data: delivery };
  }

  @Get()
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async findAll(@Query('status') status: string | undefined, @Request() req: any) {
    const deliveries = await this.deliveryService.findDeliveries(
      req.user.storeId,
      req.user.id,
      req.user.role,
      status ? { status } : undefined,
    );
    return { success: true, data: deliveries };
  }

  @Get(':id')
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const delivery = await this.deliveryService.findDeliveryById(
      id,
      req.user.storeId,
      req.user.id,
      req.user.role,
    );
    return { success: true, data: delivery };
  }

  @Patch(':id/assign')
  @Roles('OWNER', 'MANAGER')
  async assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto, @Request() req: any) {
    const delivery = await this.deliveryService.assignDriver(
      id,
      dto.riderId,
      dto.scheduledAt,
      req.user.storeId,
    );
    return { success: true, data: delivery };
  }

  @Patch(':id/status')
  @Roles('OWNER', 'MANAGER', 'DELIVERY')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Request() req: any,
  ) {
    const delivery = await this.deliveryService.updateDeliveryStatus(
      id,
      dto.status,
      dto.notes,
      req.user.storeId,
      req.user.id,
      req.user.role,
    );
    return { success: true, data: delivery };
  }

  @Patch(':id/complete')
  @Roles('OWNER', 'MANAGER', 'DELIVERY')
  async completeDelivery(
    @Param('id') id: string,
    @Body() dto: CompleteDeliveryDto,
    @Request() req: any,
  ) {
    const delivery = await this.deliveryService.completeDelivery(
      id,
      dto.proofPhotoUrl,
      dto.notes,
      dto.deliveredItems,
      req.user.storeId,
      req.user.id,
      req.user.role,
    );
    return { success: true, data: delivery };
  }
}
