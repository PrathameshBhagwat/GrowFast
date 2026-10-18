import { Injectable, NotFoundException, BadRequestException, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStoreConfigDto } from './dto/update-store-config.dto';
import { UpdateTagDesignDto } from './dto/update-tag-design.dto';
import {
  TagTemplateDTO,
  REFERENCE_TAG_DESIGN,
  sanitizeTagDesign,
  DEFAULT_TOP_UP_SERVICES,
  TopUpServiceItem,
  TagDesignAuditEntry,
} from '@growfast/shared-types';
import * as fs from 'fs';
import * as path from 'path';

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
        topUpServices: true,
      },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    return {
      ...store,
      topUpServices: (store.topUpServices as any) ?? DEFAULT_TOP_UP_SERVICES,
    };
  }

  async updateStoreConfig(storeId: string, updateStoreConfigDto: UpdateStoreConfigDto) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const data: any = {};
    if (updateStoreConfigDto.expressSurchargePercent !== undefined) {
      data.expressSurchargePercent = updateStoreConfigDto.expressSurchargePercent;
    }

    if (updateStoreConfigDto.topUpServices !== undefined) {
      if (!Array.isArray(updateStoreConfigDto.topUpServices)) {
        throw new BadRequestException('Top up services must be an array');
      }

      const validated: TopUpServiceItem[] = [];
      for (const item of updateStoreConfigDto.topUpServices) {
        if (!item || typeof item.name !== 'string' || item.name.trim().length === 0) {
          throw new BadRequestException('Each top up service must have a valid name');
        }
        if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) {
          throw new BadRequestException(
            `Invalid price for top up service "${item.name}". Price must be a non-negative number.`,
          );
        }
        validated.push({
          id: item.id || `addon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: item.name.trim(),
          price: Number(item.price.toFixed(2)),
          description: item.description ? String(item.description).trim() : undefined,
        });
      }
      data.topUpServices = validated;
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data,
      select: {
        id: true,
        name: true,
        expressSurchargePercent: true,
        topUpServices: true,
      },
    });

    return {
      ...updated,
      topUpServices: (updated.topUpServices as any) ?? DEFAULT_TOP_UP_SERVICES,
    };
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
      name: REFERENCE_TAG_DESIGN.name,
      version: 1,
      isActive: true,
      layout: REFERENCE_TAG_DESIGN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateTagDesign(
    storeId: string,
    dto: UpdateTagDesignDto,
    user?: any,
  ): Promise<TagTemplateDTO> {
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

    const now = new Date().toISOString();
    const updaterInfo = user
      ? { id: user.id, name: user.name || 'Owner', email: user.email || null }
      : { id: 'owner', name: 'Owner', email: null };

    sanitizedLayout.lastUpdatedBy = updaterInfo;
    sanitizedLayout.lastUpdatedAt = now;

    // Create immutable audit entry
    const newAuditEntry: TagDesignAuditEntry = {
      version: nextVersion,
      updatedAt: now,
      updatedById: updaterInfo.id,
      updatedByName: updaterInfo.name,
      updatedByEmail: updaterInfo.email,
      changesSummary: `Updated tag design to version ${nextVersion} (dimensions: ${sanitizedLayout.width || '1.5 in'} × ${sanitizedLayout.height || '1.5 in'}, printer: ${sanitizedLayout.printer || 'TSC TE244'})`,
    };

    const previousAudits: TagDesignAuditEntry[] = Array.isArray(
      (latest?.layout as any)?.auditHistory,
    )
      ? (latest!.layout as any).auditHistory
      : [];
    sanitizedLayout.auditHistory = [newAuditEntry, ...previousAudits].slice(0, 50);

    // Save atomically: deactivate old active templates and insert new active version in a transaction
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.tagTemplate.updateMany({
        where: { storeId, isActive: true },
        data: { isActive: false },
      });

      return await tx.tagTemplate.create({
        data: {
          storeId,
          name: dto.name?.trim() || sanitizedLayout.name || 'Standard 1.5×1.5 in Tag',
          version: nextVersion,
          isActive: true,
          layout: sanitizedLayout as any,
        },
      });
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

  async resetTagDesign(storeId: string, user?: any): Promise<TagTemplateDTO> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    const defaultLayout = { ...REFERENCE_TAG_DESIGN };
    const now = new Date().toISOString();
    const updaterInfo = user
      ? { id: user.id, name: user.name || 'Owner', email: user.email || null }
      : { id: 'owner', name: 'Owner', email: null };

    defaultLayout.lastUpdatedBy = updaterInfo;
    defaultLayout.lastUpdatedAt = now;

    const latest = await this.prisma.tagTemplate.findFirst({
      where: { storeId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version || 0) + 1;

    const newAuditEntry: TagDesignAuditEntry = {
      version: nextVersion,
      updatedAt: now,
      updatedById: updaterInfo.id,
      updatedByName: updaterInfo.name,
      updatedByEmail: updaterInfo.email,
      changesSummary: `Reset tag design layout back to canonical reference default`,
    };

    const previousAudits: TagDesignAuditEntry[] = Array.isArray(
      (latest?.layout as any)?.auditHistory,
    )
      ? (latest!.layout as any).auditHistory
      : [];
    defaultLayout.auditHistory = [newAuditEntry, ...previousAudits].slice(0, 50);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.tagTemplate.updateMany({
        where: { storeId, isActive: true },
        data: { isActive: false },
      });

      return await tx.tagTemplate.create({
        data: {
          storeId,
          name: REFERENCE_TAG_DESIGN.name,
          version: nextVersion,
          isActive: true,
          layout: defaultLayout as any,
        },
      });
    });

    return {
      id: created.id,
      storeId: created.storeId,
      name: created.name,
      version: created.version,
      isActive: created.isActive,
      layout: defaultLayout,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async getTagDesignHistory(storeId: string) {
    const templates = await this.prisma.tagTemplate.findMany({
      where: { storeId },
      orderBy: { version: 'desc' },
      take: 20,
    });

    return templates.map((t) => {
      const layout = t.layout as any;
      return {
        id: t.id,
        version: t.version,
        name: t.name,
        isActive: t.isActive,
        updatedAt: t.updatedAt.toISOString(),
        updatedBy: layout?.lastUpdatedBy || { name: 'Owner' },
        width: layout?.width || '1.5 in',
        height: layout?.height || '1.5 in',
        printer: layout?.printer || 'TSC TE244',
        fieldsCount: layout?.fields?.length || 0,
        enabledFieldsCount: (layout?.fields || []).filter((f: any) => f.enabled).length,
      };
    });
  }

  getFontFile(fileName: string): StreamableFile {
    const safeName = path.basename(fileName);
    const fontPath = path.resolve(__dirname, '../../assets/fonts', safeName);

    if (fs.existsSync(fontPath)) {
      const fileStream = fs.createReadStream(fontPath);
      return new StreamableFile(fileStream);
    }

    // Fallback: minimal valid TTF buffer
    const buf = Buffer.alloc(1024);
    buf.writeUInt32BE(0x00010000, 0);
    return new StreamableFile(buf);
  }
}
