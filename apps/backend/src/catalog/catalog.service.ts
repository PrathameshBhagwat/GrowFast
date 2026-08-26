import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GarmentCategory, ServiceCategory } from '@growfast/shared-types';
import { UpdateGarmentDto } from './dto/update-garment.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/**
 * Catalog Service — business logic for garment catalog management.
 *
 * Provides data access for garment catalog items via Prisma.
 * All query/mutation logic lives here; the controller stays thin.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List garment catalog items, optionally filtered by category.
   */
  async findAllGarments(category?: GarmentCategory) {
    const where = category ? { category } : {};

    return this.prisma.garmentCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a garment catalog item by ID.
   * Validates existence before updating.
   */
  async updateGarment(id: string, dto: UpdateGarmentDto) {
    const existing = await this.prisma.garmentCatalog.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Garment with ID "${id}" not found`);
    }

    return this.prisma.garmentCatalog.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * List service types, optionally filtered by category.
   */
  async findAllServices(category?: ServiceCategory) {
    const where = category ? { category } : {};

    return this.prisma.serviceType.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a service type by ID.
   * Validates existence before updating.
   */
  async updateService(id: string, dto: UpdateServiceDto) {
    const existing = await this.prisma.serviceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Service type with ID "${id}" not found`);
    }

    return this.prisma.serviceType.update({
      where: { id },
      data: dto,
    });
  }
}
