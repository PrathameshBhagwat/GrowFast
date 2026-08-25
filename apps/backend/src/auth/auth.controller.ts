import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

import { IsString, IsNotEmpty } from 'class-validator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  pin!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Authenticate with employee ID + PIN, receive JWT.
   */
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.employeeId, body.pin);
  }

  /**
   * GET /api/auth/me
   * Returns the current authenticated employee's info.
   * Protected by JWT.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: any) {
    return {
      success: true,
      data: req.user,
    };
  }

  /**
   * GET /api/auth/admin-test
   * Test endpoint — only OWNER and MANAGER can access.
   */
  @Get('admin-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  adminTest(@Request() req: any) {
    return {
      success: true,
      message: `Hello ${req.user.name}, you have admin access.`,
      role: req.user.role,
    };
  }
}
