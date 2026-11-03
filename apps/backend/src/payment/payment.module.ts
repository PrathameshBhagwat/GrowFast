import { Module } from '@nestjs/common';
import {
  PaymentController,
  OrderPaymentController,
  OrderAdjustmentController,
} from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationModule, AuthModule],
  controllers: [PaymentController, OrderPaymentController, OrderAdjustmentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
