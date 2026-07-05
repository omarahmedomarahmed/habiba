import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

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
        (SELECT COALESCE(SUM(amount_usd),0) FROM session_charges WHERE status='paid') as total_revenue,
        (SELECT COUNT(*) FROM ai_request_logs) as total_ai_calls,
        (SELECT COALESCE(SUM(cost_usd),0) FROM ai_request_logs) as total_ai_cost`,
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
      `SELECT u.id, COALESCE(u.first_name || ' ' || u.last_name, u.email) AS full_name,
        u.email, u.role, u.created_at, u.last_login_at,
        o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC LIMIT 20`,
      [],
    ).catch(() => []);
  }

  private async getSystemHealth() {
    return this.getSystemHealthDetailed();
  }

  async getSystemHealthDetailed() {
    const apiStart = Date.now();

    // Database: live ping
    const dbStart = Date.now();
    const dbStatus = await this.db.query('SELECT 1 as ok', [])
      .then(() => ({ status: 'operational', latency: `${Date.now() - dbStart}ms` }))
      .catch(() => ({ status: 'down', latency: '–' }));

    // AI Service: key presence check
    const aiKey = this.config.get<string>('openai.apiKey');
    const aiStatus = aiKey ? 'operational' : 'degraded';

    // Video Service: Daily.co key presence
    const dailyKey = this.config.get<string>('video.dailyApiKey');
    const videoStatus = dailyKey ? 'operational' : 'degraded';

    // Billing: Stripe key presence and non-placeholder
    const stripeKey = this.config.get<string>('stripe.secretKey');
    const billingStatus = (stripeKey && stripeKey !== 'sk_test_placeholder') ? 'operational' : 'degraded';

    // Notifications: Resend key presence
    const resendKey = this.config.get<string>('resend.apiKey') || process.env.RESEND_API_KEY;
    const notifStatus = resendKey ? 'operational' : 'degraded';

    const services = [
      { name: 'API Gateway', status: 'operational', latency: `${Date.now() - apiStart}ms` },
      { name: 'Database', status: dbStatus.status, latency: dbStatus.latency },
      { name: 'AI Service', status: aiStatus, latency: '–' },
      { name: 'Video Service', status: videoStatus, latency: '–' },
      { name: 'Billing Service', status: billingStatus, latency: '–' },
      { name: 'Notifications', status: notifStatus, latency: '–' },
    ];

    const overallDown = services.some(s => s.status === 'down');
    const overallDegraded = services.some(s => s.status === 'degraded');
    const overall = overallDown ? 'down' : overallDegraded ? 'degraded' : 'operational';

    return { services, overall, timestamp: new Date().toISOString() };
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
        (SELECT COALESCE(SUM(amount_usd),0) FROM session_charges WHERE organization_id=o.id AND status='paid') as total_revenue
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
        (SELECT COALESCE(SUM(amount_usd),0) FROM session_charges WHERE organization_id=o.id AND status='paid') as total_revenue,
        (SELECT COUNT(*) FROM ai_request_logs WHERE organization_id=o.id) as ai_calls,
        (SELECT COALESCE(SUM(cost_usd),0) FROM ai_request_logs WHERE organization_id=o.id) as ai_cost
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

    if (search) { params.push(`%${search}%`); where.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    if (role) { params.push(role); where.push(`u.role = $${params.length}`); }
    if (org_id) { params.push(org_id); where.push(`u.organization_id = $${params.length}`); }
    if (status) { params.push(status === 'verified' ? true : status); where.push(`u.email_verified_at IS ${status === 'verified' ? 'NOT ' : ''}NULL`); }
    if (cursor) { params.push(cursor); where.push(`u.created_at < (SELECT created_at FROM users WHERE id = $${params.length})`); }

    params.push(Math.min(Number(limit), 100));

    const users = await this.db.query(
      `SELECT u.id,
         COALESCE(u.first_name || ' ' || u.last_name, u.email) AS full_name,
         u.first_name, u.last_name, u.email, u.role, u.status,
         u.email_verified_at IS NOT NULL AS email_verified,
         u.last_login_at, u.created_at, u.organization_id,
         o.name as organization_name
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
        (SELECT COUNT(*) FROM ai_request_logs WHERE user_id=u.id) as ai_calls
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
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as actor_name, u.email as actor_email, u.role as actor_role,
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
        COALESCE(SUM(CASE WHEN status='paid' THEN amount_usd END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status='paid' AND charged_at > NOW() - INTERVAL '30 days' THEN amount_usd END), 0) as monthly_revenue,
        COUNT(CASE WHEN status='pending' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status='failed' THEN 1 END) as failed_transactions,
        COUNT(DISTINCT organization_id) as billing_orgs
       FROM session_charges`,
      [],
    ).catch(() => ({}));
    return result;
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

  // ─── User Impersonation ───────────────────────────────────────────────────

  async impersonateUser(targetUserId: string, adminId: string) {
    const user = await this.db.queryOne<any>(
      `SELECT u.id, u.email, u.role, u.organization_id,
         u.first_name, u.last_name, u.status,
         t.id AS therapist_id, p.id AS patient_id
       FROM users u
       LEFT JOIN therapists t ON t.user_id = u.id AND t.deleted_at IS NULL
       LEFT JOIN patients p ON p.user_id = u.id AND p.deleted_at IS NULL
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [targetUserId],
    );
    if (!user) throw new NotFoundException('User not found');

    await this.db.execute(
      `INSERT INTO phi_access_log (user_id, action, resource_type, resource_id, created_at)
       VALUES ($1, 'admin_impersonate', 'user', $2, NOW())`,
      [adminId, targetUserId],
    ).catch(() => null);

    const jwtSecret = this.config.get<string>('jwt.secret') ?? this.config.get<string>('JWT_SECRET') ?? '';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        sub: user.id,
        org: user.organization_id,
        role: user.role,
        impersonated_by: adminId,
      },
      jwtSecret,
      { expiresIn: '1h' },
    );

    return {
      impersonation_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      },
      expires_in: 3600,
    };
  }

  // ─── Admin Therapist Profile ──────────────────────────────────────────────

  async getTherapistProfile(therapistId: string) {
    const profile = await this.db.queryOne<any>(
      `SELECT t.*, u.email, u.first_name, u.last_name, u.avatar_url,
              u.status AS user_status, u.last_login_at
       FROM therapists t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [therapistId],
    );
    if (!profile) throw new NotFoundException('Therapist not found');
    return profile;
  }

  async updateTherapistProfile(therapistId: string, dto: any) {
    const allowed = [
      'display_name', 'bio', 'specialty', 'specializations', 'languages',
      'years_experience', 'location', 'verification_status', 'accepting_new_patients',
    ];
    const sets: string[] = [];
    const values: any[] = [therapistId];

    for (const key of allowed) {
      if (dto[key] !== undefined) {
        values.push(dto[key]);
        sets.push(`${key} = $${values.length}`);
      }
    }

    if (!sets.length) return this.getTherapistProfile(therapistId);

    values.push(new Date().toISOString());
    sets.push(`updated_at = $${values.length}`);

    const updated = await this.db.queryOne(
      `UPDATE therapists SET ${sets.join(', ')}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values,
    );
    if (!updated) throw new NotFoundException('Therapist not found');
    return updated;
  }

  // ─── Subscriptions (Cross-Org Admin) ────────────────────────────────────

  async listAllSubscriptions(query: any = {}) {
    const { search, status, plan_id, limit = 25, offset = 0 } = query;
    const params: any[] = [];
    const where: string[] = [];

    if (search) { params.push(`%${search}%`); where.push(`o.name ILIKE $${params.length}`); }
    if (status) { params.push(status); where.push(`o.subscription_status = $${params.length}`); }
    if (plan_id) { params.push(plan_id); where.push(`o.subscription_tier = $${params.length}`); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    params.push(Math.min(Number(limit), 100));
    params.push(Math.max(Number(offset), 0));

    const subs = await this.db.query(
      `SELECT o.id, o.name, o.subscription_tier as plan, o.subscription_status as status,
        o.trial_ends_at, o.created_at,
        o.max_therapists as seats,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND role = 'therapist' AND deleted_at IS NULL) as used_seats,
        (SELECT stripe_subscription_id FROM organizations WHERE id = o.id) as stripe_subscription_id,
        (SELECT COALESCE(SUM(amount_usd),0) FROM session_charges WHERE organization_id = o.id AND status = 'paid') as total_paid
       FROM organizations o
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ).catch(() => []);

    const statsParams = params.slice(0, params.length - 2);
    const stats = await this.db.queryOne<any>(
      `SELECT
        COUNT(*) FILTER (WHERE o.subscription_status = 'active') as active,
        COUNT(*) FILTER (WHERE o.subscription_status = 'trialing') as trialing,
        COUNT(*) FILTER (WHERE o.subscription_status = 'past_due') as past_due,
        COUNT(*) FILTER (WHERE o.subscription_status IN ('cancelled','suspended')) as cancelled
       FROM organizations o
       ${whereClause}`,
      statsParams,
    ).catch(() => ({ active: 0, trialing: 0, past_due: 0, cancelled: 0 }));

    return { subscriptions: subs, stats, has_more: subs.length === Number(limit) };
  }

  async updateSubscription(orgId: string, dto: { status?: string; plan?: string; trial_ends_at?: string; max_therapists?: number }, adminId: string) {
    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [orgId];
    if (dto.status) { params.push(dto.status); sets.push(`subscription_status = $${params.length}`); }
    if (dto.plan) { params.push(dto.plan); sets.push(`subscription_tier = $${params.length}`); }
    if (dto.trial_ends_at) { params.push(dto.trial_ends_at); sets.push(`trial_ends_at = $${params.length}`); }
    if (dto.max_therapists !== undefined) { params.push(dto.max_therapists); sets.push(`max_therapists = $${params.length}`); }
    await this.db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $1`, params);
    await this.createAuditEntry({
      action: 'subscription_updated',
      resource_type: 'organization',
      resource_id: orgId,
      actor_id: adminId,
      details: dto,
    });
    return { success: true };
  }

  // ─── Therapist Credentials ───────────────────────────────────────────────

  async listTherapistCredentials(query: any = {}) {
    const { status, therapist_id, doc_type, limit = 25, offset = 0 } = query;
    const params: any[] = [];
    const where: string[] = [];

    if (status) { params.push(status); where.push(`tc.status = $${params.length}`); }
    if (therapist_id) { params.push(therapist_id); where.push(`tc.therapist_id = $${params.length}`); }
    if (doc_type) { params.push(doc_type); where.push(`tc.document_type = $${params.length}`); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    params.push(Math.min(Number(limit), 100));
    params.push(Math.max(Number(offset), 0));

    const creds = await this.db.query(
      `SELECT tc.*, t.display_name as therapist_name, u.email as therapist_email,
        o.name as organization_name
       FROM therapist_credentials tc
       JOIN therapists t ON t.id = tc.therapist_id
       JOIN users u ON u.id = t.user_id
       JOIN organizations o ON o.id = t.organization_id
       ${whereClause}
       ORDER BY tc.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ).catch(() => []);

    const statsParams = params.slice(0, params.length - 2);
    const stats = await this.db.queryOne<any>(
      `SELECT
        COUNT(*) FILTER (WHERE tc.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE tc.status = 'verified') as verified,
        COUNT(*) FILTER (WHERE tc.status = 'rejected') as rejected
       FROM therapist_credentials tc
       ${whereClause}`,
      statsParams,
    ).catch(() => ({ pending: 0, verified: 0, rejected: 0 }));

    return { credentials: creds, stats, has_more: creds.length === Number(limit) };
  }

  async updateTherapistCredential(credentialId: string, dto: { status: string; rejection_reason?: string }, adminId: string) {
    const sets: string[] = ['updated_at = NOW()', `status = '${dto.status}'`, `verified_by = '${adminId}'`, `verified_at = NOW()`];
    const params: any[] = [credentialId];
    if (dto.rejection_reason) { params.push(dto.rejection_reason); sets.push(`rejection_reason = $${params.length}`); }
    await this.db.query(`UPDATE therapist_credentials SET ${sets.join(', ')} WHERE id = $1`, params).catch(() => null);
    await this.createAuditEntry({
      action: `credential_${dto.status}`,
      resource_type: 'therapist_credential',
      resource_id: credentialId,
      actor_id: adminId,
      details: dto,
    });
    return { success: true };
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
