import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Authentication Guard.
 * Apply to any route that requires a valid JWT.
 *
 * Usage: @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
