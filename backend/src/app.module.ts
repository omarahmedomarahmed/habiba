import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PhiAuditInterceptor } from './common/interceptors/phi-audit.interceptor';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TherapistsModule } from './modules/therapists/therapists.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AIModule } from './modules/ai/ai.module';
import { RadarModule } from './modules/radar/radar.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { MemoryModule } from './modules/memory/memory.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { MessagesModule } from './modules/messages/messages.module';
import { GatewaysModule } from './gateways/gateways.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import appConfig from './config/app.config';

@Module({
  imports: [
    // ─── Global Config ───────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // ─── Event Emitter (async domain events) ─────────────────────────────────
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // ─── Rate Limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
      },
    ]),

    // ─── Task Scheduling ──────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Database ─────────────────────────────────────────────────────────────
    DatabaseModule,

    // ─── Feature Modules ──────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TherapistsModule,
    PatientsModule,
    SessionsModule,
    AIModule,
    RadarModule,
    BillingModule,
    NotificationsModule,
    MarketplaceModule,
    AnalyticsModule,
    AdminModule,
    AssessmentsModule,
    MemoryModule,
    WorkflowsModule,
    MessagesModule,

    // ─── WebSocket Gateways ───────────────────────────────────────────────────
    GatewaysModule,
  ],
  providers: [
    // Global JWT guard — all routes protected by default
    // Use @Public() decorator to opt-out specific routes
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // HIPAA PHI audit log — fires on every successful PHI route response
    {
      provide: APP_INTERCEPTOR,
      useClass: PhiAuditInterceptor,
    },
  ],
})
export class AppModule {}
