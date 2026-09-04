import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

export class LoginDto {
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  /**
   * GET /api/auth/directory
   * Public endpoint to get a list of active employees for the login screen.
   */
  @Get('directory')
  async getDirectory() {
    const employees = await this.authService.getDirectory();
    return {
      success: true,
      data: employees,
    };
  }
}
