import { Module } from '@nestjs/common';
import { PaymentController, OrderPaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [PaymentController, OrderPaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
