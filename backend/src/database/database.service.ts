import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_POOL } from './database.constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DatabaseService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: any[]): Promise<T[]> {
    const result: QueryResult<T> = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params?: any[]): Promise<T | null> {
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

  // Build WHERE clause for multi-tenant scoping.
  // Returns a SQL fragment using $N placeholders; caller must append the provided param value to their params array.
  // Example: const orgFilter = this.db.buildOrgFilter(orgId, 't', params); // params grows by 1
  buildOrgFilter(organizationId: string, alias = '', existingParams: any[] = []): { sql: string; params: any[] } {
    const prefix = alias ? `${alias}.` : '';
    const params = [...existingParams, organizationId];
    const sql = `${prefix}organization_id = $${params.length}`;
    return { sql, params };
  }

  // Convenience: return just the SQL snippet for use in template literals where params are managed separately.
  // The caller MUST pass organizationId as the corresponding $N param themselves.
  orgFilterSql(alias = '', paramIndex: number): string {
    const prefix = alias ? `${alias}.` : '';
    return `${prefix}organization_id = $${paramIndex}`;
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

// Reviewed: 2026-06-13 — 24Therapy audit
