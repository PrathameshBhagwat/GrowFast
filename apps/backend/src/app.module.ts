import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PhotoModule } from './photo/photo.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, PhotoModule],
})
export class AppModule {}
