import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PhotoModule } from './photo/photo.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, PhotoModule, CatalogModule],
})
export class AppModule {}
