import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { ListAlertsQueryDto } from './dto/crisis.dto';

const RISK_LEVEL_RANK: Record<string, number> = {
  none: 0, low: 1, moderate: 2, elevated: 3, high: 4, critical: 5,
};

@Injectable()
export class CrisisService {
  private readonly logger = new Logger(CrisisService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // KEYWORD-FIRST PATH (called by SessionsService instead of aiService.detectRisk)
  // ──────────────────────────────────────────────────────────────────────────

  async handleKeywordHit(sessionId: string, orgId: string, matchedKeywords: string[]) {
    const session = await this.db.queryOne<any>(
      `SELECT s.id, s.patient_id, s.therapist_id,
              th.user_id AS therapist_user_id,
              pt.user_id AS patient_user_id
       FROM sessions s
       JOIN therapists th ON th.id = s.therapist_id
       JOIN patients   pt ON pt.id = s.patient_id
       WHERE s.id = $1 AND s.organization_id = $2`,
      [sessionId, orgId],
    );
    if (!session) return;

    // Dedup: suppress if same session already has elevated+ alert < 10 min ago
    const recent = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM risk_assessments
       WHERE session_id = $1
         AND risk_level IN ('elevated', 'high', 'critical')
         AND created_at > NOW() - INTERVAL '10 minutes'
       LIMIT 1`,
      [sessionId],
    );
    if (recent) {
      this.logger.debug(`[CRISIS] Dedup suppressed for session ${sessionId}`);
      return;
    }

    const riskId = uuidv4();

    // 1. Persist keyword-sourced risk assessment immediately (does not depend on GPT)
    try {
      await this.db.execute(
        `INSERT INTO risk_assessments
           (id, patient_id, therapist_id, session_id, organization_id,
            risk_type, risk_level, indicators, ai_detected, ai_confidence,
            source, alert_status, alert_delivered_at)
         VALUES ($1,$2,$3,$4,$5,'general','elevated',$6,false,NULL,'keyword','delivered',NOW())`,
        [riskId, session.patient_id, session.therapist_id, sessionId, orgId,
         JSON.stringify(matchedKeywords)],
      );
    } catch (err) {
      this.logger.error(`[CRISIS] Failed to persist keyword risk assessment: ${(err as Error).message}`);
      // Do not return — still attempt to alert
    }

    // 2. Create/get crisis-priority conversation
    let conversationId: string | null = null;
    try {
      const conv = await this.db.queryOne<{ id: string }>(
        `INSERT INTO conversations
           (id, organization_id, type, patient_id, therapist_id, status, priority)
         VALUES ($1,$2,'patient_therapist',$3,$4,'active','urgent')
         ON CONFLICT (organization_id, patient_id, therapist_id)
           WHERE type = 'patient_therapist' AND status = 'active'
         DO UPDATE SET priority = 'urgent'
         RETURNING id`,
        [uuidv4(), orgId, session.patient_id, session.therapist_id],
      );
      conversationId = conv?.id ?? null;
      if (riskId && conversationId) {
        await this.db.execute(
          `UPDATE risk_assessments SET conversation_id = $1 WHERE id = $2`,
          [conversationId, riskId],
        );
      }
    } catch (err) {
      this.logger.error(`[CRISIS] Failed to create crisis conversation: ${(err as Error).message}`);
    }

    // 3. Notify therapist + admins (each wrapped — one failure does not block others)
    await this.notifyParticipants(orgId, session, 'elevated', matchedKeywords, conversationId);

    // 4. Emit crisis_alert WebSocket event to gateway
    this.eventEmitter.emit('ai.risk_detected', {
      sessionId,
      therapistId: session.therapist_id,
      therapistUserId: session.therapist_user_id,
      patientId: session.patient_id,
      orgId,
      riskLevel: 'elevated',
      riskType: 'general',
      indicators: matchedKeywords,
      confidence: null,
      recommendedAction: 'Review session transcript immediately. Keywords detected: ' + matchedKeywords.join(', '),
      timestamp: new Date().toISOString(),
      risk_assessment_id: riskId,
      conversation_id: conversationId,
    });

    // 5. Emit crisis_support to patient (no risk details — just supportive handoff)
    if (session.patient_user_id) {
      this.eventEmitter.emit('crisis.support', {
        patientUserId: session.patient_user_id,
        conversationId,
        message: 'Your therapist has been notified. If you need immediate help, call 988.',
      });
    }

    // 6. Fire-and-forget: AI refinement via event (AIService listens)
    this.eventEmitter.emit('crisis.run_ai', { sessionId, orgId });

    this.logger.warn(`[CRISIS] Keyword alert delivered — session=${sessionId} risk=${riskId}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AI REFINEMENT (listens to AIService's analysis result)
  // ──────────────────────────────────────────────────────────────────────────

  @OnEvent('crisis.ai_analyzed')
  async handleAiAnalyzed(payload: {
    sessionId: string;
    orgId: string;
    riskDetected: boolean;
    riskLevel: string;
    riskType: string;
    indicators: string[];
    confidence: number;
    recommendedAction: string;
    therapistId: string;
    therapistUserId: string;
    patientId: string;
    patientUserId: string;
  }) {
    if (!payload.riskDetected || payload.riskLevel === 'none') return;

    // Only re-alert if AI level is higher than 'elevated' (the keyword-first level)
    if (RISK_LEVEL_RANK[payload.riskLevel] <= RISK_LEVEL_RANK['elevated']) return;

    // Dedup: don't re-alert if same level was already sent recently
    const recent = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM risk_assessments
       WHERE session_id = $1 AND risk_level = $2
         AND created_at > NOW() - INTERVAL '10 minutes'
       LIMIT 1`,
      [payload.sessionId, payload.riskLevel],
    );
    if (recent) return;

    const riskId = uuidv4();
    try {
      await this.db.execute(
        `INSERT INTO risk_assessments
           (id, patient_id, therapist_id, session_id, organization_id,
            risk_type, risk_level, indicators, ai_detected, ai_confidence,
            source, alert_status, alert_delivered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,'ai','delivered',NOW())`,
        [riskId, payload.patientId, payload.therapistId, payload.sessionId, payload.orgId,
         payload.riskType, payload.riskLevel, JSON.stringify(payload.indicators), payload.confidence],
      );
    } catch (err) {
      this.logger.error(`[CRISIS] AI escalation persist failed: ${(err as Error).message}`);
    }

    // Re-alert with upgraded severity
    this.eventEmitter.emit('ai.risk_detected', {
      sessionId: payload.sessionId,
      therapistId: payload.therapistId,
      therapistUserId: payload.therapistUserId,
      patientId: payload.patientId,
      orgId: payload.orgId,
      riskLevel: payload.riskLevel,
      riskType: payload.riskType,
      indicators: payload.indicators,
      confidence: payload.confidence,
      recommendedAction: payload.recommendedAction,
      timestamp: new Date().toISOString(),
      risk_assessment_id: riskId,
    });

    this.logger.warn(`[CRISIS] AI upgraded alert to ${payload.riskLevel} for session ${payload.sessionId}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SWEEPER — re-emit undelivered alerts every 2 minutes
  // ──────────────────────────────────────────────────────────────────────────

  @Cron('*/2 * * * *')
  async sweepUndeliveredAlerts() {
    const stale = await this.db.query<any>(
      `SELECT ra.id, ra.session_id, ra.organization_id, ra.patient_id, ra.therapist_id,
              ra.risk_level, ra.risk_type, ra.indicators, ra.ai_confidence, ra.conversation_id,
              th.user_id AS therapist_user_id,
              pt.user_id AS patient_user_id
       FROM risk_assessments ra
       JOIN therapists th ON th.id = ra.therapist_id
       JOIN patients   pt ON pt.id = ra.patient_id
       WHERE ra.alert_status = 'pending'
         AND ra.created_at < NOW() - INTERVAL '2 minutes'
         AND ra.created_at > NOW() - INTERVAL '24 hours'`,
      [],
    );

    for (const row of stale) {
      try {
        await this.notifyParticipants(
          row.organization_id, row, row.risk_level, row.indicators || [], row.conversation_id,
        );
        this.eventEmitter.emit('ai.risk_detected', {
          sessionId: row.session_id,
          therapistId: row.therapist_id,
          therapistUserId: row.therapist_user_id,
          patientId: row.patient_id,
          orgId: row.organization_id,
          riskLevel: row.risk_level,
          riskType: row.risk_type,
          indicators: row.indicators || [],
          confidence: row.ai_confidence,
          recommendedAction: 'Sweeper re-alert — please acknowledge.',
          timestamp: new Date().toISOString(),
          risk_assessment_id: row.id,
          conversation_id: row.conversation_id,
        });
        await this.db.execute(
          `UPDATE risk_assessments SET alert_status = 'delivered', alert_delivered_at = NOW() WHERE id = $1`,
          [row.id],
        );
        this.logger.warn(`[CRISIS SWEEPER] Re-delivered alert for risk_assessment ${row.id}`);
      } catch (err) {
        this.logger.error(`[CRISIS SWEEPER] Failed to re-deliver ${row.id}: ${(err as Error).message}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CONTROLLER-FACING METHODS
  // ──────────────────────────────────────────────────────────────────────────

  async listAlerts(userId: string, orgId: string, role: string, query: ListAlertsQueryDto) {
    const params: any[] = [orgId];
    const conditions: string[] = ['ra.organization_id = $1'];

    // Therapists only see their own alerts
    if (!['admin', 'super_admin'].includes(role)) {
      params.push(userId);
      conditions.push(`th.user_id = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`ra.alert_status = $${params.length}`);
    }
    if (query.level) {
      params.push(query.level);
      conditions.push(`ra.risk_level = $${params.length}`);
    }
    if (query.from) {
      params.push(query.from);
      conditions.push(`ra.created_at >= $${params.length}`);
    }
    if (query.to) {
      params.push(query.to);
      conditions.push(`ra.created_at <= $${params.length}`);
    }

    params.push(query.limit ?? 50);
    const rows = await this.db.query<any>(
      `SELECT ra.*, th.user_id AS therapist_user_id,
              tu.first_name || ' ' || tu.last_name AS therapist_name,
              pt.user_id AS patient_user_id,
              pu.first_name || ' ' || pu.last_name AS patient_name
       FROM risk_assessments ra
       JOIN therapists th ON th.id = ra.therapist_id
       JOIN patients   pt ON pt.id = ra.patient_id
       JOIN users tu ON tu.id = th.user_id
       JOIN users pu ON pu.id = pt.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ra.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows;
  }

  async acknowledgeAlert(riskId: string, userId: string, orgId: string, role: string) {
    const alert = await this.db.queryOne<any>(
      `SELECT ra.*, th.user_id AS therapist_user_id
       FROM risk_assessments ra
       JOIN therapists th ON th.id = ra.therapist_id
       WHERE ra.id = $1 AND ra.organization_id = $2`,
      [riskId, orgId],
    );
    if (!alert) throw new NotFoundException('Alert not found');
    if (!['admin', 'super_admin'].includes(role) && alert.therapist_user_id !== userId) {
      throw new ForbiddenException('Cannot acknowledge this alert');
    }

    await this.db.execute(
      `UPDATE risk_assessments
       SET alert_status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW()
       WHERE id = $2`,
      [userId, riskId],
    );
    return { acknowledged: true };
  }

  async getActiveCount(orgId: string) {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM risk_assessments
       WHERE organization_id = $1
         AND alert_status IN ('pending', 'delivered')
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [orgId],
    );
    return { count: Number(row?.count ?? 0) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private async notifyParticipants(
    orgId: string,
    session: { therapist_id: string; patient_id?: string; therapist_user_id?: string },
    riskLevel: string,
    indicators: string[],
    conversationId: string | null,
  ) {
    const title = `Crisis Alert — ${riskLevel.toUpperCase()}`;
    const body = `Risk indicators detected: ${indicators.join(', ')}. Open crisis chat to respond.`;

    const adminUsers = await this.db.query<{ id: string }>(
      `SELECT id FROM users WHERE organization_id = $1 AND role IN ('admin', 'super_admin') AND deleted_at IS NULL`,
      [orgId],
    );
    const therapistRow = await this.db.queryOne<{ user_id: string }>(
      `SELECT user_id FROM therapists WHERE id = $1`,
      [session.therapist_id],
    );

    const recipientIds = new Set<string>();
    adminUsers.forEach(u => recipientIds.add(u.id));
    if (therapistRow?.user_id) recipientIds.add(therapistRow.user_id);

    for (const userId of recipientIds) {
      try {
        await this.db.execute(
          `INSERT INTO notifications (id, organization_id, user_id, channel, title, body, priority, status, created_at)
           VALUES ($1,$2,$3,'in_app',$4,$5,'urgent','pending',NOW())`,
          [uuidv4(), orgId, userId, title, body],
        );
      } catch (err) {
        // Retry once
        try {
          await this.db.execute(
            `INSERT INTO notifications (id, organization_id, user_id, channel, title, body, priority, status, created_at)
             VALUES ($1,$2,$3,'in_app',$4,$5,'urgent','pending',NOW())`,
            [uuidv4(), orgId, userId, title, body],
          );
        } catch (retryErr) {
          this.logger.error(`[CRISIS] Notification insert failed for user ${userId}: ${(retryErr as Error).message}`);
        }
      }
    }
  }
}
