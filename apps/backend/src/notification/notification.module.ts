import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationWorkerService } from './notification.worker';
import { BillPdfService } from './bill-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationWorkerService, BillPdfService],
  exports: [NotificationService, BillPdfService],
})
export class NotificationModule {}
