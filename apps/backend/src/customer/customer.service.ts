import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CustomerDTO, CreateCustomerRequest, UpdateCustomerRequest, PaginatedResponse } from '@growfast/shared-types';
import { MembershipTier, RegistrationSource } from '@growfast/shared-types';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new customer record.
   * Performs server-side validation, normalization, duplicate check, and persistence.
   */
  async createCustomer(dto: CreateCustomerRequest): Promise<CustomerDTO> {
    if (!dto) {
      throw new BadRequestException('Customer creation payload is required.');
    }

    // ── 1. Validate Name ───────────────────────────────────────────────
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Customer name is required.');
    }

    // ── 2. Validate Phone ──────────────────────────────────────────────
    const phone = dto.phone?.trim();
    if (!phone) {
      throw new BadRequestException('Customer phone number is required.');
    }

    // Conservative phone validation: 10-15 digits, allowing optional leading +
    const cleanPhoneDigits = phone.replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhoneDigits)) {
      throw new BadRequestException(
        'Invalid phone number format. Must contain 10-15 digits.',
      );
    }

    // ── 3. Validate Email (Optional) ───────────────────────────────────
    const email = dto.email?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email address format.');
    }

    // ── 4. Validate Pincode (Optional) ────────────────────────────────
    const pincode = dto.pincode?.trim() || null;
    if (pincode && !/^[A-Za-z0-9\s\-]{3,10}$/.test(pincode)) {
      throw new BadRequestException('Invalid pincode format.');
    }

    // ── 5. Validate Membership Tier (Optional) ────────────────────────
    let membership = MembershipTier.NONE;
    if (dto.membership) {
      if (!Object.values(MembershipTier).includes(dto.membership as MembershipTier)) {
        throw new BadRequestException(
          `Invalid membership tier. Allowed values: ${Object.values(MembershipTier).join(', ')}`,
        );
      }
      membership = dto.membership as MembershipTier;
    }

    // ── 6. Validate Registration Source (Optional) ────────────────────
    let registrationSource = 'WALK_IN';
    if (dto.registrationSource) {
      if (
        !Object.values(RegistrationSource).includes(
          dto.registrationSource as RegistrationSource,
        )
      ) {
        throw new BadRequestException(
          `Invalid registration source. Allowed values: ${Object.values(RegistrationSource).join(', ')}`,
        );
      }
      registrationSource = dto.registrationSource;
    }

    // ── 7. Validate Discount Percent (Optional) ───────────────────────
    let discountPercent = 0;
    if (dto.discountPercent !== undefined && dto.discountPercent !== null) {
      if (
        typeof dto.discountPercent !== 'number' ||
        isNaN(dto.discountPercent) ||
        dto.discountPercent < 0 ||
        dto.discountPercent > 100
      ) {
        throw new BadRequestException('Discount percent must be a number between 0 and 100.');
      }
      discountPercent = dto.discountPercent;
    }

    // ── 8. Validate Preferences (Optional) ────────────────────────────
    if (
      dto.preferences !== undefined &&
      dto.preferences !== null &&
      (typeof dto.preferences !== 'object' || Array.isArray(dto.preferences))
    ) {
      throw new BadRequestException('Preferences must be a valid key-value object.');
    }

    // ── 9. Duplicate Phone Check ──────────────────────────────────────
    const existing = await this.prisma.customer.findUnique({
      where: { phone: cleanPhoneDigits },
    });

    if (existing) {
      throw new ConflictException(`Customer with phone number '${cleanPhoneDigits}' already exists.`);
    }

    // ── 10. Persistence ───────────────────────────────────────────────
    try {
      const customer = await this.prisma.customer.create({
        data: {
          name,
          phone: cleanPhoneDigits,
          email,
          address: dto.address?.trim() || null,
          pincode,
          membership,
          discountPercent,
          preferences: dto.preferences ?? undefined,
          registrationSource,
        },
      });

      return this.mapToDTO(customer);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `Customer with phone number '${cleanPhoneDigits}' already exists.`,
        );
      }
      throw err;
    }
  }

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
   * Update an existing customer record by ID.
   * Performs partial validation, duplicate phone checking (excluding self), and persistence.
   */
  async updateCustomer(id: string, dto: UpdateCustomerRequest): Promise<CustomerDTO> {
    if (!id || !id.trim()) {
      throw new BadRequestException('Customer ID is required for update.');
    }

    const existingCustomer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      throw new NotFoundException(`Customer with ID '${id}' not found.`);
    }

    if (!dto) {
      return this.mapToDTO(existingCustomer);
    }

    const updateData: any = {};

    // ── 1. Validate Name ───────────────────────────────────────────────
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Customer name cannot be empty.');
      }
      updateData.name = name;
    }

    // ── 2. Validate Phone ──────────────────────────────────────────────
    if (dto.phone !== undefined) {
      const phone = dto.phone.trim();
      if (!phone) {
        throw new BadRequestException('Customer phone number cannot be empty.');
      }

      const cleanPhoneDigits = phone.replace(/[\s\-()]/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(cleanPhoneDigits)) {
        throw new BadRequestException(
          'Invalid phone number format. Must contain 10-15 digits.',
        );
      }

      // Duplicate phone check if phone number is changing
      if (cleanPhoneDigits !== existingCustomer.phone) {
        const phoneConflict = await this.prisma.customer.findUnique({
          where: { phone: cleanPhoneDigits },
        });

        if (phoneConflict) {
          throw new ConflictException(
            `Customer with phone number '${cleanPhoneDigits}' already exists.`,
          );
        }
      }
      updateData.phone = cleanPhoneDigits;
    }

    // ── 3. Validate Email (Optional) ───────────────────────────────────
    if (dto.email !== undefined) {
      const email = dto.email ? dto.email.trim() : null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Invalid email address format.');
      }
      updateData.email = email;
    }

    // ── 4. Validate Address (Optional) ────────────────────────────────
    if (dto.address !== undefined) {
      updateData.address = dto.address ? dto.address.trim() : null;
    }

    // ── 5. Validate Pincode (Optional) ────────────────────────────────
    if (dto.pincode !== undefined) {
      const pincode = dto.pincode ? dto.pincode.trim() : null;
      if (pincode && !/^[A-Za-z0-9\s\-]{3,10}$/.test(pincode)) {
        throw new BadRequestException('Invalid pincode format.');
      }
      updateData.pincode = pincode;
    }

    // ── 6. Validate Membership Tier (Optional) ────────────────────────
    if (dto.membership !== undefined) {
      if (!Object.values(MembershipTier).includes(dto.membership as MembershipTier)) {
        throw new BadRequestException(
          `Invalid membership tier. Allowed values: ${Object.values(MembershipTier).join(', ')}`,
        );
      }
      updateData.membership = dto.membership;
    }

    // ── 7. Validate Registration Source (Optional) ────────────────────
    if (dto.registrationSource !== undefined) {
      if (
        !Object.values(RegistrationSource).includes(
          dto.registrationSource as RegistrationSource,
        )
      ) {
        throw new BadRequestException(
          `Invalid registration source. Allowed values: ${Object.values(RegistrationSource).join(', ')}`,
        );
      }
      updateData.registrationSource = dto.registrationSource;
    }

    // ── 8. Validate Discount Percent (Optional) ───────────────────────
    if (dto.discountPercent !== undefined) {
      if (
        typeof dto.discountPercent !== 'number' ||
        isNaN(dto.discountPercent) ||
        dto.discountPercent < 0 ||
        dto.discountPercent > 100
      ) {
        throw new BadRequestException('Discount percent must be a number between 0 and 100.');
      }
      updateData.discountPercent = dto.discountPercent;
    }

    // ── 9. Validate Preferences (Optional) ────────────────────────────
    if (dto.preferences !== undefined) {
      if (
        dto.preferences !== null &&
        (typeof dto.preferences !== 'object' || Array.isArray(dto.preferences))
      ) {
        throw new BadRequestException('Preferences must be a valid key-value object.');
      }
      updateData.preferences = dto.preferences;
    }

    try {
      const updatedCustomer = await this.prisma.customer.update({
        where: { id },
        data: updateData,
      });

      return this.mapToDTO(updatedCustomer);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `Customer with phone number '${updateData.phone || 'provided'}' already exists.`,
        );
      }
      throw err;
    }
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

