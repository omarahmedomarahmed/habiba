import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { ModelGatewayService } from './model-gateway.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AICompanionService {
  private readonly logger = new Logger(AICompanionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly modelGateway: ModelGatewayService,
  ) {}

  // ── 1. Daily check-in (9am every day) ──────────────────────────────────────
  @Cron('0 9 * * *', { timeZone: 'America/New_York' })
  async sendDailyCheckIns() {
    this.logger.log('[AI Companion] Running daily check-in cron');
    const patients = await this.db.query<any>(
      `SELECT p.id, p.first_name, p.user_id, p.organization_id,
              p.metadata->>'last_mood' AS last_mood,
              p.metadata->>'emotional_baseline' AS emotional_baseline
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE u.deleted_at IS NULL AND p.deleted_at IS NULL
       LIMIT 500`,
      [],
    );

    for (const patient of patients) {
      await this.sendCompanionMessage(patient, 'daily_checkin').catch(err =>
        this.logger.warn(`[Companion] daily_checkin failed for ${patient.id}: ${err?.message}`)
      );
    }
  }

  // ── 2. Pre-session prep (24h before session) ───────────────────────────────
  @Cron('0 10 * * *', { timeZone: 'America/New_York' })
  async sendPreSessionMessages() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayStr = tomorrow.toISOString().slice(0, 10);

    const sessions = await this.db.query<any>(
      `SELECT s.id, s.patient_id, s.scheduled_at,
              t.first_name AS therapist_first, t.last_name AS therapist_last,
              p.first_name AS patient_first, p.user_id, p.organization_id
       FROM sessions s
       JOIN patients p ON p.id = s.patient_id
       JOIN therapists t ON t.id = s.therapist_id
       WHERE s.status = 'scheduled'
         AND DATE(s.scheduled_at) = $1
         AND s.deleted_at IS NULL`,
      [dayStr],
    );

    for (const session of sessions) {
      const patient = {
        id: session.patient_id,
        first_name: session.patient_first,
        user_id: session.user_id,
        organization_id: session.organization_id,
      };
      await this.sendCompanionMessage(patient, 'pre_session', {
        therapist_name: `${session.therapist_first} ${session.therapist_last}`,
        session_time: new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }).catch(() => {});
    }
  }

  // ── 3. Post-session reflection (4h after session ends) ─────────────────────
  @Cron('*/30 * * * *') // runs every 30min, finds sessions that ended ~4h ago
  async sendPostSessionReflections() {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const window = new Date(Date.now() - 4.5 * 60 * 60 * 1000);

    const sessions = await this.db.query<any>(
      `SELECT s.id, s.patient_id, s.ended_at,
              p.first_name, p.user_id, p.organization_id,
              (SELECT array_agg(ts.text) FROM transcript_segments ts
               JOIN transcripts t2 ON t2.id = ts.transcript_id
               WHERE t2.session_id = s.id
               ORDER BY ts.sequence_number DESC LIMIT 3) AS last_lines
       FROM sessions s
       JOIN patients p ON p.id = s.patient_id
       WHERE s.status = 'completed'
         AND s.ended_at BETWEEN $1 AND $2
         AND s.deleted_at IS NULL`,
      [window.toISOString(), fourHoursAgo.toISOString()],
    );

    for (const session of sessions) {
      const topic = session.last_lines?.[0]?.slice(0, 80) || 'your session today';
      await this.sendCompanionMessage(
        { id: session.patient_id, first_name: session.first_name, user_id: session.user_id, organization_id: session.organization_id },
        'post_session', { session_topic: topic }
      ).catch(() => {});
    }
  }

  // ── 4. Re-engagement (3 days no login) ────────────────────────────────────
  @Cron('0 11 * * *', { timeZone: 'America/New_York' })
  async sendReEngagementMessages() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const patients = await this.db.query<any>(
      `SELECT p.id, p.first_name, p.user_id, p.organization_id
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE (u.last_login_at IS NULL OR u.last_login_at < $1)
         AND u.deleted_at IS NULL
         AND p.deleted_at IS NULL
       LIMIT 100`,
      [threeDaysAgo.toISOString()],
    );

    for (const patient of patients) {
      // Check if we already sent a re-engagement in the last 3 days
      const recent = await this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM notifications
         WHERE user_id = $1 AND type = 'ai_companion'
           AND created_at > $2`,
        [patient.user_id, threeDaysAgo.toISOString()],
      );
      if (parseInt(recent?.count || '0') > 0) continue;

      await this.sendCompanionMessage(patient, 'reengagement').catch(() => {});
    }
  }

  // ── Core: generate + insert notification ──────────────────────────────────
  private async sendCompanionMessage(
    patient: { id: string; first_name: string; user_id: string; organization_id: string; last_mood?: string; emotional_baseline?: string },
    messageType: 'daily_checkin' | 'pre_session' | 'post_session' | 'reengagement' | 'crisis_followup',
    context: Record<string, string> = {},
  ) {
    const prompts: Record<string, string> = {
      daily_checkin: `You are a warm AI companion for ${patient.first_name}, a therapy patient.
Write a brief, warm check-in message (2-3 sentences max). Reference their emotional journey if known: ${patient.emotional_baseline || 'first contact'}.
Their recent mood: ${patient.last_mood || 'unknown'}. Be specific, warm, and human — not clinical or generic.`,

      pre_session: `You are a warm AI companion for ${patient.first_name}.
They have a therapy session with ${context.therapist_name || 'their therapist'} tomorrow at ${context.session_time || 'a scheduled time'}.
Write a brief prep message (2-3 sentences) that helps them feel ready and think about what they want to bring up. Be warm, not formal.`,

      post_session: `You are a warm AI companion for ${patient.first_name}.
They just had a therapy session ${context.session_topic ? `that touched on: "${context.session_topic}"` : ''}.
Write a brief, reflective message (2-3 sentences) inviting them to notice what's staying with them from the session. Be gentle and curious.`,

      reengagement: `You are a warm AI companion for ${patient.first_name}.
They haven't logged in for a few days. Write a brief, non-judgmental check-in (2 sentences max). No pressure. Just warmth.`,

      crisis_followup: `You are a warm AI companion for ${patient.first_name}.
They recently went through a difficult moment. Write a brief, gentle check-in (2-3 sentences) that shows you care and reminds them support is available. Include: if in crisis, text 988.`,
    };

    const response = await this.modelGateway.complete({
      task_type: 'chat',
      messages: [{ role: 'user', content: prompts[messageType] }],
      session_id: undefined,
      patient_id: patient.id,
      organization_id: patient.organization_id,
    });

    const body = response.content?.trim();
    if (!body) return;

    const titles: Record<string, string> = {
      daily_checkin: `Good morning, ${patient.first_name} ☀️`,
      pre_session: 'Your session is tomorrow',
      post_session: 'Reflecting on today',
      reengagement: `Hey ${patient.first_name}, checking in`,
      crisis_followup: 'We\'re here for you',
    };

    await this.db.execute(
      `INSERT INTO notifications
         (id, organization_id, user_id, channel, type, title, body, priority, status, created_at)
       VALUES ($1, $2, $3, 'in_app', 'ai_companion', $4, $5, 'normal', 'pending', NOW())`,
      [uuidv4(), patient.organization_id, patient.user_id, titles[messageType], body],
    );

    this.logger.debug(`[Companion] Sent ${messageType} to patient ${patient.id}`);
  }

  // ── Public trigger for crisis follow-up (called from ai.service.ts) ───────
  async triggerCrisisFollowUp(patientId: string, orgId: string) {
    const patient = await this.db.queryOne<any>(
      `SELECT p.id, p.first_name, p.user_id, p.organization_id
       FROM patients p WHERE p.id = $1 AND p.organization_id = $2`,
      [patientId, orgId],
    );
    if (!patient) return;
    await this.sendCompanionMessage(patient, 'crisis_followup').catch(() => {});
  }
}
