import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStoreConfigDto } from './dto/update-store-config.dto';
import { UpdateTagDesignDto } from './dto/update-tag-design.dto';
import { TagTemplateDTO, DEFAULT_TAG_DESIGN, sanitizeTagDesign } from '@growfast/shared-types';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  async getStoreConfig(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        expressSurchargePercent: true,
      },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    return store;
  }

  async updateStoreConfig(storeId: string, updateStoreConfigDto: UpdateStoreConfigDto) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        expressSurchargePercent: updateStoreConfigDto.expressSurchargePercent,
      },
      select: {
        id: true,
        name: true,
        expressSurchargePercent: true,
      },
    });
  }

  async getTagDesign(storeId: string): Promise<TagTemplateDTO> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const template = await this.prisma.tagTemplate.findFirst({
      where: { storeId, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return {
        id: template.id,
        storeId: template.storeId,
        name: template.name,
        version: template.version,
        isActive: template.isActive,
        layout: sanitizeTagDesign(template.layout as any),
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      };
    }

    return {
      id: 'default',
      storeId,
      name: DEFAULT_TAG_DESIGN.name,
      version: 1,
      isActive: true,
      layout: DEFAULT_TAG_DESIGN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateTagDesign(storeId: string, dto: UpdateTagDesignDto): Promise<TagTemplateDTO> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const sanitizedLayout = sanitizeTagDesign(dto.layout);

    const latest = await this.prisma.tagTemplate.findFirst({
      where: { storeId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version || 0) + 1;

    // Deactivate existing active templates
    await this.prisma.tagTemplate.updateMany({
      where: { storeId, isActive: true },
      data: { isActive: false },
    });

    // Create new active template
    const created = await this.prisma.tagTemplate.create({
      data: {
        storeId,
        name: dto.name?.trim() || sanitizedLayout.name || 'Custom 40x40 mm Tag',
        version: nextVersion,
        isActive: true,
        layout: sanitizedLayout as any,
      },
    });

    return {
      id: created.id,
      storeId: created.storeId,
      name: created.name,
      version: created.version,
      isActive: created.isActive,
      layout: sanitizedLayout,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async resetTagDesign(storeId: string): Promise<TagTemplateDTO> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    // Deactivate existing active templates
    await this.prisma.tagTemplate.updateMany({
      where: { storeId, isActive: true },
      data: { isActive: false },
    });

    // Create default active template
    const created = await this.prisma.tagTemplate.create({
      data: {
        storeId,
        name: DEFAULT_TAG_DESIGN.name,
        version: 1,
        isActive: true,
        layout: DEFAULT_TAG_DESIGN as any,
      },
    });

    return {
      id: created.id,
      storeId: created.storeId,
      name: created.name,
      version: created.version,
      isActive: created.isActive,
      layout: DEFAULT_TAG_DESIGN,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}
