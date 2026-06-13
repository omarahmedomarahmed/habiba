import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getAll(orgId: string) {
    return this.db.query(
      `SELECT id, email, first_name, last_name, role, status, created_at
       FROM users WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [orgId],
    );
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
