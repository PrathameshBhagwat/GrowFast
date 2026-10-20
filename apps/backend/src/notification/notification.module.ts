import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationWorkerService } from './notification.worker';
import { BillPdfService } from './bill-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationWorkerService, BillPdfService],
  exports: [NotificationService, BillPdfService],
})
export class NotificationModule {}
