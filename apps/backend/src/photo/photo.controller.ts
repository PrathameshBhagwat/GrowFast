import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Response,
  Query,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PhotoService } from './photo.service';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { PHOTO_MAX_FILE_SIZE, PHOTO_UPLOAD_DIR } from './photo.constants';

/**
 * PhotoController — HTTP endpoints for photo upload and retrieval.
 *
 * Endpoints:
 * - POST /api/photos/upload — Upload a photo (multipart/form-data)
 * - GET  /api/orders/:orderId/photos — List photos for an order
 *
 * All endpoints require JWT authentication and role-based authorization.
 * Frontend visibility is NOT authorization — the backend enforces access.
 */
@Controller()
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  /**
   * POST /api/photos/upload
   *
   * Upload a photo associated with an order (and optionally an order item).
   * Accepts multipart/form-data with:
   * - file: the image file
   * - orderId: string (required)
   * - orderItemId: string (optional)
   * - type: PhotoType enum value (required)
   *
   * Roles: OWNER, MANAGER, COUNTER (not DELIVERY — intake photos are counter tasks)
   */
  @Post('photos/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'COUNTER')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PHOTO_MAX_FILE_SIZE },
    }),
  )
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPhotoDto,
    @Request() req: any,
  ) {
    const photo = await this.photoService.uploadPhoto(dto, file, req.user.storeId);
    return {
      success: true,
      data: photo,
    };
  }

  /**
   * GET /api/orders/:orderId/photos
   *
   * Retrieve all photos associated with a given order.
   *
   * Roles: ALL authenticated roles (OWNER, MANAGER, COUNTER, DELIVERY)
   * Delivery riders need to view order photos for identification.
   */
  @Get('orders/:orderId/photos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY')
  async getOrderPhotos(@Param('orderId') orderId: string, @Request() req: any) {
    const photos = await this.photoService.getOrderPhotos(orderId, req.user.storeId);
    return {
      success: true,
      data: photos,
    };
  }

  /**
   * GET /api/photos/local/*
   *
   * Securely serve local storage files using HMAC signature verification.
   * This is used only during local development to avoid exposing the
   * private upload directory statically, while accurately simulating
   * the architecture of presigned object URLs.
   */
  @Get('photos/local/*')
  serveLocalFile(
    @Param('0') urlPath: string,
    @Query('sig') sig: string,
    @Response() res: ExpressResponse,
  ) {
    if (!sig || !urlPath) {
      throw new BadRequestException('Missing signature or path');
    }

    // Verify signature
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    const expectedSig = crypto.createHmac('sha256', secret).update(urlPath).digest('hex');
    if (sig !== expectedSig) {
      throw new UnauthorizedException('Invalid or expired signature');
    }

    // Securely resolve path (prevent traversal)
    // urlPath will be something like "uploads/photos/abc/front.jpg"
    // Since PHOTO_UPLOAD_DIR is already "uploads/photos", we just use urlPath directly
    // but we ensure it remains within the intended root.
    const projectRoot = process.cwd();
    const fullPath = path.resolve(projectRoot, urlPath);
    const expectedRoot = path.resolve(projectRoot, PHOTO_UPLOAD_DIR);

    if (!fullPath.startsWith(expectedRoot)) {
      throw new BadRequestException('Invalid path');
    }

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Photo not found');
    }

    return res.sendFile(fullPath);
  }
}
