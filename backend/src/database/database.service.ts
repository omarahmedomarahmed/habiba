import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { DATABASE_POOL } from './database.constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DatabaseService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result: QueryResult<T> = await this.pool.query(sql, params);
    return result.rows;
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(sql, params);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  generateId(): string {
    return uuidv4();
  }

  // Build WHERE clause for multi-tenant scoping
  buildOrgFilter(organizationId: string, alias = ''): string {
    const prefix = alias ? `${alias}.` : '';
    return `${prefix}organization_id = '${organizationId}'`;
  }

  // Paginate helper
  buildPaginationClause(limit = 20, cursor?: string, orderBy = 'created_at DESC'): {
    sql: string;
    params: any[];
  } {
    const params: any[] = [limit];
    let sql = `ORDER BY ${orderBy} LIMIT $1`;

    if (cursor) {
      params.push(cursor);
      sql = `AND created_at < (SELECT created_at FROM (SELECT created_at FROM <table> WHERE id = $${params.length}) sub) ${sql}`;
    }

    return { sql, params };
  }
}
