import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { ServicesController } from './services.controller';
import { PricingController } from './pricing.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CatalogController, ServicesController, PricingController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
