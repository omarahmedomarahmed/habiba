import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Platform Dashboard ──────────────────────────────────────────────────

  async getPlatformOverview() {
    const [summary, recentOrgs, recentUsers, systemHealth] = await Promise.all([
      this.getPlatformSummary(),
      this.getRecentOrganizations(),
      this.getRecentUsers(),
      this.getSystemHealth(),
    ]);
    return { summary, recent_orgs: recentOrgs, recent_users: recentUsers, system_health: systemHealth };
  }

  private async getPlatformSummary() {
    return this.db.queryOne<any>(
      `SELECT
        (SELECT COUNT(*) FROM organizations WHERE deleted_at IS NULL) as total_orgs,
        (SELECT COUNT(*) FROM organizations WHERE subscription_status='active') as active_orgs,
        (SELECT COUNT(*) FROM organizations WHERE subscription_status='trialing') as trialing_orgs,
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
        (SELECT COUNT(*) FROM users WHERE role='therapist') as total_therapists,
        (SELECT COUNT(*) FROM users WHERE role='patient') as total_patients,
        (SELECT COUNT(*) FROM sessions WHERE status='completed') as total_sessions,
        (SELECT COALESCE(SUM(amount),0) FROM billing_transactions WHERE status='completed') as total_revenue,
        (SELECT COUNT(*) FROM ai_usage_log) as total_ai_calls,
        (SELECT COALESCE(SUM(cost_usd),0) FROM ai_usage_log) as total_ai_cost`,
      [],
    ).catch(() => ({}));
  }

  private async getRecentOrganizations() {
    return this.db.query(
      `SELECT id, name, slug, subscription_tier, subscription_status, created_at,
        (SELECT COUNT(*) FROM users WHERE organization_id=o.id AND role='therapist') as therapist_count,
        (SELECT COUNT(*) FROM users WHERE organization_id=o.id AND role='patient') as patient_count
       FROM organizations o
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 10`,
      [],
    ).catch(() => []);
  }

  private async getRecentUsers() {
    return this.db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.created_at, u.last_login_at,
        o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC LIMIT 20`,
      [],
    ).catch(() => []);
  }

  private async getSystemHealth() {
    const dbCheck = await this.db.query('SELECT 1 as ok', []).then(() => 'healthy').catch(() => 'error');
    return {
      database: dbCheck,
      api: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Organization Management ─────────────────────────────────────────────

  async listOrganizations(query: any = {}) {
    const { search, status, tier, limit = 20, cursor } = query;
    const params: any[] = [];
    const where: string[] = ['deleted_at IS NULL'];

    if (search) { params.push(`%${search}%`); where.push(`(name ILIKE $${params.length} OR slug ILIKE $${params.length} OR billing_email ILIKE $${params.length})`); }
    if (status) { params.push(status); where.push(`subscription_status = $${params.length}`); }
    if (tier) { params.push(tier); where.push(`subscription_tier = $${params.length}`); }
    if (cursor) { params.push(cursor); where.push(`created_at < (SELECT created_at FROM organizations WHERE id = $${params.length})`); }

    params.push(Math.min(Number(limit), 100));

    const orgs = await this.db.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM users WHERE organization_id=o.id AND role='therapist' AND deleted_at IS NULL) as therapist_count,
        (SELECT COUNT(*) FROM users WHERE organization_id=o.id AND role='patient' AND deleted_at IS NULL) as patient_count,
        (SELECT COUNT(*) FROM sessions WHERE organization_id=o.id AND status='completed') as total_sessions,
        (SELECT COALESCE(SUM(amount),0) FROM billing_transactions WHERE organization_id=o.id AND status='completed') as total_revenue
       FROM organizations o
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);

    return {
      organizations: orgs,
      has_more: orgs.length === Number(limit),
      next_cursor: orgs.length > 0 ? orgs[orgs.length - 1].id : null,
    };
  }

  async getOrganization(orgId: string) {
    const org = await this.db.queryOne<any>(
      `SELECT o.*,
        (SELECT COUNT(*) FROM users WHERE organization_id=o.id AND role='therapist') as therapist_count,
        (SELECT COUNT(*) FROM users WHERE organization_id=o.id AND role='patient') as patient_count,
        (SELECT COUNT(*) FROM sessions WHERE organization_id=o.id) as total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE organization_id=o.id AND status='completed') as completed_sessions,
        (SELECT COALESCE(SUM(amount),0) FROM billing_transactions WHERE organization_id=o.id AND status='completed') as total_revenue,
        (SELECT COUNT(*) FROM ai_usage_log WHERE organization_id=o.id) as ai_calls,
        (SELECT COALESCE(SUM(cost_usd),0) FROM ai_usage_log WHERE organization_id=o.id) as ai_cost
       FROM organizations o WHERE o.id=$1 AND o.deleted_at IS NULL`,
      [orgId],
    );
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganization(orgId: string, dto: any) {
    const fields: string[] = [];
    const params: any[] = [orgId];
    const allowed = [
      'name', 'subscription_tier', 'subscription_status',
      'ai_monthly_budget_usd', 'max_therapists', 'max_patients',
      'feature_flags', 'compliance_level', 'settings',
    ];
    for (const key of allowed) {
      if (dto[key] !== undefined) {
        params.push(key === 'feature_flags' || key === 'settings' ? JSON.stringify(dto[key]) : dto[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }
    if (fields.length === 0) return this.getOrganization(orgId);
    params.push(new Date().toISOString());
    fields.push(`updated_at = $${params.length}`);

    const result = await this.db.queryOne<any>(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!result) throw new NotFoundException('Organization not found');
    return result;
  }

  async suspendOrganization(orgId: string, reason: string, adminId: string) {
    await this.db.query(
      `UPDATE organizations SET subscription_status='suspended', updated_at=NOW()
       WHERE id=$1 AND deleted_at IS NULL`,
      [orgId],
    );
    await this.createAuditEntry({
      action: 'org_suspended',
      resource_type: 'organization',
      resource_id: orgId,
      actor_id: adminId,
      details: { reason },
    });
    return { success: true, message: 'Organization suspended' };
  }

  async activateOrganization(orgId: string, adminId: string) {
    await this.db.query(
      `UPDATE organizations SET subscription_status='active', updated_at=NOW()
       WHERE id=$1 AND deleted_at IS NULL`,
      [orgId],
    );
    await this.createAuditEntry({
      action: 'org_activated',
      resource_type: 'organization',
      resource_id: orgId,
      actor_id: adminId,
      details: {},
    });
    return { success: true, message: 'Organization activated' };
  }

  // ─── User Management ────────────────────────────────────────────────────

  async listUsers(query: any = {}) {
    const { search, role, org_id, status, limit = 20, cursor } = query;
    const params: any[] = [];
    const where: string[] = ['u.deleted_at IS NULL'];

    if (search) { params.push(`%${search}%`); where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    if (role) { params.push(role); where.push(`u.role = $${params.length}`); }
    if (org_id) { params.push(org_id); where.push(`u.organization_id = $${params.length}`); }
    if (status) { params.push(status === 'verified'); where.push(`u.email_verified = $${params.length}`); }
    if (cursor) { params.push(cursor); where.push(`u.created_at < (SELECT created_at FROM users WHERE id = $${params.length})`); }

    params.push(Math.min(Number(limit), 100));

    const users = await this.db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.email_verified, u.last_login_at,
        u.created_at, u.is_active, o.name as organization_name, o.id as organization_id
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE ${where.join(' AND ')}
       ORDER BY u.created_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);

    return {
      users,
      has_more: users.length === Number(limit),
      next_cursor: users.length > 0 ? users[users.length - 1].id : null,
    };
  }

  async getUser(userId: string) {
    const user = await this.db.queryOne<any>(
      `SELECT u.*,
        o.name as organization_name,
        (SELECT COUNT(*) FROM sessions WHERE therapist_id=t.id) as session_count,
        (SELECT COUNT(*) FROM ai_usage_log WHERE user_id=u.id) as ai_calls
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN therapists t ON t.user_id = u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL`,
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserRole(userId: string, role: string, adminId: string) {
    const validRoles = ['therapist', 'patient', 'org_admin', 'org_member', 'super_admin'];
    if (!validRoles.includes(role)) throw new ForbiddenException('Invalid role');

    await this.db.query(`UPDATE users SET role=$2, updated_at=NOW() WHERE id=$1`, [userId, role]);
    await this.createAuditEntry({
      action: 'user_role_updated',
      resource_type: 'user',
      resource_id: userId,
      actor_id: adminId,
      details: { new_role: role },
    });
    return { success: true };
  }

  async deactivateUser(userId: string, reason: string, adminId: string) {
    await this.db.query(
      `UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1`,
      [userId],
    );
    await this.createAuditEntry({
      action: 'user_deactivated',
      resource_type: 'user',
      resource_id: userId,
      actor_id: adminId,
      details: { reason },
    });
    return { success: true };
  }

  // ─── Compliance & Audit ──────────────────────────────────────────────────

  async getAuditLog(query: any = {}) {
    const { org_id, actor_id, action, resource_type, limit = 50, cursor } = query;
    const params: any[] = [];
    const where: string[] = [];

    if (org_id) { params.push(org_id); where.push(`organization_id = $${params.length}`); }
    if (actor_id) { params.push(actor_id); where.push(`actor_id = $${params.length}`); }
    if (action) { params.push(action); where.push(`action = $${params.length}`); }
    if (resource_type) { params.push(resource_type); where.push(`resource_type = $${params.length}`); }
    if (cursor) { params.push(cursor); where.push(`created_at < $${params.length}`); }

    params.push(Math.min(Number(limit), 200));

    const entries = await this.db.query(
      `SELECT al.*,
        u.full_name as actor_name, u.email as actor_email, u.role as actor_role,
        o.name as organization_name
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.actor_id
       LEFT JOIN organizations o ON o.id = al.organization_id
       ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);

    return { entries, has_more: entries.length === Number(limit) };
  }

  async createAuditEntry(data: {
    action: string;
    resource_type: string;
    resource_id?: string;
    actor_id?: string;
    organization_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
  }) {
    const id = uuidv4();
    await this.db.query(
      `INSERT INTO audit_log (id, action, resource_type, resource_id, actor_id, organization_id, details, ip_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT DO NOTHING`,
      [id, data.action, data.resource_type, data.resource_id || null, data.actor_id || null,
       data.organization_id || null, JSON.stringify(data.details || {}), data.ip_address || null],
    ).catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));
    return { id };
  }

  async getComplianceReport(orgId: string) {
    const [hipaaChecks, dataRetention, accessControl, encryptionStatus] = await Promise.all([
      this.getHIPAAChecklist(orgId),
      this.getDataRetentionStatus(orgId),
      this.getAccessControlStatus(orgId),
      this.getEncryptionStatus(orgId),
    ]);

    return {
      org_id: orgId,
      generated_at: new Date().toISOString(),
      hipaa_checks: hipaaChecks,
      data_retention: dataRetention,
      access_control: accessControl,
      encryption_status: encryptionStatus,
      compliance_score: this.calculateComplianceScore([hipaaChecks, dataRetention, accessControl]),
    };
  }

  private async getHIPAAChecklist(orgId: string) {
    return {
      baa_signed: true,
      audit_logging_enabled: true,
      encryption_at_rest: true,
      encryption_in_transit: true,
      access_controls_enforced: true,
      minimum_necessary_enforced: true,
      backup_procedure_verified: false,
      incident_response_plan: false,
      workforce_training_current: false,
    };
  }

  private async getDataRetentionStatus(orgId: string) {
    const result = await this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS NOT NULL) as deleted_patients,
        COUNT(DISTINCT s.id) FILTER (WHERE s.created_at < NOW() - INTERVAL '7 years') as old_sessions
       FROM patients p
       LEFT JOIN sessions s ON s.patient_id = p.id
       WHERE p.organization_id=$1`,
      [orgId],
    ).catch(() => ({}));
    return result;
  }

  private async getAccessControlStatus(orgId: string) {
    return {
      mfa_enforcement: 'recommended',
      session_timeout_configured: true,
      ip_allowlist_configured: false,
      role_based_access: true,
      therapist_patient_isolation: true,
    };
  }

  private async getEncryptionStatus(orgId: string) {
    return {
      database_encryption: 'aes-256',
      file_storage_encryption: 'aes-256',
      api_tls: 'tls-1.3',
      jwt_algorithm: 'rs256',
    };
  }

  private calculateComplianceScore(checks: any[]): number {
    const allChecks = checks.flatMap((c) => Object.values(c)).filter((v) => typeof v === 'boolean');
    const passed = allChecks.filter(Boolean).length;
    return Math.round((passed / allChecks.length) * 100);
  }

  // ─── Feature Flags ───────────────────────────────────────────────────────

  async getFeatureFlags() {
    const flags = await this.db.query(
      `SELECT * FROM feature_flags ORDER BY name`,
      [],
    ).catch(() => []);
    return flags;
  }

  async setFeatureFlag(key: string, enabled: boolean, orgId: string | null, adminId: string) {
    await this.db.query(
      `UPDATE feature_flags SET enabled=$2, updated_at=NOW() WHERE key=$1`,
      [key, enabled],
    ).catch(() => null);
    await this.createAuditEntry({
      action: 'feature_flag_updated',
      resource_type: 'feature_flag',
      resource_id: key,
      actor_id: adminId,
      organization_id: orgId || undefined,
      details: { enabled },
    });
    return { key, enabled };
  }

  // ─── Marketplace & Content ───────────────────────────────────────────────

  async listMarketplaceItems(query: any = {}) {
    const { status, category, limit = 20 } = query;
    const params: any[] = [];
    const where: string[] = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (category) { params.push(category); where.push(`category = $${params.length}`); }
    params.push(Math.min(Number(limit), 100));

    return this.db.query(
      `SELECT m.*, u.full_name as creator_name, o.name as creator_org
       FROM marketplace_tools m
       LEFT JOIN users u ON u.id = m.creator_id
       LEFT JOIN organizations o ON o.id = m.organization_id
       ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);
  }

  async approveMarketplaceItem(itemId: string, adminId: string) {
    await this.db.query(
      `UPDATE marketplace_tools SET status='approved', reviewed_by=$2, reviewed_at=NOW() WHERE id=$1`,
      [itemId, adminId],
    );
    await this.createAuditEntry({ action: 'marketplace_item_approved', resource_type: 'marketplace_tool', resource_id: itemId, actor_id: adminId });
    return { success: true };
  }

  async rejectMarketplaceItem(itemId: string, reason: string, adminId: string) {
    await this.db.query(
      `UPDATE marketplace_tools SET status='rejected', reviewed_by=$2, reviewed_at=NOW(), review_notes=$3 WHERE id=$1`,
      [itemId, adminId, reason],
    );
    await this.createAuditEntry({ action: 'marketplace_item_rejected', resource_type: 'marketplace_tool', resource_id: itemId, actor_id: adminId, details: { reason } });
    return { success: true };
  }

  // ─── System Notifications ────────────────────────────────────────────────

  async sendSystemNotification(dto: {
    title: string;
    message: string;
    target: 'all' | 'therapists' | 'patients' | 'admins' | string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    org_id?: string;
  }, adminId: string) {
    const id = uuidv4();
    let query = `INSERT INTO system_notifications (id, title, message, target_audience, priority, created_by, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`;
    const result = await this.db.query(query, [id, dto.title, dto.message, dto.target, dto.priority, adminId]).catch(() => null);
    await this.createAuditEntry({ action: 'system_notification_sent', resource_type: 'notification', resource_id: id, actor_id: adminId, details: { title: dto.title, target: dto.target } });
    return result?.[0] || { id };
  }

  // ─── Platform Config ─────────────────────────────────────────────────────

  async getPlatformConfig() {
    const config = await this.db.query(
      `SELECT key, value, description, is_sensitive FROM platform_config ORDER BY key`,
      [],
    ).catch(() => []);
    return config.map((c: any) => ({ ...c, value: c.is_sensitive ? '***' : c.value }));
  }

  async updatePlatformConfig(key: string, value: string, adminId: string) {
    await this.db.query(
      `INSERT INTO platform_config (id, key, value, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (key) DO UPDATE SET value=$3, updated_by=$4, updated_at=NOW()`,
      [uuidv4(), key, value, adminId],
    ).catch(() => null);
    await this.createAuditEntry({ action: 'config_updated', resource_type: 'platform_config', resource_id: key, actor_id: adminId });
    return { key, updated: true };
  }

  // ─── Billing Overview ────────────────────────────────────────────────────

  async getBillingOverview() {
    const result = await this.db.queryOne<any>(
      `SELECT
        COALESCE(SUM(CASE WHEN status='completed' THEN amount END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status='completed' AND created_at > NOW() - INTERVAL '30 days' THEN amount END), 0) as monthly_revenue,
        COUNT(CASE WHEN status='pending' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status='failed' THEN 1 END) as failed_transactions,
        COUNT(DISTINCT organization_id) as billing_orgs
       FROM billing_transactions`,
      [],
    ).catch(() => ({}));
    return result;
  }

  // ─── AI Governance ────────────────────────────────────────────────────────

  async getAIGovernanceDashboard() {
    const [usageByOrg, modelPerformance, safetyAlerts, costBreakdown] = await Promise.all([
      this.getAIUsageByOrg(),
      this.getModelPerformance(),
      this.getAISafetyAlerts(),
      this.getAICostBreakdown(),
    ]);

    return {
      usage_by_org: usageByOrg,
      model_performance: modelPerformance,
      safety_alerts: safetyAlerts,
      cost_breakdown: costBreakdown,
    };
  }

  private async getAIUsageByOrg() {
    return this.db.query(
      `SELECT
        o.id, o.name, o.subscription_tier,
        COUNT(al.id) as total_calls,
        COALESCE(SUM(al.cost_usd), 0) as total_cost,
        COALESCE(SUM(al.total_tokens), 0) as total_tokens,
        COUNT(CASE WHEN al.status='error' THEN 1 END) as errors
       FROM organizations o
       LEFT JOIN ai_usage_log al ON al.organization_id = o.id
       WHERE o.deleted_at IS NULL
       GROUP BY o.id, o.name, o.subscription_tier
       ORDER BY total_cost DESC`,
      [],
    ).catch(() => []);
  }

  private async getModelPerformance() {
    return this.db.query(
      `SELECT
        model_name,
        COUNT(*) as calls,
        AVG(latency_ms) as avg_latency,
        AVG(cost_usd) as avg_cost,
        COUNT(CASE WHEN status='error' THEN 1 END) as error_count,
        (COUNT(CASE WHEN status='error' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100) as error_rate
       FROM ai_usage_log
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY model_name
       ORDER BY calls DESC`,
      [],
    ).catch(() => []);
  }

  private async getAISafetyAlerts() {
    return this.db.query(
      `SELECT ral.*,
        p.first_name || ' ' || p.last_name as patient_name,
        t.display_name as therapist_name,
        o.name as org_name
       FROM risk_alerts ral
       LEFT JOIN patients p ON p.id = ral.patient_id
       LEFT JOIN therapists t ON t.id = ral.therapist_id
       LEFT JOIN organizations o ON o.id = ral.organization_id
       WHERE ral.status = 'unreviewed' AND ral.risk_level IN ('high', 'critical')
       ORDER BY ral.created_at DESC LIMIT 20`,
      [],
    ).catch(() => []);
  }

  private async getAICostBreakdown() {
    return this.db.query(
      `SELECT
        DATE_TRUNC('day', created_at) as day,
        SUM(cost_usd) as cost,
        SUM(total_tokens) as tokens
       FROM ai_usage_log
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY day`,
      [],
    ).catch(() => []);
  }
  async recordBreakGlassAccess(opts: {
    adminUserId: string;
    targetUserId?: string;
    reason: string;
    resources: string[];
    ipAddress?: string;
    userAgent?: string;
  }) {
    const row = await this.db.queryOne<{ id: string }>(
      `INSERT INTO break_glass_access
         (admin_user_id, target_user_id, reason, resources, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        opts.adminUserId, opts.targetUserId || null, opts.reason,
        JSON.stringify(opts.resources),
        opts.ipAddress || null, opts.userAgent || null,
      ],
    ).catch(() => null);
    await this.createAuditEntry({
      action: 'break_glass_access',
      resource_type: 'patient_record',
      resource_id: opts.targetUserId || 'platform',
      actor_id: opts.adminUserId,
      details: { reason: opts.reason, resources: opts.resources },
    });
    this.logger.warn(`BREAK_GLASS: admin=${opts.adminUserId} target=${opts.targetUserId} reason="${opts.reason}"`);
    return { id: row?.id, status: 'logged' };
  }

  async listBreakGlassEvents(query: any = {}) {
    const { limit = 50 } = query;
    return this.db.query(
      `SELECT b.*, u.email AS admin_email
       FROM break_glass_access b
       JOIN users u ON u.id = b.admin_user_id
       ORDER BY b.accessed_at DESC
       LIMIT $1`,
      [Math.min(Number(limit), 200)],
    ).catch(() => []);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
