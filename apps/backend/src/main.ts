import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Ensure root .env is loaded into process.env
try {
  (process as any).loadEnvFile?.();
} catch {
  try {
    (process as any).loadEnvFile?.('../../.env');
  } catch {
    // Ignore if not present or unsupported
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all API routes
  app.setGlobalPrefix('api');

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  if (process.env.HOST) {
    await app.listen(port, process.env.HOST);
  } else {
    await app.listen(port);
  }
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
}

bootstrap();
