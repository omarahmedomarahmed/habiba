import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';

const NOTIF_COLUMNS = [
  'in_app_enabled', 'email_enabled', 'email_session_reminders', 'email_report_ready',
  'email_assessment_due', 'email_payment_events', 'email_marketing', 'email_radar_matches',
  'email_risk_alerts', 'sms_enabled', 'sms_session_reminders', 'sms_radar_matches',
  'sms_verification', 'sms_security_alerts', 'push_enabled', 'push_session_reminders',
  'push_messages', 'push_radar', 'quiet_hours_enabled', 'quiet_start', 'quiet_end', 'timezone',
];

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const user = await this.db.queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(currentPassword || '', user.password_hash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.db.execute(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, userId],
    );
    return { success: true };
  }

  async getNotificationPreferences(userId: string) {
    let row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );
    if (!row) {
      row = await this.db.queryOne<Record<string, unknown>>(
        `INSERT INTO notification_preferences (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [userId],
      );
    }
    return row;
  }

  async updateNotificationPreferences(userId: string, patch: Record<string, unknown>) {
    await this.db.execute(
      `INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    const keys = Object.keys(patch || {}).filter((k) => NOTIF_COLUMNS.includes(k));
    if (keys.length > 0) {
      const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map((k) => {
        const v = patch[k];
        // TIME columns reject empty strings
        if ((k === 'quiet_start' || k === 'quiet_end') && !v) return null;
        return v;
      });
      await this.db.execute(
        `UPDATE notification_preferences SET ${set}, updated_at = NOW() WHERE user_id = $1`,
        [userId, ...values],
      );
    }
    return this.getNotificationPreferences(userId);
  }

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
