import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, CatalogModule],
})
export class AppModule {}
