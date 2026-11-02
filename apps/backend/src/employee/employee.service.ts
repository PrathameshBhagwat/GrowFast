import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Role, type EmployeeDTO } from '@growfast/shared-types';
import { PhotoStorageService } from '../photo/photo-storage.service';

export interface UserContext {
  id: string;
  role: Role;
  storeId: string;
}

export const STAFF_DOCUMENT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const STAFF_DOCUMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);
  private readonly inFlightDeletions = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly photoStorage?: PhotoStorageService,
  ) {}

  /**
   * Get all employees with store isolation.
   * - MANAGER: Forced to their own store (currentUser.storeId).
   * - OWNER: Can view all stores or filter by specific storeId.
   * Excludes permanently deleted / redacted employees from normal listing.
   * Does NOT expose raw sensitive identity document URLs in list responses (Data Minimization).
   */
  async findAll(
    storeId?: string,
    isActive?: boolean,
    currentUser?: UserContext,
  ): Promise<EmployeeDTO[]> {
    const where: any = {
      isDeleted: false,
    };

    if (currentUser && currentUser.role === Role.MANAGER) {
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

    return employees.map((emp) => this.mapToDTO(emp, false));
  }

  /**
   * Get a single employee by ID with store isolation.
   * Returns complete profile for authorized OWNER/MANAGER viewing and editing.
   */
  async findOne(id: string, currentUser?: UserContext): Promise<EmployeeDTO> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { store: true },
    });

    if (!employee || employee.isDeleted) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    if (
      currentUser &&
      currentUser.role === Role.MANAGER &&
      employee.storeId !== currentUser.storeId
    ) {
      throw new ForbiddenException('Managers can only view employees in their own store');
    }

    return this.mapToDTO(employee, true);
  }

  /**
   * Create a new employee with hashed PIN and optional profile details.
   */
  async create(dto: CreateEmployeeDto, currentUser: UserContext): Promise<EmployeeDTO> {
    // 1. Role Security Check: Manager cannot create Owner
    if (currentUser.role === Role.MANAGER && dto.role === Role.OWNER) {
      throw new ForbiddenException('Managers cannot create Owner accounts');
    }

    // 2. Store Isolation: Manager cannot create employees in another store
    if (currentUser.role === Role.MANAGER && dto.storeId && dto.storeId !== currentUser.storeId) {
      throw new ForbiddenException('Managers cannot create employees for another store');
    }

    // 3. Email uniqueness check if email is provided
    if (dto.email && dto.email.trim()) {
      const existingEmail = await this.prisma.employee.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (existingEmail && !existingEmail.isDeleted) {
        throw new ConflictException(`Employee with email "${dto.email}" already exists`);
      }
    }

    // 4. Resolve Store ID (Managers use currentUser.storeId)
    const targetStoreId =
      currentUser.role === Role.MANAGER ? currentUser.storeId : dto.storeId || currentUser.storeId;

    const store = await this.prisma.store.findUnique({
      where: { id: targetStoreId },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID "${targetStoreId}" not found`);
    }

    // 5. Hash PIN securely
    const pinHash = await bcrypt.hash(dto.pin, 10);

    // 6. Handle Address duplication logic
    const currentAddress = dto.currentAddress ? dto.currentAddress.trim() : null;
    let permanentAddress = dto.permanentAddress ? dto.permanentAddress.trim() : null;
    const sameAsCurrentAddress = Boolean(dto.sameAsCurrentAddress);

    if (sameAsCurrentAddress && currentAddress) {
      permanentAddress = currentAddress;
    }

    // 7. Create Employee with optional profile fields
    const employee = await this.prisma.employee.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        pinHash,
        role: dto.role,
        storeId: targetStoreId,
        isActive: true,
        photoUrl: dto.photoUrl?.trim() || null,
        passportPhotoUrl: dto.passportPhotoUrl?.trim() || null,
        aadhaarFrontUrl: dto.aadhaarFrontUrl?.trim() || null,
        aadhaarBackUrl: dto.aadhaarBackUrl?.trim() || null,
        currentAddress,
        permanentAddress,
        sameAsCurrentAddress,
        isDeleted: false,
      },
      include: { store: true },
    });

    this.logger.log(`Created employee "${employee.name}" (${employee.id}) for store ${targetStoreId}`);
    return this.mapToDTO(employee, true);
  }

  /**
   * Update employee details, role, status, PIN, or optional profile information.
   */
  async update(id: string, dto: UpdateEmployeeDto, currentUser: UserContext): Promise<EmployeeDTO> {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { store: true },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    // Store Isolation: Manager cannot edit employees belonging to another store
    if (currentUser.role === Role.MANAGER && existing.storeId !== currentUser.storeId) {
      throw new ForbiddenException('Managers can only edit employees in their own store');
    }

    // Store Isolation: Manager cannot move an employee to another store
    if (currentUser.role === Role.MANAGER && dto.storeId && dto.storeId !== currentUser.storeId) {
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
        where: { role: Role.OWNER, isActive: true, isDeleted: false },
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
        if (emailConflict && !emailConflict.isDeleted) {
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

    // Profile photos & documents cleanup upon replace/removal
    if (dto.photoUrl !== undefined) {
      const newUrl = dto.photoUrl ? dto.photoUrl.trim() : null;
      if (existing.photoUrl && existing.photoUrl !== newUrl && this.photoStorage) {
        this.photoStorage.delete(existing.photoUrl).catch(() => {});
      }
      updateData.photoUrl = newUrl;
    }

    if (dto.passportPhotoUrl !== undefined) {
      const newUrl = dto.passportPhotoUrl ? dto.passportPhotoUrl.trim() : null;
      if (existing.passportPhotoUrl && existing.passportPhotoUrl !== newUrl && this.photoStorage) {
        this.photoStorage.delete(existing.passportPhotoUrl).catch(() => {});
      }
      updateData.passportPhotoUrl = newUrl;
    }

    if (dto.aadhaarFrontUrl !== undefined) {
      const newUrl = dto.aadhaarFrontUrl ? dto.aadhaarFrontUrl.trim() : null;
      if (existing.aadhaarFrontUrl && existing.aadhaarFrontUrl !== newUrl && this.photoStorage) {
        this.photoStorage.delete(existing.aadhaarFrontUrl).catch(() => {});
      }
      updateData.aadhaarFrontUrl = newUrl;
    }

    if (dto.aadhaarBackUrl !== undefined) {
      const newUrl = dto.aadhaarBackUrl ? dto.aadhaarBackUrl.trim() : null;
      if (existing.aadhaarBackUrl && existing.aadhaarBackUrl !== newUrl && this.photoStorage) {
        this.photoStorage.delete(existing.aadhaarBackUrl).catch(() => {});
      }
      updateData.aadhaarBackUrl = newUrl;
    }

    // Address updates
    if (dto.currentAddress !== undefined) {
      updateData.currentAddress = dto.currentAddress ? dto.currentAddress.trim() : null;
    }

    if (dto.sameAsCurrentAddress !== undefined) {
      updateData.sameAsCurrentAddress = dto.sameAsCurrentAddress;
    }

    const effectiveSameAsCurrent =
      dto.sameAsCurrentAddress !== undefined
        ? dto.sameAsCurrentAddress
        : existing.sameAsCurrentAddress;

    if (effectiveSameAsCurrent) {
      const effectiveCurrentAddress =
        updateData.currentAddress !== undefined ? updateData.currentAddress : existing.currentAddress;
      updateData.permanentAddress = effectiveCurrentAddress;
    } else if (dto.permanentAddress !== undefined) {
      updateData.permanentAddress = dto.permanentAddress ? dto.permanentAddress.trim() : null;
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: { store: true },
    });

    return this.mapToDTO(updated, true);
  }

  /**
   * Permanently delete a staff member.
   *
   * Business & Historical Integrity Strategy:
   * 1. If staff has NO orders, payments, or financial adjustments:
   *    -> Hard-deletes the row entirely from the database.
   * 2. If staff HAS created orders, collected payments, or recorded financial adjustments:
   *    -> Foreign key constraints prevent blind database cascade (which would destroy accounting records).
   *    -> Instead, performs complete account purge and PII redaction:
   *       - Revokes credentials (empty pinHash)
   *       - Frees email and phone (set to null)
   *       - Removes private profile photos, Aadhaar documents, and addresses
   *       - Sets isActive=false, isDeleted=true, deletedAt=now()
   *       - Redacts name to "Deleted Staff (<original>)" so historical records reflect attribution without PII
   * 3. In both cases, permanently removes uploaded private files (photos, Aadhaar images) from storage.
   */
  async remove(
    id: string,
    currentUser: UserContext,
  ): Promise<{ success: boolean; message: string; permanentDeleteType: 'HARD' | 'REDACTED_WITH_HISTORICAL_PRESERVED' }> {
    if (this.inFlightDeletions.has(id)) {
      throw new ConflictException('A deletion operation is already in progress for this staff member');
    }
    this.inFlightDeletions.add(id);

    try {
      const existing = await this.prisma.employee.findUnique({
        where: { id },
      });

      if (!existing || existing.isDeleted) {
        throw new NotFoundException(`Employee with ID "${id}" not found`);
      }

      // Store Isolation: Manager cannot delete employees belonging to another store
      if (currentUser.role === Role.MANAGER && existing.storeId !== currentUser.storeId) {
        throw new ForbiddenException('Managers can only delete employees in their own store');
      }

      // Security Rule 1: Manager cannot delete an Owner account
      if (currentUser.role === Role.MANAGER && existing.role === Role.OWNER) {
        throw new ForbiddenException('Managers cannot delete Owner accounts');
      }

      // Security Rule 2: Employee cannot delete their own account
      if (id === currentUser.id) {
        throw new BadRequestException('You cannot delete your own account');
      }

      // Security Rule 3: Cannot delete the last active Owner
      if (existing.role === Role.OWNER && existing.isActive) {
        const activeOwnerCount = await this.prisma.employee.count({
          where: { role: Role.OWNER, isActive: true, isDeleted: false },
        });
        if (activeOwnerCount <= 1) {
          throw new BadRequestException('Cannot delete the last active Owner');
        }
      }

      // 1. Permanently remove private uploaded files (photos, Aadhaar card images)
      const filesToDelete = [
        existing.photoUrl,
        existing.passportPhotoUrl,
        existing.aadhaarFrontUrl,
        existing.aadhaarBackUrl,
      ].filter(Boolean) as string[];

      if (this.photoStorage && filesToDelete.length > 0) {
        await Promise.allSettled(filesToDelete.map((f) => this.photoStorage!.delete(f)));
      }

      // 2. Unlink optional delivery references
      try {
        if (this.prisma.order?.updateMany) {
          await this.prisma.order.updateMany({
            where: { deliveredById: id },
            data: { deliveredById: null },
          });
        }
        if (this.prisma.deliveryRecord?.updateMany) {
          await this.prisma.deliveryRecord.updateMany({
            where: { riderId: id },
            data: { riderId: null },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to clean up delivery links for employee ${id}: ${err.message}`);
      }

      // 3. Inspect historical foreign key dependencies (Orders created, Payments received, Financial Adjustments)
      const [createdOrdersCount, receivedPaymentsCount, adjustmentsCount] = await Promise.all([
        this.prisma.order?.count ? this.prisma.order.count({ where: { createdById: id } }) : 0,
        this.prisma.payment?.count ? this.prisma.payment.count({ where: { receivedById: id } }) : 0,
        this.prisma.financialAdjustment?.count
          ? this.prisma.financialAdjustment.count({ where: { createdById: id } })
          : 0,
      ]);

      const hasHistoricalRecords =
        createdOrdersCount > 0 || receivedPaymentsCount > 0 || adjustmentsCount > 0;

      if (!hasHistoricalRecords) {
        // Safe to hard delete completely
        await this.prisma.employee.delete({
          where: { id },
        });

        this.logger.log(`Hard deleted employee "${existing.name}" (${id}) with zero historical records`);
        return {
          success: true,
          message: `Staff member "${existing.name}" permanently deleted.`,
          permanentDeleteType: 'HARD',
        };
      }

      // 4. Historical orders or payments exist: Execute comprehensive account purge & PII redaction
      await this.prisma.employee.update({
        where: { id },
        data: {
          name: `Deleted Staff (${existing.name})`,
          phone: null,
          email: null, // Frees the email address
          pinHash: '', // Revokes all credentials
          photoUrl: null,
          passportPhotoUrl: null,
          aadhaarFrontUrl: null,
          aadhaarBackUrl: null,
          currentAddress: null,
          permanentAddress: null,
          sameAsCurrentAddress: false,
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      this.logger.log(
        `Purged and redacted employee "${existing.name}" (${id}) to preserve ${createdOrdersCount} orders and ${receivedPaymentsCount} payments`,
      );

      return {
        success: true,
        message: `Staff member "${existing.name}" permanently deleted. Historical order and financial records preserved.`,
        permanentDeleteType: 'REDACTED_WITH_HISTORICAL_PRESERVED',
      };
    } finally {
      this.inFlightDeletions.delete(id);
    }
  }

  /**
   * Upload an optional staff photograph or sensitive identity document.
   */
  async uploadDocument(
    file: Express.Multer.File,
    storeId: string,
    currentUser: UserContext,
  ): Promise<{ storedUrl: string; accessUrl: string; fileName: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.size > STAFF_DOCUMENT_MAX_SIZE) {
      throw new BadRequestException(
        `File exceeds maximum permitted size of ${STAFF_DOCUMENT_MAX_SIZE / (1024 * 1024)}MB`,
      );
    }

    if (!STAFF_DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed types: JPEG, PNG, WebP, HEIC, PDF.`,
      );
    }

    // Role check: Only OWNER or MANAGER can upload staff documents
    if (currentUser.role !== Role.OWNER && currentUser.role !== Role.MANAGER) {
      throw new ForbiddenException('Only Store Owners and Managers can upload staff documents');
    }

    const effectiveStoreId = currentUser.role === Role.MANAGER ? currentUser.storeId : storeId || currentUser.storeId;

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeUUID = crypto.randomUUID();
    const objectKey = `staff-docs/${effectiveStoreId}/${safeUUID}${ext}`;

    let storedUrl: string;
    let accessUrl: string;

    if (this.photoStorage) {
      storedUrl = await this.photoStorage.store(objectKey, file.buffer, file.mimetype);
      accessUrl = await this.photoStorage.getAccessUrl(storedUrl);
    } else {
      storedUrl = `uploads/photos/${objectKey}`;
      accessUrl = `/api/photos/local/${storedUrl}`;
    }

    return {
      storedUrl,
      accessUrl,
      fileName: file.originalname,
    };
  }

  /**
   * Get an authorized access/preview URL for a staff document.
   */
  async getDocumentAccessUrl(id: string, docType: string, currentUser: UserContext): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee || employee.isDeleted) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    if (currentUser.role === Role.MANAGER && employee.storeId !== currentUser.storeId) {
      throw new ForbiddenException('Managers can only view documents for their own store');
    }

    let rawPath: string | null = null;
    switch (docType) {
      case 'photo':
        rawPath = employee.photoUrl;
        break;
      case 'passport':
        rawPath = employee.passportPhotoUrl;
        break;
      case 'aadhaar-front':
        rawPath = employee.aadhaarFrontUrl;
        break;
      case 'aadhaar-back':
        rawPath = employee.aadhaarBackUrl;
        break;
      default:
        throw new BadRequestException(`Invalid document type: ${docType}`);
    }

    if (!rawPath) {
      throw new NotFoundException(`No document found for type "${docType}"`);
    }

    if (this.photoStorage) {
      return this.photoStorage.getAccessUrl(rawPath);
    }

    return `/api/photos/local/${rawPath}`;
  }

  /**
   * Map database Employee entity to safe shared EmployeeDTO contract.
   * Explicitly strips pinHash. Protects sensitive documents in list views.
   */
  private mapToDTO(emp: any, isDetailed = false): EmployeeDTO {
    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone ?? null,
      email: emp.email ?? null,
      role: emp.role as Role,
      storeId: emp.storeId,
      storeName: emp.store ? emp.store.name : 'Unknown Store',
      isActive: emp.isActive,
      isDeleted: Boolean(emp.isDeleted),
      deletedAt: emp.deletedAt ? (emp.deletedAt instanceof Date ? emp.deletedAt.toISOString() : String(emp.deletedAt)) : null,
      photoUrl: emp.photoUrl ?? null,
      passportPhotoUrl: emp.passportPhotoUrl ?? null,
      // Data Minimization: In general list, sensitive Aadhaar document paths are protected
      aadhaarFrontUrl: isDetailed ? emp.aadhaarFrontUrl ?? null : emp.aadhaarFrontUrl ? '[PROTECTED]' : null,
      aadhaarBackUrl: isDetailed ? emp.aadhaarBackUrl ?? null : emp.aadhaarBackUrl ? '[PROTECTED]' : null,
      currentAddress: emp.currentAddress ?? null,
      permanentAddress: emp.permanentAddress ?? null,
      sameAsCurrentAddress: Boolean(emp.sameAsCurrentAddress),
      createdAt: emp.createdAt instanceof Date ? emp.createdAt.toISOString() : String(emp.createdAt),
      updatedAt: emp.updatedAt instanceof Date ? emp.updatedAt.toISOString() : String(emp.updatedAt),
    };
  }
}
