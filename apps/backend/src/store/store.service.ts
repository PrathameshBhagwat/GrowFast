import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStoreConfigDto } from './dto/update-store-config.dto';

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
}
