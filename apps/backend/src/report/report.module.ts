import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, PaymentModule, AuthModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
