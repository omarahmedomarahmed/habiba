import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security
  app.use(helmet());
  app.use(compression());
  app.use(morgan('combined'));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Slug', 'X-Request-ID'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger docs
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
