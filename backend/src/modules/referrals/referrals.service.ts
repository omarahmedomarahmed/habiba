import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReferralsService {
  constructor(private readonly db: DatabaseService) {}

  async list(orgId: string, query: any = {}) {
    const { patient_id, status, page = 1, limit = 20 } = query;
    const params: any[] = [orgId];
    const where: string[] = ['r.organization_id = $1'];
    if (patient_id) { params.push(patient_id); where.push(`r.patient_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
    params.push(limit, (page - 1) * limit);
    return this.db.query(
      `SELECT r.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM referrals r LEFT JOIN patients p ON p.id = r.patient_id
       WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ).catch(() => []);
  }

  async create(orgId: string, therapistId: string, dto: any) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await this.db.query(
      `INSERT INTO referrals (id, organization_id, patient_id, therapist_id, referred_to_name,
         referred_to_email, referred_to_organization, specialty, reason, urgency, status,
         letter_content, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, orgId, dto.patient_id, therapistId, dto.referred_to_name,
       dto.referred_to_email || null, dto.referred_to_organization || null,
       dto.specialty || null, dto.reason || null, dto.urgency || 'routine',
       'draft', dto.letter_content || null, now, now],
    ).catch(() => null);
    return { id };
  }

  async update(id: string, orgId: string, dto: any) {
    const fields: string[] = [];
    const params: any[] = [];
    for (const f of ['status', 'referred_to_name', 'referred_to_email', 'reason', 'urgency', 'letter_content']) {
      if (dto[f] !== undefined) { params.push(dto[f]); fields.push(`${f} = $${params.length}`); }
    }
    if (!fields.length) return;
    params.push(new Date().toISOString(), id, orgId);
    await this.db.query(
      `UPDATE referrals SET ${fields.join(', ')}, updated_at = $${params.length - 2}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}`,
      params,
    ).catch(() => null);
  }

  async send(id: string, orgId: string) {
    const now = new Date().toISOString();
    await this.db.query(
      `UPDATE referrals SET status = 'sent', sent_at = $1, updated_at = $1
       WHERE id = $2 AND organization_id = $3`,
      [now, id, orgId],
    ).catch(() => null);
    return { success: true };
  }
}
