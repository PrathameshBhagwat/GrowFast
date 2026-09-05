import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationWorkerService } from './notification.worker';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationWorkerService],
  exports: [NotificationService],
})
export class NotificationModule {}
