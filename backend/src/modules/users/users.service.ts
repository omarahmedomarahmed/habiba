import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getAll(
    orgId: string,
    params: { search?: string; role?: string; status?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: any[]; total: number }> {
    const { search, role, status, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let where = `WHERE organization_id = $1 AND deleted_at IS NULL`;
    const queryParams: unknown[] = [orgId];

    if (role) {
      queryParams.push(role);
      where += ` AND role = $${queryParams.length}`;
    }

    if (status) {
      queryParams.push(status);
      where += ` AND status = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const idx = queryParams.length;
      where += ` AND (email ILIKE $${idx} OR first_name ILIKE $${idx} OR last_name ILIKE $${idx})`;
    }

    const countRow = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users ${where}`,
      queryParams,
    );
    const total = parseInt(countRow?.count || '0', 10);

    queryParams.push(limit, offset);
    const data = await this.db.query(
      `SELECT id, email, first_name, last_name, role, status, mfa_enabled,
              email_verified_at, last_login_at, created_at, organization_id
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams,
    );

    return { data, total };
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
