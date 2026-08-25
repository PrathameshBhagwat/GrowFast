import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PhotoModule } from './photo/photo.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, PhotoModule, CatalogModule, CustomerModule],
})
export class AppModule {}

