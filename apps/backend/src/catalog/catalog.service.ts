import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GarmentCategory, ServiceCategory } from '@growfast/shared-types';
import { UpdateGarmentDto } from './dto/update-garment.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateGarmentDto } from './dto/create-garment.dto';
import { SetPriceDto } from './dto/set-price.dto';

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
   * Includes global items (storeId = null) and store-specific items.
   */
  async findAllGarments(storeId: string, category?: GarmentCategory) {
    const where: any = {
      OR: [{ storeId: null }, { storeId }],
    };
    if (category) where.category = category;

    return this.prisma.garmentCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a store-scoped garment catalog item.
   */
  async createGarment(storeId: string, dto: CreateGarmentDto) {
    return this.prisma.garmentCatalog.create({
      data: {
        name: dto.name,
        category: dto.category,
        section: dto.section,
        isActive: dto.isActive ?? true,
        storeId,
      },
    });
  }

  /**
   * Update a garment catalog item by ID.
   * Validates existence and store isolation before updating.
   */
  async updateGarment(id: string, storeId: string, dto: UpdateGarmentDto) {
    const existing = await this.prisma.garmentCatalog.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Garment with ID "${id}" not found`);
    }

    if (existing.storeId && existing.storeId !== storeId) {
      throw new ForbiddenException(`Cannot modify garment belonging to another store`);
    }

    return this.prisma.garmentCatalog.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * List service types, optionally filtered by category.
   */
  async findAllServices(storeId: string, category?: ServiceCategory) {
    const where: any = {
      OR: [{ storeId: null }, { storeId }],
    };
    if (category) where.category = category;

    return this.prisma.serviceType.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a service type by ID.
   * Validates existence and store isolation before updating.
   */
  async updateService(id: string, storeId: string, dto: UpdateServiceDto) {
    const existing = await this.prisma.serviceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Service type with ID "${id}" not found`);
    }

    if (existing.storeId && existing.storeId !== storeId) {
      throw new ForbiddenException(`Cannot modify service belonging to another store`);
    }

    return this.prisma.serviceType.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * List all service garment prices.
   * Returns merged prices where store-specific prices override global ones.
   */
  async findAllPrices(storeId: string) {
    const prices = await this.prisma.serviceGarmentPrice.findMany({
      where: {
        OR: [{ storeId: null }, { storeId }],
      },
      orderBy: [{ garmentCatalogId: 'asc' }, { serviceTypeId: 'asc' }],
    });

    // Merge logic: prefer storeId over null
    const priceMap = new Map<string, any>();
    for (const p of prices) {
      const key = `${p.garmentCatalogId}_${p.serviceTypeId}`;
      const existing = priceMap.get(key);
      if (!existing || (existing.storeId === null && p.storeId !== null)) {
        priceMap.set(key, p);
      }
    }
    return Array.from(priceMap.values());
  }

  /**
   * Get price for a specific garment and service combination.
   */
  async getPrice(
    garmentCatalogId: string,
    serviceTypeId: string,
    storeId: string,
  ): Promise<number> {
    const priceRecord = await this.prisma.serviceGarmentPrice.findFirst({
      where: {
        garmentCatalogId,
        serviceTypeId,
        OR: [{ storeId: null }, { storeId }],
      },
      orderBy: {
        // storeId non-null comes before null, but in Prisma orderBy we can just use `storeId` directly?
        // Actually, we can just sort by `storeId` descending (since null is first or last depending on db, in Postgres nulls last with desc)
        // Or just fetch both and pick in code.
      },
    });

    // simpler: fetch both
    const records = await this.prisma.serviceGarmentPrice.findMany({
      where: { garmentCatalogId, serviceTypeId, OR: [{ storeId: null }, { storeId }] },
    });

    if (!records.length) {
      throw new NotFoundException(
        `Pricing not found for garment ${garmentCatalogId} and service ${serviceTypeId}`,
      );
    }

    const storePrice = records.find((r) => r.storeId === storeId);
    return storePrice ? storePrice.price : records[0].price;
  }

  /**
   * Set or update a price for a specific garment and service combination.
   */
  async setPrice(
    garmentCatalogId: string,
    serviceTypeId: string,
    storeId: string,
    dto: SetPriceDto,
  ) {
    return this.prisma.serviceGarmentPrice.upsert({
      where: {
        garmentCatalogId_serviceTypeId_storeId: {
          garmentCatalogId,
          serviceTypeId,
          storeId,
        },
      },
      update: {
        price: dto.price,
      },
      create: {
        garmentCatalogId,
        serviceTypeId,
        storeId,
        price: dto.price,
      },
    });
  }
}
