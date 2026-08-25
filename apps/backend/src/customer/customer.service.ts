import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CustomerDTO, PaginatedResponse } from '@growfast/shared-types';
import { MembershipTier } from '@growfast/shared-types';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search customers with support for:
   * - Phone (exact and partial match)
   * - Name (case-insensitive partial match)
   * - Customer ID (exact match)
   * - Pagination (page, pageSize)
   */
  async searchCustomers(
    query?: string,
    pageInput: number | string = 1,
    pageSizeInput: number | string = 10,
  ): Promise<PaginatedResponse<CustomerDTO>> {
    const page = typeof pageInput === 'number' ? pageInput : parseInt(String(pageInput), 10);
    const pageSize =
      typeof pageSizeInput === 'number' ? pageSizeInput : parseInt(String(pageSizeInput), 10);

    if (isNaN(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer starting from 1.');
    }

    if (isNaN(pageSize) || pageSize < 1) {
      throw new BadRequestException('Page size must be a positive integer starting from 1.');
    }

    const safePageSize = Math.min(pageSize, 100); // Max page size limit
    const skip = (page - 1) * safePageSize;

    const trimmedQuery = query?.trim();

    let whereClause: any = {};

    if (trimmedQuery) {
      whereClause = {
        OR: [
          { phone: { contains: trimmedQuery, mode: 'insensitive' } },
          { name: { contains: trimmedQuery, mode: 'insensitive' } },
          { id: { equals: trimmedQuery } },
        ],
      };
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: whereClause,
        skip,
        take: safePageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where: whereClause }),
    ]);

    const data: CustomerDTO[] = customers.map((c: any) => this.mapToDTO(c));

    return {
      success: true,
      data,
      total,
      page,
      pageSize: safePageSize,
    };
  }

  /**
   * Get a single customer by ID.
   */
  async getCustomerById(id: string): Promise<CustomerDTO | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return null;
    }

    return this.mapToDTO(customer);
  }

  /**
   * Map Prisma customer model to shared CustomerDTO contract.
   */
  private mapToDTO(c: any): CustomerDTO {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email ?? null,
      address: c.address ?? null,
      pincode: c.pincode ?? null,
      membership: (c.membership as MembershipTier) || MembershipTier.NONE,
      discountPercent: c.discountPercent ?? 0,
      preferences: c.preferences && typeof c.preferences === 'object' ? c.preferences : null,
      registrationSource: c.registrationSource ?? 'WALK_IN',
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
    };
  }
}
