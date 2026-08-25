import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GarmentCategory } from '@prisma/client';
import { UpdateGarmentDto } from './dto/update-garment.dto';

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
}
