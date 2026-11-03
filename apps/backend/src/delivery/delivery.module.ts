import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { PhotoModule } from '../photo/photo.module';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationModule, PaymentModule, PhotoModule, AuthModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
