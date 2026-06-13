import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { buildCorsOriginFn } from './config/cors';

// Use require() for CommonJS modules that lack proper ESModule default exports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression') as () => any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const morgan = require('morgan') as (format: string) => any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security
  app.use(helmet());
  app.use(compression());
  app.use(morgan('combined'));

  // CORS — production: exact CORS_ORIGINS list only; dev: broad defaults
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: buildCorsOriginFn(isProd),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Slug', 'X-Request-ID'],
  });

  // Global prefix (applied AFTER health route so /health stays at root)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'], // Public health check at GET /health
  });

  // Public health check endpoint (used by Railway/Render/ALB)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      service: '24therapy-api',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger docs (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('24Therapy.ai API')
      .setDescription('AI-Native Mental Health Operating System — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & Authorization')
      .addTag('patients', 'Patient Management')
      .addTag('therapists', 'Therapist Profiles & Availability')
      .addTag('sessions', 'Session Lifecycle')
      .addTag('ai', 'AI Scribe, Copilot & Memory')
      .addTag('radar', 'Instant Therapist Matching')
      .addTag('billing', 'Subscriptions & Payments')
      .addTag('marketplace', 'Therapist Directory')
      .addTag('analytics', 'Platform Analytics')
      .addTag('admin', 'Admin Operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log('📚 Swagger docs available at: http://localhost:4000/api/docs');
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 24Therapy.ai API running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API: http://localhost:${port}/api/v1`);
}

bootstrap();

// Reviewed: 2026-06-13 — 24Therapy audit
