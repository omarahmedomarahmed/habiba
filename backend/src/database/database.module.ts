import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';
import { DATABASE_POOL } from './database.constants';

export { DATABASE_POOL };

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('database.url');
        const ssl = configService.get<boolean>('database.ssl');

        // ── Startup guard — surface ALL missing required env vars at once ──
        // This prevents multiple crash-restart cycles on first deploy.
        const missing: string[] = [];
        if (!databaseUrl) missing.push('DATABASE_URL');

        if (missing.length > 0) {
          const varList = missing.map((v) => `  • ${v}`).join('\n');
          throw new Error(
            `\n\n❌ 24Therapy API — missing required environment variables:\n${varList}\n\n` +
            `Set DATABASE_URL from Neon (neon.tech) → your project → Connection String.\n` +
            `Then add all required vars to your deployment platform (Railway → Variables).\n` +
            `See backend/.env.example for all required and optional variables.\n`,
          );
        }

        const pool = new Pool({
          connectionString: databaseUrl!,
          // Railway Postgres / Neon require SSL; set DATABASE_SSL=true in env
          ssl: ssl ? { rejectUnauthorized: false } : false,
          max: configService.get<number>('database.maxConnections') || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err: Error) => {
          console.error('Unexpected error on idle PostgreSQL client', err);
        });

        pool.on('connect', () => {
          console.log('✅ PostgreSQL connected');
        });

        return pool;
      },
    },
    DatabaseService,
  ],
  exports: [DATABASE_POOL, DatabaseService],
})
export class DatabaseModule {}

// Reviewed: 2026-06-13 — 24Therapy audit
