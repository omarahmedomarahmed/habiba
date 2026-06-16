import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CrmService {
  constructor(private readonly db: DatabaseService) {}

  async listLeads(orgId: string, params: any) {
    const { stage, search, limit = 20, offset = 0 } = params;
    const where = [`organization_id = $1`, `deleted_at IS NULL`];
    const values: any[] = [orgId];

    if (stage) {
      values.push(stage);
      where.push(`stage = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      where.push(`(name ILIKE $${values.length} OR email ILIKE $${values.length})`);
    }

    const baseWhere = where.join(' AND ');
    const countRow = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM crm_leads WHERE ${baseWhere}`,
      values,
    ).catch(() => ({ count: '0' }));

    values.push(Number(limit), Number(offset));
    const data = await this.db.query(
      `SELECT * FROM crm_leads WHERE ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    ).catch(() => []);

    return { data, total: parseInt(countRow?.count ?? '0', 10) };
  }

  async getLead(id: string, orgId: string) {
    const lead = await this.db.queryOne(
      `SELECT * FROM crm_leads WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, orgId],
    );
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async createLead(
    orgId: string,
    dto: {
      name: string;
      email?: string;
      phone?: string;
      stage?: string;
      source?: string;
      notes?: string;
    },
  ) {
    return this.db.queryOne(
      `INSERT INTO crm_leads (organization_id, name, email, phone, stage, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        orgId,
        dto.name,
        dto.email ?? null,
        dto.phone ?? null,
        dto.stage ?? 'new',
        dto.source ?? null,
        dto.notes ?? null,
      ],
    );
  }

  async updateLead(id: string, orgId: string, dto: any) {
    const allowed = ['name', 'email', 'phone', 'stage', 'source', 'notes'];
    const sets: string[] = [];
    const values: any[] = [id, orgId];

    for (const k of allowed) {
      if (dto[k] !== undefined) {
        values.push(dto[k]);
        sets.push(`${k} = $${values.length}`);
      }
    }

    if (!sets.length) return this.getLead(id, orgId);

    values.push(new Date().toISOString());
    sets.push(`updated_at = $${values.length}`);

    const lead = await this.db.queryOne(
      `UPDATE crm_leads SET ${sets.join(', ')}
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      values,
    );
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async getPipelineStats(orgId: string) {
    return this.db.query(
      `SELECT stage, COUNT(*) AS count
       FROM crm_leads
       WHERE organization_id = $1 AND deleted_at IS NULL
       GROUP BY stage`,
      [orgId],
    ).catch(() => []);
  }

  async getAnalytics(orgId: string, period = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    return this.db.queryOne(
      `SELECT
         COUNT(*) AS total_leads,
         COUNT(*) FILTER (WHERE stage = 'closed_won') AS won,
         COUNT(*) FILTER (WHERE stage = 'closed_lost') AS lost,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${days} days') AS new_this_period
       FROM crm_leads
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId],
    ).catch(() => ({ total_leads: 0, won: 0, lost: 0, new_this_period: 0 }));
  }
}
