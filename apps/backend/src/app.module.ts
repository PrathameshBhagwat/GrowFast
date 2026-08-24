import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule],
})
export class AppModule {}
