import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface EventTrackingDto {
  event_type: string;
  event_name: string;
  entity_type?: string;
  entity_id?: string;
  properties?: Record<string, any>;
  session_id?: string;
  patient_id?: string;
  therapist_id?: string;
  user_id?: string;
  organization_id?: string;
  timestamp?: string;
  source?: string;
  platform?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Event Tracking ─────────────────────────────────────────────────────────

  async trackEvent(dto: EventTrackingDto) {
    const id = uuidv4();
    try {
      await this.db.query(
        `INSERT INTO platform_events (
          id, event_type, event_name, entity_type, entity_id,
          properties, session_id, patient_id, therapist_id,
          user_id, organization_id, occurred_at, source, platform
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT DO NOTHING`,
        [
          id,
          dto.event_type,
          dto.event_name,
          dto.entity_type || null,
          dto.entity_id || null,
          JSON.stringify(dto.properties || {}),
          dto.session_id || null,
          dto.patient_id || null,
          dto.therapist_id || null,
          dto.user_id || null,
          dto.organization_id || null,
          dto.timestamp || new Date().toISOString(),
          dto.source || 'platform',
          dto.platform || 'web',
        ],
      );
      return { id, tracked: true };
    } catch (err) {
      this.logger.warn(`Event tracking failed: ${err.message}`);
      return { id, tracked: false };
    }
  }

  async trackBatch(events: EventTrackingDto[]) {
    const results = await Promise.allSettled(events.map((e) => this.trackEvent(e)));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    return { tracked: success, failed: events.length - success, total: events.length };
  }

  // ─── Platform Dashboard Metrics ─────────────────────────────────────────────

  async getPlatformDashboard(period: string = '30d') {
    const days = this.parsePeriodToDays(period);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [
      orgMetrics,
      userMetrics,
      sessionMetrics,
      revenueMetrics,
      aiMetrics,
      growthMetrics,
    ] = await Promise.all([
      this.getOrgMetrics(since),
      this.getUserMetrics(since),
      this.getSessionMetrics(since),
      this.getRevenueMetrics(since),
      this.getAIMetrics(since),
      this.getGrowthTrends(since, days),
    ]);

    return {
      period,
      generated_at: new Date().toISOString(),
      organizations: orgMetrics,
      users: userMetrics,
      sessions: sessionMetrics,
      revenue: revenueMetrics,
      ai: aiMetrics,
      growth: growthMetrics,
    };
  }

  private async getOrgMetrics(since: string) {
    const result = await this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT o.id) as total_orgs,
        COUNT(DISTINCT CASE WHEN o.created_at >= $1 THEN o.id END) as new_orgs,
        COUNT(DISTINCT CASE WHEN o.subscription_status = 'active' THEN o.id END) as active_orgs,
        COUNT(DISTINCT CASE WHEN o.subscription_status = 'trialing' THEN o.id END) as trialing_orgs,
        COUNT(DISTINCT CASE WHEN o.subscription_tier = 'enterprise' THEN o.id END) as enterprise_orgs,
        COUNT(DISTINCT CASE WHEN o.subscription_tier = 'professional' THEN o.id END) as professional_orgs,
        COUNT(DISTINCT CASE WHEN o.subscription_tier = 'starter' THEN o.id END) as starter_orgs
      FROM organizations o`,
      [since],
    ).catch(() => ({ total_orgs: 0, new_orgs: 0, active_orgs: 0, trialing_orgs: 0, enterprise_orgs: 0, professional_orgs: 0, starter_orgs: 0 }));
    return result;
  }

  private async getUserMetrics(since: string) {
    const result = await this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.created_at >= $1 THEN u.id END) as new_users,
        COUNT(DISTINCT CASE WHEN u.role = 'therapist' THEN u.id END) as total_therapists,
        COUNT(DISTINCT CASE WHEN u.role = 'patient' THEN u.id END) as total_patients,
        COUNT(DISTINCT CASE WHEN u.role = 'org_admin' THEN u.id END) as total_admins,
        COUNT(DISTINCT CASE WHEN u.last_login_at >= $1 THEN u.id END) as active_users,
        COUNT(DISTINCT CASE WHEN u.email_verified = true THEN u.id END) as verified_users
      FROM users u WHERE u.deleted_at IS NULL`,
      [since],
    ).catch(() => ({ total_users: 0, new_users: 0, total_therapists: 0, total_patients: 0, total_admins: 0, active_users: 0, verified_users: 0 }));
    return result;
  }

  private async getSessionMetrics(since: string) {
    const result = await this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT CASE WHEN s.created_at >= $1 THEN s.id END) as new_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' AND s.created_at >= $1 THEN s.id END) as completed_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'no_show' AND s.created_at >= $1 THEN s.id END) as no_shows,
        COUNT(DISTINCT CASE WHEN s.scribe_enabled = true AND s.created_at >= $1 THEN s.id END) as scribe_sessions,
        AVG(CASE WHEN s.status = 'completed' AND s.created_at >= $1 THEN s.duration_minutes END) as avg_duration_minutes
      FROM sessions s`,
      [since],
    ).catch(() => ({ total_sessions: 0, new_sessions: 0, completed_sessions: 0, no_shows: 0, scribe_sessions: 0, avg_duration_minutes: 0 }));
    return result;
  }

  private async getRevenueMetrics(since: string) {
    const result = await this.db.queryOne<any>(
      `SELECT
        COALESCE(SUM(CASE WHEN t.created_at >= $1 AND t.status = 'completed' THEN t.amount END), 0) as revenue_period,
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.amount END), 0) as revenue_total,
        COALESCE(AVG(CASE WHEN t.created_at >= $1 AND t.status = 'completed' THEN t.amount END), 0) as avg_transaction,
        COUNT(DISTINCT CASE WHEN t.created_at >= $1 THEN t.id END) as transactions_period
      FROM billing_transactions t`,
      [since],
    ).catch(() => ({ revenue_period: 0, revenue_total: 0, avg_transaction: 0, transactions_period: 0 }));
    return result;
  }

  private async getAIMetrics(since: string) {
    const result = await this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT al.id) as total_ai_calls,
        COALESCE(SUM(al.total_tokens), 0) as total_tokens,
        COALESCE(SUM(al.cost_usd), 0) as total_ai_cost,
        COALESCE(AVG(al.latency_ms), 0) as avg_latency_ms,
        COUNT(DISTINCT CASE WHEN al.task_type = 'soap_note' THEN al.id END) as soap_notes_generated,
        COUNT(DISTINCT CASE WHEN al.task_type = 'risk_assessment' THEN al.id END) as risk_assessments,
        COUNT(DISTINCT CASE WHEN al.task_type = 'memory_extraction' THEN al.id END) as memory_extractions,
        COUNT(DISTINCT CASE WHEN al.status = 'error' THEN al.id END) as ai_errors
      FROM ai_usage_log al WHERE al.created_at >= $1`,
      [since],
    ).catch(() => ({ total_ai_calls: 0, total_tokens: 0, total_ai_cost: 0, avg_latency_ms: 0, soap_notes_generated: 0, risk_assessments: 0, memory_extractions: 0, ai_errors: 0 }));
    return result;
  }

  private async getGrowthTrends(since: string, days: number) {
    const interval = days <= 7 ? '1 day' : days <= 30 ? '1 day' : days <= 90 ? '1 week' : '1 month';
    const trends = await this.db.query(
      `SELECT
        date_trunc('day', generate_series::date) as date,
        0 as sessions,
        0 as new_users,
        0 as revenue
      FROM generate_series($1::date, CURRENT_DATE, $2::interval)
      ORDER BY date`,
      [since, interval],
    ).catch(() => []);
    return trends;
  }

  // ─── Organization Analytics ──────────────────────────────────────────────────

  async getOrgAnalytics(orgId: string, period: string = '30d') {
    const days = this.parsePeriodToDays(period);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [
      overview,
      sessionTrends,
      therapistPerformance,
      patientOutcomes,
      aiUsage,
      revenueBreakdown,
      retentionMetrics,
    ] = await Promise.all([
      this.getOrgOverview(orgId, since),
      this.getOrgSessionTrends(orgId, since),
      this.getTherapistPerformance(orgId, since),
      this.getPatientOutcomes(orgId, since),
      this.getOrgAIUsage(orgId, since),
      this.getOrgRevenue(orgId, since),
      this.getRetentionMetrics(orgId, since),
    ]);

    return {
      org_id: orgId,
      period,
      generated_at: new Date().toISOString(),
      overview,
      session_trends: sessionTrends,
      therapist_performance: therapistPerformance,
      patient_outcomes: patientOutcomes,
      ai_usage: aiUsage,
      revenue: revenueBreakdown,
      retention: retentionMetrics,
    };
  }

  private async getOrgOverview(orgId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        (SELECT COUNT(*) FROM sessions WHERE organization_id=$1 AND status='completed' AND created_at>=$2) as completed_sessions,
        (SELECT COUNT(*) FROM patients WHERE organization_id=$1 AND status='active') as active_patients,
        (SELECT COUNT(*) FROM therapists WHERE organization_id=$1 AND is_active=true) as active_therapists,
        (SELECT COUNT(*) FROM sessions WHERE organization_id=$1 AND status='no_show' AND created_at>=$2) as no_shows,
        (SELECT COALESCE(SUM(amount),0) FROM billing_transactions WHERE organization_id=$1 AND status='completed' AND created_at>=$2) as revenue,
        (SELECT COALESCE(AVG(duration_minutes),0) FROM sessions WHERE organization_id=$1 AND status='completed' AND created_at>=$2) as avg_session_duration
      FROM organizations WHERE id=$1`,
      [orgId, since],
    ).catch(() => ({}));
  }

  private async getOrgSessionTrends(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE(scheduled_at) as date,
        COUNT(*) as total,
        COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status='no_show' THEN 1 END) as no_shows,
        AVG(CASE WHEN status='completed' THEN duration_minutes END) as avg_duration
      FROM sessions
      WHERE organization_id=$1 AND scheduled_at >= $2
      GROUP BY DATE(scheduled_at)
      ORDER BY date`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getTherapistPerformance(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        t.id,
        t.display_name,
        COUNT(s.id) as total_sessions,
        COUNT(CASE WHEN s.status='completed' THEN 1 END) as completed_sessions,
        COUNT(DISTINCT s.patient_id) as unique_patients,
        AVG(s.duration_minutes) as avg_session_duration,
        COUNT(CASE WHEN an.id IS NOT NULL THEN 1 END) as notes_generated,
        (COALESCE(SUM(bt.amount), 0)) as revenue
      FROM therapists t
      LEFT JOIN sessions s ON s.therapist_id = t.id AND s.created_at >= $2
      LEFT JOIN ai_session_notes an ON an.therapist_id = t.id AND an.created_at >= $2
      LEFT JOIN billing_transactions bt ON bt.therapist_id = t.id AND bt.status='completed' AND bt.created_at >= $2
      WHERE t.organization_id = $1 AND t.is_active = true
      GROUP BY t.id, t.display_name
      ORDER BY completed_sessions DESC`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getPatientOutcomes(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE_TRUNC('week', pa.administered_at) as week,
        AVG(CASE WHEN at.code = 'PHQ9' THEN pa.total_score END) as avg_phq9,
        AVG(CASE WHEN at.code = 'GAD7' THEN pa.total_score END) as avg_gad7,
        COUNT(DISTINCT pa.patient_id) as patients_assessed
      FROM patient_assessments pa
      JOIN assessment_templates at ON at.id = pa.template_id
      WHERE pa.organization_id = $1 AND pa.administered_at >= $2
      GROUP BY DATE_TRUNC('week', pa.administered_at)
      ORDER BY week`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getOrgAIUsage(orgId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COUNT(CASE WHEN task_type='soap_note' THEN 1 END) as soap_notes,
        COUNT(CASE WHEN task_type='dap_note' THEN 1 END) as dap_notes,
        COUNT(CASE WHEN task_type='risk_assessment' THEN 1 END) as risk_assessments,
        COUNT(CASE WHEN task_type='memory_extraction' THEN 1 END) as memory_extractions,
        COUNT(CASE WHEN status='error' THEN 1 END) as errors
      FROM ai_usage_log
      WHERE organization_id=$1 AND created_at>=$2`,
      [orgId, since],
    ).catch(() => ({}));
  }

  private async getOrgRevenue(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE_TRUNC('week', created_at) as week,
        SUM(amount) as revenue,
        COUNT(*) as transactions,
        AVG(amount) as avg_amount
      FROM billing_transactions
      WHERE organization_id=$1 AND status='completed' AND created_at>=$2
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getRetentionMetrics(orgId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT CASE WHEN p.status='active' THEN p.id END) as active_patients,
        COUNT(DISTINCT CASE WHEN p.status='discharged' THEN p.id END) as discharged,
        COUNT(DISTINCT CASE WHEN p.status='inactive' THEN p.id END) as inactive,
        AVG(EXTRACT(DAY FROM COALESCE(p.updated_at, NOW()) - p.created_at)) as avg_retention_days
      FROM patients p
      WHERE p.organization_id=$1`,
      [orgId, since],
    ).catch(() => ({}));
  }

  // ─── Therapist Analytics ──────────────────────────────────────────────────

  async getTherapistAnalytics(therapistId: string, orgId: string, period: string = '30d') {
    const days = this.parsePeriodToDays(period);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [
      overview,
      sessionBreakdown,
      patientRiskDistribution,
      noteCompletion,
      aiAssistUsage,
      weeklyLoad,
      outcomesTrends,
    ] = await Promise.all([
      this.getTherapistOverview(therapistId, since),
      this.getTherapistSessionBreakdown(therapistId, since),
      this.getTherapistPatientRisks(therapistId),
      this.getTherapistNoteCompletion(therapistId, since),
      this.getTherapistAIUsage(therapistId, since),
      this.getTherapistWeeklyLoad(therapistId, since),
      this.getTherapistOutcomesTrends(therapistId, since),
    ]);

    return {
      therapist_id: therapistId,
      period,
      generated_at: new Date().toISOString(),
      overview,
      session_breakdown: sessionBreakdown,
      patient_risk_distribution: patientRiskDistribution,
      note_completion: noteCompletion,
      ai_usage: aiAssistUsage,
      weekly_load: weeklyLoad,
      outcomes_trends: outcomesTrends,
    };
  }

  private async getTherapistOverview(therapistId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        (SELECT COUNT(*) FROM sessions WHERE therapist_id=$1 AND status='completed' AND created_at>=$2) as completed_sessions,
        (SELECT COUNT(DISTINCT patient_id) FROM sessions WHERE therapist_id=$1 AND status='completed') as total_patients,
        (SELECT COUNT(*) FROM ai_session_notes WHERE therapist_id=$1 AND status='finalized' AND created_at>=$2) as notes_completed,
        (SELECT COUNT(*) FROM ai_session_notes WHERE therapist_id=$1 AND status='draft' AND created_at>=$2) as notes_pending,
        (SELECT COALESCE(AVG(duration_minutes),0) FROM sessions WHERE therapist_id=$1 AND status='completed' AND created_at>=$2) as avg_session_duration,
        (SELECT COUNT(*) FROM patient_radar_requests WHERE primary_therapist_id=$1 AND status='pending') as radar_requests,
        (SELECT COUNT(*) FROM sessions WHERE therapist_id=$1 AND scheduled_at > NOW() AND status='scheduled') as upcoming_sessions
      FROM therapists WHERE id=$1`,
      [therapistId, since],
    ).catch(() => ({}));
  }

  private async getTherapistSessionBreakdown(therapistId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE(scheduled_at) as date,
        COUNT(*) as total,
        COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status='no_show' THEN 1 END) as no_shows,
        COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled
      FROM sessions
      WHERE therapist_id=$1 AND scheduled_at>=$2
      GROUP BY DATE(scheduled_at)
      ORDER BY date`,
      [therapistId, since],
    ).catch(() => []);
  }

  private async getTherapistPatientRisks(therapistId: string) {
    return this.db.query(
      `SELECT
        p.risk_level,
        COUNT(*) as count
      FROM patients p
      WHERE p.primary_therapist_id=$1 AND p.status='active'
      GROUP BY p.risk_level`,
      [therapistId],
    ).catch(() => []);
  }

  private async getTherapistNoteCompletion(therapistId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        COUNT(CASE WHEN status='finalized' THEN 1 END) as completed,
        COUNT(CASE WHEN status='draft' THEN 1 END) as drafts,
        COUNT(CASE WHEN status='needs_review' THEN 1 END) as needs_review,
        COALESCE(AVG(EXTRACT(EPOCH FROM (finalized_at - created_at))/3600), 0) as avg_completion_hours
      FROM ai_session_notes
      WHERE therapist_id=$1 AND created_at>=$2`,
      [therapistId, since],
    ).catch(() => ({}));
  }

  private async getTherapistAIUsage(therapistId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        COUNT(*) as total_ai_calls,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(CASE WHEN task_type='soap_note' THEN 1 END) as soap_notes,
        COUNT(CASE WHEN task_type='dap_note' THEN 1 END) as dap_notes,
        COUNT(CASE WHEN task_type='session_summary' THEN 1 END) as summaries,
        COUNT(CASE WHEN task_type='risk_assessment' THEN 1 END) as risk_assessments,
        COUNT(CASE WHEN task_type='treatment_recommendation' THEN 1 END) as treatment_recommendations
      FROM ai_usage_log
      WHERE user_id=$1 AND created_at>=$2`,
      [therapistId, since],
    ).catch(() => ({}));
  }

  private async getTherapistWeeklyLoad(therapistId: string, since: string) {
    return this.db.query(
      `SELECT
        EXTRACT(DOW FROM scheduled_at) as day_of_week,
        EXTRACT(HOUR FROM scheduled_at) as hour_of_day,
        COUNT(*) as session_count
      FROM sessions
      WHERE therapist_id=$1 AND scheduled_at>=$2 AND status='completed'
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week, hour_of_day`,
      [therapistId, since],
    ).catch(() => []);
  }

  private async getTherapistOutcomesTrends(therapistId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE_TRUNC('week', pa.administered_at) as week,
        AVG(CASE WHEN at.code = 'PHQ9' THEN pa.total_score END) as avg_phq9,
        AVG(CASE WHEN at.code = 'GAD7' THEN pa.total_score END) as avg_gad7,
        COUNT(DISTINCT pa.patient_id) as patients_assessed
      FROM patient_assessments pa
      JOIN assessment_templates at ON at.id = pa.template_id
      WHERE pa.therapist_id = $1 AND pa.administered_at >= $2
      GROUP BY DATE_TRUNC('week', pa.administered_at)
      ORDER BY week`,
      [therapistId, since],
    ).catch(() => []);
  }

  // ─── AI Cost Tracking ─────────────────────────────────────────────────────

  async getAICostAnalytics(orgId: string, period: string = '30d') {
    const days = this.parsePeriodToDays(period);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [costByTask, costByModel, costTrends, topConsumers, budgetStatus] = await Promise.all([
      this.getAICostByTask(orgId, since),
      this.getAICostByModel(orgId, since),
      this.getAICostTrends(orgId, since),
      this.getAITopConsumers(orgId, since),
      this.getAIBudgetStatus(orgId, since),
    ]);

    return {
      org_id: orgId,
      period,
      cost_by_task: costByTask,
      cost_by_model: costByModel,
      cost_trends: costTrends,
      top_consumers: topConsumers,
      budget_status: budgetStatus,
    };
  }

  private async getAICostByTask(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        task_type,
        COUNT(*) as calls,
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cost_usd) as total_cost,
        AVG(cost_usd) as avg_cost,
        AVG(latency_ms) as avg_latency
      FROM ai_usage_log
      WHERE organization_id=$1 AND created_at>=$2
      GROUP BY task_type
      ORDER BY total_cost DESC`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getAICostByModel(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        model_name,
        COUNT(*) as calls,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        AVG(latency_ms) as avg_latency,
        COUNT(CASE WHEN status='error' THEN 1 END) as errors
      FROM ai_usage_log
      WHERE organization_id=$1 AND created_at>=$2
      GROUP BY model_name
      ORDER BY total_cost DESC`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getAICostTrends(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE(created_at) as date,
        SUM(cost_usd) as daily_cost,
        SUM(total_tokens) as daily_tokens,
        COUNT(*) as daily_calls
      FROM ai_usage_log
      WHERE organization_id=$1 AND created_at>=$2
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getAITopConsumers(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        u.id as user_id,
        u.full_name,
        u.role,
        COUNT(al.id) as calls,
        SUM(al.cost_usd) as total_cost,
        SUM(al.total_tokens) as total_tokens
      FROM ai_usage_log al
      JOIN users u ON u.id = al.user_id
      WHERE al.organization_id=$1 AND al.created_at>=$2
      GROUP BY u.id, u.full_name, u.role
      ORDER BY total_cost DESC
      LIMIT 20`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getAIBudgetStatus(orgId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        o.ai_monthly_budget_usd,
        COALESCE(SUM(al.cost_usd), 0) as current_spend,
        CASE
          WHEN o.ai_monthly_budget_usd > 0
          THEN (COALESCE(SUM(al.cost_usd), 0) / o.ai_monthly_budget_usd * 100)
          ELSE 0
        END as budget_pct_used
      FROM organizations o
      LEFT JOIN ai_usage_log al ON al.organization_id = o.id AND al.created_at >= $2
      WHERE o.id = $1
      GROUP BY o.ai_monthly_budget_usd`,
      [orgId, since],
    ).catch(() => ({ ai_monthly_budget_usd: 0, current_spend: 0, budget_pct_used: 0 }));
  }

  // ─── Event Stream ────────────────────────────────────────────────────────

  async getEventStream(orgId: string, filters: any = {}) {
    const { event_type, entity_type, user_id, limit = 50, cursor } = filters;
    const params: any[] = [orgId];
    const where: string[] = ['organization_id = $1'];

    if (event_type) { params.push(event_type); where.push(`event_type = $${params.length}`); }
    if (entity_type) { params.push(entity_type); where.push(`entity_type = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`user_id = $${params.length}`); }
    if (cursor) { params.push(cursor); where.push(`occurred_at < $${params.length}`); }

    params.push(Math.min(Number(limit), 200));

    return this.db.query(
      `SELECT * FROM platform_events
       WHERE ${where.join(' AND ')}
       ORDER BY occurred_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);
  }

  // ─── Outcome Metrics ──────────────────────────────────────────────────────

  async getOutcomeMetrics(orgId: string, period: string = '90d') {
    const days = this.parsePeriodToDays(period);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [phq9Trends, gad7Trends, riskDistribution, improvementRates] = await Promise.all([
      this.getPHQ9Trends(orgId, since),
      this.getGAD7Trends(orgId, since),
      this.getRiskDistributionTrends(orgId, since),
      this.getImprovementRates(orgId, since),
    ]);

    return {
      period,
      phq9_trends: phq9Trends,
      gad7_trends: gad7Trends,
      risk_distribution: riskDistribution,
      improvement_rates: improvementRates,
    };
  }

  private async getPHQ9Trends(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE_TRUNC('week', pa.administered_at) as week,
        AVG(pa.total_score) as avg_score,
        COUNT(pa.id) as assessments,
        COUNT(CASE WHEN pa.total_score < 5 THEN 1 END) as minimal,
        COUNT(CASE WHEN pa.total_score BETWEEN 5 AND 9 THEN 1 END) as mild,
        COUNT(CASE WHEN pa.total_score BETWEEN 10 AND 14 THEN 1 END) as moderate,
        COUNT(CASE WHEN pa.total_score BETWEEN 15 AND 19 THEN 1 END) as moderately_severe,
        COUNT(CASE WHEN pa.total_score >= 20 THEN 1 END) as severe
      FROM patient_assessments pa
      JOIN assessment_templates at ON at.id = pa.template_id AND at.code = 'PHQ9'
      WHERE pa.organization_id=$1 AND pa.administered_at>=$2
      GROUP BY DATE_TRUNC('week', pa.administered_at)
      ORDER BY week`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getGAD7Trends(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        DATE_TRUNC('week', pa.administered_at) as week,
        AVG(pa.total_score) as avg_score,
        COUNT(pa.id) as assessments
      FROM patient_assessments pa
      JOIN assessment_templates at ON at.id = pa.template_id AND at.code = 'GAD7'
      WHERE pa.organization_id=$1 AND pa.administered_at>=$2
      GROUP BY DATE_TRUNC('week', pa.administered_at)
      ORDER BY week`,
      [orgId, since],
    ).catch(() => []);
  }

  private async getRiskDistributionTrends(orgId: string, since: string) {
    return this.db.query(
      `SELECT
        risk_level,
        COUNT(*) as count
      FROM patients
      WHERE organization_id=$1 AND status='active'
      GROUP BY risk_level`,
      [orgId],
    ).catch(() => []);
  }

  private async getImprovementRates(orgId: string, since: string) {
    return this.db.queryOne<any>(
      `SELECT
        COUNT(DISTINCT p.id) as total_patients_assessed,
        COUNT(DISTINCT CASE
          WHEN first_score.score > last_score.score THEN p.id
        END) as improved,
        COUNT(DISTINCT CASE
          WHEN first_score.score = last_score.score THEN p.id
        END) as stable,
        COUNT(DISTINCT CASE
          WHEN first_score.score < last_score.score THEN p.id
        END) as declined
      FROM patients p
      JOIN LATERAL (
        SELECT total_score as score FROM patient_assessments pa2
        JOIN assessment_templates at ON at.id = pa2.template_id AND at.code = 'PHQ9'
        WHERE pa2.patient_id = p.id ORDER BY administered_at ASC LIMIT 1
      ) first_score ON true
      JOIN LATERAL (
        SELECT total_score as score FROM patient_assessments pa3
        JOIN assessment_templates at ON at.id = pa3.template_id AND at.code = 'PHQ9'
        WHERE pa3.patient_id = p.id ORDER BY administered_at DESC LIMIT 1
      ) last_score ON true
      WHERE p.organization_id=$1`,
      [orgId],
    ).catch(() => ({ total_patients_assessed: 0, improved: 0, stable: 0, declined: 0 }));
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private parsePeriodToDays(period: string): number {
    const map: Record<string, number> = {
      '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90,
      '180d': 180, '1y': 365, '2y': 730,
    };
    return map[period] || 30;
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
