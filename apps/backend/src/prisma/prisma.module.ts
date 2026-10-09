import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BusinessSequenceService } from './business-sequence.service';

@Global()
@Module({
  providers: [PrismaService, BusinessSequenceService],
  exports: [PrismaService, BusinessSequenceService],
})
export class PrismaModule {}
