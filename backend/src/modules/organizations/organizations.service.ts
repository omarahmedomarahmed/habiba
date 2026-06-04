import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DatabaseService) {}

  async findOne(id: string) {
    const org = await this.db.queryOne('SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async getSettings(orgId: string) {
    return this.db.queryOne('SELECT * FROM organization_settings WHERE organization_id = $1', [orgId]);
  }

  async updateSettings(orgId: string, settings: any) {
    return this.db.queryOne(
      `UPDATE organization_settings SET branding_settings = COALESCE($1, branding_settings),
       ai_settings = COALESCE($2, ai_settings), notification_settings = COALESCE($3, notification_settings),
       updated_at = NOW() WHERE organization_id = $4 RETURNING *`,
      [JSON.stringify(settings.branding), JSON.stringify(settings.ai), JSON.stringify(settings.notifications), orgId],
    );
  }

  async getStats(orgId: string) {
    const [therapists, patients, sessions] = await Promise.all([
      this.db.queryOne<any>('SELECT COUNT(*) as count FROM therapists WHERE organization_id = $1 AND deleted_at IS NULL', [orgId]),
      this.db.queryOne<any>('SELECT COUNT(*) as count FROM patients WHERE organization_id = $1 AND deleted_at IS NULL', [orgId]),
      this.db.queryOne<any>('SELECT COUNT(*) as count FROM sessions WHERE organization_id = $1 AND status = \'completed\'', [orgId]),
    ]);
    return { therapists: parseInt(therapists?.count||'0'), patients: parseInt(patients?.count||'0'), sessions: parseInt(sessions?.count||'0') };
  }
}
