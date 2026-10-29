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

  // Enable CORS for frontend, LAN, and mobile app clients
  const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (React Native apps, mobile clients, curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        ) ||
        origin.startsWith('exp://')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
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
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(
    `🚀 Backend running on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api (listening on ${host} for mobile/LAN access)`,
  );
}

bootstrap();
