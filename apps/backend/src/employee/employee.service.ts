import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Role, type EmployeeDTO } from '@growfast/shared-types';

export interface UserContext {
  id: string;
  role: Role;
  storeId: string;
}

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all employees with store isolation.
   * - MANAGER: Forced to their own store (currentUser.storeId).
   * - OWNER: Can view all stores or filter by specific storeId.
   * Returns sanitized DTOs (never exposes pinHash).
   */
  async findAll(
    storeId?: string,
    isActive?: boolean,
    currentUser?: UserContext,
  ): Promise<EmployeeDTO[]> {
    const where: any = {};

    if (currentUser && currentUser.role === Role.MANAGER) {
      // Store Isolation: Manager is strictly bound to their assigned store
      where.storeId = currentUser.storeId;
    } else if (storeId) {
      where.storeId = storeId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: { store: true },
      orderBy: { createdAt: 'desc' },
    });

    return employees.map((emp) => this.mapToDTO(emp));
  }

  /**
   * Get a single employee by ID with store isolation.
   */
  async findOne(id: string, currentUser?: UserContext): Promise<EmployeeDTO> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { store: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    // Store Isolation: Manager cannot view employees from another store
    if (currentUser && currentUser.role === Role.MANAGER && employee.storeId !== currentUser.storeId) {
      throw new ForbiddenException('Managers can only view employees in their own store');
    }

    return this.mapToDTO(employee);
  }

  /**
   * Create a new employee with hashed PIN and store isolation.
   */
  async create(dto: CreateEmployeeDto, currentUser: UserContext): Promise<EmployeeDTO> {
    // 1. Role Security Check: Manager cannot create Owner
    if (currentUser.role === Role.MANAGER && dto.role === Role.OWNER) {
      throw new ForbiddenException('Managers cannot create Owner accounts');
    }

    // 2. Store Isolation: Manager cannot create employees in another store
    if (
      currentUser.role === Role.MANAGER &&
      dto.storeId &&
      dto.storeId !== currentUser.storeId
    ) {
      throw new ForbiddenException('Managers cannot create employees for another store');
    }

    // 3. Email uniqueness check if email is provided
    if (dto.email && dto.email.trim()) {
      const existingEmail = await this.prisma.employee.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (existingEmail) {
        throw new ConflictException(`Employee with email "${dto.email}" already exists`);
      }
    }

    // 4. Resolve Store ID (Managers use currentUser.storeId)
    const targetStoreId =
      currentUser.role === Role.MANAGER
        ? currentUser.storeId
        : dto.storeId || currentUser.storeId;

    const store = await this.prisma.store.findUnique({
      where: { id: targetStoreId },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID "${targetStoreId}" not found`);
    }

    // 5. Hash PIN securely
    const pinHash = await bcrypt.hash(dto.pin, 10);

    // 6. Create Employee
    const employee = await this.prisma.employee.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        pinHash,
        role: dto.role,
        storeId: targetStoreId,
        isActive: true,
      },
      include: { store: true },
    });

    return this.mapToDTO(employee);
  }

  /**
   * Update employee details, role, status, or PIN with store isolation & security rules.
   */
  async update(
    id: string,
    dto: UpdateEmployeeDto,
    currentUser: UserContext,
  ): Promise<EmployeeDTO> {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { store: true },
    });

    if (!existing) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    // Store Isolation: Manager cannot edit employees belonging to another store
    if (currentUser.role === Role.MANAGER && existing.storeId !== currentUser.storeId) {
      throw new ForbiddenException('Managers can only edit employees in their own store');
    }

    // Store Isolation: Manager cannot move an employee to another store
    if (
      currentUser.role === Role.MANAGER &&
      dto.storeId &&
      dto.storeId !== currentUser.storeId
    ) {
      throw new ForbiddenException('Managers cannot move employees to another store');
    }

    // Security Rule 1: Manager cannot modify an Owner account or promote anyone to Owner
    if (currentUser.role === Role.MANAGER) {
      if (existing.role === Role.OWNER || dto.role === Role.OWNER) {
        throw new ForbiddenException('Managers cannot create or edit Owner accounts');
      }
    }

    // Security Rule 2: Employee cannot deactivate their own account
    if (id === currentUser.id && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    // Security Rule 3: Employee cannot change their own role
    if (id === currentUser.id && dto.role !== undefined && dto.role !== currentUser.role) {
      throw new BadRequestException('You cannot change your own role');
    }

    // Security Rule 4: Cannot deactivate or demote the last active Owner
    if (
      existing.role === Role.OWNER &&
      (dto.isActive === false || (dto.role !== undefined && dto.role !== Role.OWNER))
    ) {
      const activeOwnerCount = await this.prisma.employee.count({
        where: { role: Role.OWNER, isActive: true },
      });
      if (activeOwnerCount <= 1) {
        throw new BadRequestException('Cannot deactivate or demote the last active Owner');
      }
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Employee name cannot be empty');
      updateData.name = name;
    }

    if (dto.phone !== undefined) {
      updateData.phone = dto.phone ? dto.phone.trim() : null;
    }

    if (dto.email !== undefined) {
      const email = dto.email ? dto.email.trim().toLowerCase() : null;
      if (email && email !== existing.email) {
        const emailConflict = await this.prisma.employee.findUnique({
          where: { email },
        });
        if (emailConflict) {
          throw new ConflictException(`Employee with email "${email}" already exists`);
        }
      }
      updateData.email = email;
    }

    if (dto.role !== undefined) {
      updateData.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.pin && dto.pin.trim()) {
      updateData.pinHash = await bcrypt.hash(dto.pin.trim(), 10);
    }

    if (dto.storeId !== undefined && dto.storeId !== existing.storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
      if (!store) throw new NotFoundException(`Store with ID "${dto.storeId}" not found`);
      updateData.storeId = dto.storeId;
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: { store: true },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Map database Employee entity to safe shared EmployeeDTO contract.
   * Explicitly strips pinHash from response.
   */
  private mapToDTO(emp: any): EmployeeDTO {
    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone ?? null,
      email: emp.email ?? null,
      role: emp.role as Role,
      storeId: emp.storeId,
      storeName: emp.store ? emp.store.name : 'Unknown Store',
      isActive: emp.isActive,
      createdAt: emp.createdAt instanceof Date ? emp.createdAt.toISOString() : String(emp.createdAt),
      updatedAt: emp.updatedAt instanceof Date ? emp.updatedAt.toISOString() : String(emp.updatedAt),
    };
  }
}
