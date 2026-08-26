import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrismaModule } from '../prisma/prisma.module';

import { ServicesController } from './services.controller';

/**
 * CatalogModule — garment catalog management.
 *
 * Provides endpoints for listing and updating the garment catalog and service types.
 * PrismaModule is imported for database access.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CatalogController, ServicesController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
