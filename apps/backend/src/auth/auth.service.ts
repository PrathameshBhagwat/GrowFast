import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

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

  /**
   * Authenticate an employee by ID and PIN.
   * Returns a JWT access token and employee summary.
   */
  async login(employeeId: string, pin: string) {
    // Find employee by ID
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { store: true },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if employee is active
    if (!employee.isActive) {
      throw new UnauthorizedException('Account is inactive. Contact your manager.');
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, employee.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
}
