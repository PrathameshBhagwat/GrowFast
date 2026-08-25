import { Module } from '@nestjs/common';
import { PaymentController, OrderPaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentController, OrderPaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
