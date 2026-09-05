import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateDueDateDto } from './dto/update-due-date.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async createOrder(@Body() dto: CreateOrderDto, @Request() req: any) {
    const employeeId = req.user.id;
    const storeId = req.user.storeId;
    const order = await this.orderService.createOrder(dto, employeeId, storeId);
    return {
      success: true,
      data: order,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: GetOrdersQueryDto, @Request() req: any) {
    const storeId = req.user.storeId;
    const result = await this.orderService.findAllOrders(query, storeId);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.storeId;
    const order = await this.orderService.findOrderById(id, storeId);
    return {
      success: true,
      data: order,
    };
  }

  @Patch(':orderId/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  async updateOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
    @Request() req: any,
  ) {
    const storeId = req.user.storeId;
    const order = await this.orderService.updateOrderItem(orderId, itemId, dto, storeId);
    return {
      success: true,
      data: order,
    };
  }

  @Patch(':orderId/items/:itemId/garments/:garmentId/ready')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'COUNTER')
  async markGarmentReady(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Param('garmentId') garmentId: string,
    @Body('isReady') isReady: boolean,
    @Request() req: any,
  ) {
    const storeId = req.user.storeId;
    const order = await this.orderService.markPhysicalGarmentReady(
      orderId,
      itemId,
      garmentId,
      isReady,
      storeId,
    );
    return {
      success: true,
      data: order,
    };
  }

  @Patch(':id/due-date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  async updateDueDate(@Param('id') id: string, @Body() dto: UpdateDueDateDto, @Request() req: any) {
    const employeeId = req.user.id;
    const storeId = req.user.storeId;
    const order = await this.orderService.updateDueDate(
      id,
      dto.effectiveDueDate,
      dto.reason,
      employeeId,
      storeId,
    );
    return {
      success: true,
      data: order,
    };
  }
}
