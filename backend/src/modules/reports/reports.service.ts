import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async list(orgId: string, query: any = {}) {
    const { patient_id, status, page = 1, limit = 20 } = query;
    const params: any[] = [orgId];
    const where: string[] = ['sr.organization_id = $1'];
    if (patient_id) { params.push(patient_id); where.push(`sr.patient_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`sr.status = $${params.length}`); }
    params.push(limit, (page - 1) * limit);
    return this.db.query(
      `SELECT sr.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM session_reports sr LEFT JOIN patients p ON p.id = sr.patient_id
       WHERE ${where.join(' AND ')} ORDER BY sr.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ).catch(() => []);
  }

  async generate(orgId: string, therapistId: string, dto: any) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await this.db.query(
      `INSERT INTO session_reports (id, organization_id, session_id, therapist_id, patient_id,
         report_type, content, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, orgId, dto.session_id || null, therapistId, dto.patient_id,
       dto.report_type || 'progress', JSON.stringify(dto.content || {}), 'draft', now, now],
    ).catch(() => null);
    return { id, status: 'draft' };
  }

  async sign(id: string, orgId: string) {
    const now = new Date().toISOString();
    await this.db.query(
      `UPDATE session_reports SET status = 'signed', signed_at = $1, updated_at = $1
       WHERE id = $2 AND organization_id = $3`,
      [now, id, orgId],
    ).catch(() => null);
    return { success: true };
  }

  async send(id: string, orgId: string) {
    const now = new Date().toISOString();
    await this.db.query(
      `UPDATE session_reports SET status = 'sent', sent_at = $1, updated_at = $1
       WHERE id = $2 AND organization_id = $3`,
      [now, id, orgId],
    ).catch(() => null);
    return { success: true };
  }
}
