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

        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable is required');
        }

        const pool = new Pool({
          connectionString: databaseUrl,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          max: configService.get<number>('database.maxConnections') || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        pool.on('error', (err) => {
          console.error('Unexpected error on idle client', err);
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
