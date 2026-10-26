import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@growfast/shared-types';

export interface JwtPayload {
  sub: string;
  role: string;
  storeId: string;
  name: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Progressive brute-force protection tracking failed login attempts per employee ID
  private failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

  /**
   * Authenticate an employee by ID and PIN.
   * Returns a JWT access token and employee summary.
   */
  async login(employeeId: string, pin: string) {
    const now = Date.now();
    const failureRecord = this.failedAttempts.get(employeeId);

    // 1. Check active lockout
    if (failureRecord && failureRecord.lockedUntil > now) {
      const remainingSeconds = Math.ceil((failureRecord.lockedUntil - now) / 1000);
      throw new UnauthorizedException(
        `Too many failed attempts. Temporary lockout active. Try again in ${remainingSeconds}s.`,
      );
    }

    // 2. Find employee by ID
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { store: true },
    });

    if (!employee) {
      this.recordFailedAttempt(employeeId, now, failureRecord);
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Check if employee is active
    if (!employee.isActive) {
      throw new UnauthorizedException('Account is inactive. Contact your manager.');
    }

    // 4. Verify PIN
    const isPinValid = await bcrypt.compare(pin, employee.pinHash);
    if (!isPinValid) {
      this.recordFailedAttempt(employeeId, now, failureRecord);
      throw new UnauthorizedException('Invalid credentials');
    }

    // 5. Reset failure tracking on successful authentication
    this.failedAttempts.delete(employeeId);

    // Generate JWT
    const payload: JwtPayload = {
      sub: employee.id,
      role: employee.role,
      storeId: employee.storeId,
      name: employee.name,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        storeId: employee.storeId,
        storeName: employee.store.name,
      },
    };
  }

  /**
   * Validate a JWT payload and return the employee.
   * Used by JwtStrategy.
   */
  async validateJwtPayload(payload: JwtPayload) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
    });

    if (!employee || !employee.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      storeId: employee.storeId,
    };
  }

  /**
   * GET a public directory of active employees for the login screen.
   * Excludes sensitive data like PINs, emails, and phones.
   * Optionally filters by specific employee roles (e.g. OWNER, COUNTER).
   */
  async getDirectory(roles?: (Role | string)[]) {
    const targetRoles = roles && roles.length > 0 ? (roles as Role[]) : [Role.OWNER, Role.COUNTER];

    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        role: { in: targetRoles },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return employees;
  }

  private recordFailedAttempt(
    employeeId: string,
    now: number,
    existing?: { count: number; lockedUntil: number },
  ) {
    const isPreviousLockExpired = existing && existing.lockedUntil <= now;
    const currentFailures = (isPreviousLockExpired ? 0 : existing?.count || 0) + 1;
    if (currentFailures >= 5) {
      this.failedAttempts.set(employeeId, {
        count: currentFailures,
        lockedUntil: now + 60000, // 60s temporary lockout
      });
    } else {
      this.failedAttempts.set(employeeId, {
        count: currentFailures,
        lockedUntil: 0,
      });
    }
  }
}
