import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecordPaymentRequest } from '@growfast/shared-types';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async recordPayment(@Request() req: any, @Body() body: RecordPaymentRequest) {
    const payment = await this.paymentService.recordPayment(req.user.id, req.user.storeId, body);
    return {
      success: true,
      data: payment,
    };
  }
}

@Controller('orders/:orderId/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async getOrderPayments(@Request() req: any, @Param('orderId') orderId: string) {
    const payments = await this.paymentService.getOrderPayments(orderId, req.user.storeId);
    return {
      success: true,
      data: payments,
    };
  }
}
