import { Controller, Post, Get, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
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
  async findAll(@Query() query: GetOrdersQueryDto) {
    const result = await this.orderService.findAllOrders(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const order = await this.orderService.findOrderById(id);
    return {
      success: true,
      data: order,
    };
  }
}
