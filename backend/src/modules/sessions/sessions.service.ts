import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../../database/database.service';
import { AIService } from '../ai/ai.service';
import { BillingService } from '../billing/billing.service';
import { CrisisService } from '../crisis/crisis.service';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';

// Extended crisis keyword list for live transcript scanning
const LIVE_CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'kill yourself', 'end my life',
  'want to die', "can't go on", 'better off dead', 'no point living',
  'burden to everyone', 'better off without me', 'not worth living',
  'no reason to live', 'self harm', 'self-harm', 'cut myself', 'hurt myself',
  'burn myself', 'overdose', 'shoot myself', 'hang myself', 'jump off',
  'being abused', 'hitting me', 'he hits me', 'hurts me',
  'someone is hurting me', "i can't do this anymore", 'i give up',
  "i won't be here",
];

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AIService)) private readonly aiService: AIService,
    private readonly crisisService: CrisisService,
    @Inject(forwardRef(() => BillingService)) private readonly billingService: BillingService,
    private readonly mail: MailService,
  ) {}

  async findAll(orgId: string, query: any = {}) {
    const { therapist_id, patient_id, status, date_from, date_to, limit = 20 } = query;
    const params: any[] = [orgId];
    let whereClauses = ['s.organization_id = $1'];

    if (therapist_id) { params.push(therapist_id); whereClauses.push(`s.therapist_id = $${params.length}`); }
    if (patient_id) { params.push(patient_id); whereClauses.push(`s.patient_id = $${params.length}`); }
    if (status) { params.push(status); whereClauses.push(`s.status = $${params.length}`); }
    if (date_from) { params.push(date_from); whereClauses.push(`s.scheduled_at >= $${params.length}`); }
    if (date_to) { params.push(date_to); whereClauses.push(`s.scheduled_at <= $${params.length}`); }

    params.push(Math.min(Number(limit), 100));

    let sessions: any[];
    try {
      sessions = await this.db.query(
        `SELECT s.*,
          COALESCE(
            NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
            s.patient_name_guest,
            s.patient_email,
            'Guest Patient'
          ) as patient_name,
          COALESCE(p.email, s.patient_email) as patient_email,
          t.display_name as therapist_name,
          (SELECT COUNT(*) FROM transcript_segments ts JOIN transcripts tr ON tr.id = ts.transcript_id WHERE tr.session_id = s.id) as transcript_segment_count,
          n.id as has_ai_note,
          n.id as note_id,
          CASE WHEN n.status = 'approved' THEN 'finalized' ELSE n.status END as note_status
         FROM sessions s
         LEFT JOIN LATERAL (
           SELECT id, status FROM ai_session_notes
           WHERE session_id = s.id AND status <> 'archived'
           ORDER BY created_at DESC LIMIT 1
         ) n ON true
         LEFT JOIN patients p ON p.id = s.patient_id
         JOIN therapists t ON t.id = s.therapist_id
         WHERE ${whereClauses.join(' AND ')}
         ORDER BY s.scheduled_at DESC
         LIMIT $${params.length}`,
        params,
      );
    } catch (err: any) {
      if (err?.code !== '42703') throw err;
      // Fall back to base schema (migration 006) — no patient_name_guest or patient_email columns
      sessions = await this.db.query(
        `SELECT s.*,
          COALESCE(
            NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
            'Guest Patient'
          ) as patient_name,
          p.email as patient_email,
          t.display_name as therapist_name,
          n.id as has_ai_note,
          n.id as note_id,
          CASE WHEN n.status = 'approved' THEN 'finalized' ELSE n.status END as note_status
         FROM sessions s
         LEFT JOIN LATERAL (
           SELECT id, status FROM ai_session_notes
           WHERE session_id = s.id AND status <> 'archived'
           ORDER BY created_at DESC LIMIT 1
         ) n ON true
         LEFT JOIN patients p ON p.id = s.patient_id
         JOIN therapists t ON t.id = s.therapist_id
         WHERE ${whereClauses.join(' AND ')}
         ORDER BY s.scheduled_at DESC
         LIMIT $${params.length}`,
        params,
      );
    }

    return sessions;
  }

  async findOne(id: string, orgId: string) {
    // Try with migration-030 columns (patient_name_guest, patient_email); fall back to base schema if columns absent
    let session: any = null;
    try {
      session = await this.db.queryOne(
        `SELECT s.*,
          COALESCE(
            NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
            s.patient_name_guest,
            s.patient_email,
            'Guest Patient'
          ) as patient_name,
          COALESCE(p.email, s.patient_email) as patient_email,
          t.display_name as therapist_name,
          t.user_id as therapist_user_id
         FROM sessions s
         LEFT JOIN patients p ON p.id = s.patient_id
         JOIN therapists t ON t.id = s.therapist_id
         WHERE s.id = $1 AND s.organization_id = $2`,
        [id, orgId],
      );
    } catch (err: any) {
      if (err?.code === '42703') {
        // Migration 030 columns don't exist yet — use base schema
        session = await this.db.queryOne(
          `SELECT s.*,
            COALESCE(
              NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
              'Guest Patient'
            ) as patient_name,
            p.email as patient_email,
            t.display_name as therapist_name,
            t.user_id as therapist_user_id
           FROM sessions s
           LEFT JOIN patients p ON p.id = s.patient_id
           JOIN therapists t ON t.id = s.therapist_id
           WHERE s.id = $1 AND s.organization_id = $2`,
          [id, orgId],
        );
      } else {
        throw err;
      }
    }

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getTherapistUsage(therapistId: string): Promise<{ plan_key: string; sessions_this_month: number; max_sessions_month: number | null; trial_session_used: boolean }> {
    const row = await this.db.queryOne<any>(
      `SELECT t.current_plan_key, t.trial_session_used,
              sp.max_sessions_month,
              (SELECT COUNT(*) FROM sessions s
               WHERE s.therapist_id = t.id
                 AND s.status = 'completed'
                 AND date_trunc('month', s.ended_at) = date_trunc('month', NOW())
              ) AS sessions_this_month
       FROM therapists t
       LEFT JOIN subscription_plans sp ON sp.plan_key = t.current_plan_key
       WHERE t.id = $1`,
      [therapistId],
    );
    return {
      plan_key: row?.current_plan_key || 'free_trial',
      sessions_this_month: parseInt(row?.sessions_this_month || '0'),
      max_sessions_month: row?.max_sessions_month ?? null,
      trial_session_used: row?.trial_session_used || false,
    };
  }

  private async checkSessionAllowance(therapistId: string, orgId: string): Promise<void> {
    const usage = await this.getTherapistUsage(therapistId);

    if (usage.plan_key === 'free_trial') {
      if (usage.trial_session_used) {
        throw new Error('UPGRADE_REQUIRED:free_trial_used');
      }
      return;
    }

    if (usage.plan_key === 'pay_per_session') {
      // Block if any pending bill exists
      const pendingBill = await this.billingService.getPendingBillForTherapist(therapistId);
      if (pendingBill) {
        const err = new Error('PAYMENT_REQUIRED:unpaid_session_bill') as any;
        err.charge_id = pendingBill.id;
        err.amount_due = pendingBill.amount_due_usd;
        err.checkout_url = pendingBill.stripe_checkout_url;
        throw err;
      }
      return;
    }

    if (usage.max_sessions_month !== null && usage.sessions_this_month >= usage.max_sessions_month) {
      throw new Error(`SESSION_LIMIT_REACHED:${usage.sessions_this_month}:${usage.max_sessions_month}`);
    }
  }

  async create(orgId: string, dto: any) {
    // Check plan allowance before creating session
    if (dto.therapist_id) {
      await this.checkSessionAllowance(dto.therapist_id, orgId);
    }

    // For offline/in-person sessions: auto-create guest patient from name
    if (!dto.patient_id && dto.patient_name) {
      dto.patient_id = await this.findOrCreateGuestPatient(
        orgId, dto.therapist_id, dto.patient_name, dto.patient_email || null,
      );
    }

    const sessionId = uuidv4();
    const isOffline = dto.modality === 'in_person';

    // Get session number for this therapist-patient pair
    const sessionCount = dto.patient_id ? await this.db.queryOne<any>(
      `SELECT COUNT(*) as count FROM sessions WHERE therapist_id = $1 AND patient_id = $2`,
      [dto.therapist_id, dto.patient_id],
    ) : { count: '0' };

    const sessionNumber = (parseInt(sessionCount?.count || '0') + 1);

    // Create video room if needed (only for non-offline video sessions)
    let videoRoomId = null;
    let videoRoomUrl = null;

    if (dto.modality === 'video' && !isOffline && this.config.get('video.dailyApiKey')) {
      // Create Daily.co room
      try {
        const room = await this.createDailyRoom(sessionId);
        videoRoomId = room.name;
        videoRoomUrl = room.url;
      } catch (err) {
        console.warn('Could not create Daily.co room:', err.message);
      }
    }

    const priceCents = dto.session_price_cents ? parseInt(String(dto.session_price_cents)) : null;
    const paymentStatus = priceCents && priceCents > 0 ? 'pending' : 'not_required';

    // Normalize session_type — 'individual' is not in the CHECK constraint; map it to 'standard'
    const sessionType = (['standard','radar','group','phone','in_person','intake','follow_up'] as const)
      .includes(dto.session_type as any) ? dto.session_type : 'standard';

    // Try full INSERT (with columns added in migrations 029-031).
    // Fall back to base schema INSERT if those columns don't exist yet in this environment.
    let result: any[];
    try {
      result = await this.db.query(
        `INSERT INTO sessions (
          id, organization_id, therapist_id, patient_id,
          session_type, modality, status, scheduled_at,
          session_number, title, recording_enabled, scribe_enabled,
          video_room_id, video_room_url, pre_session_notes, join_token,
          patient_email, auto_generate_note,
          session_price_cents, patient_payment_status
        ) VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8,$9,$10,$11,$12,$13,$14,gen_random_uuid(),$15,$16,$17,$18)
        RETURNING *`,
        [
          sessionId, orgId, dto.therapist_id, dto.patient_id || null,
          sessionType, dto.modality || 'video',
          dto.scheduled_at || new Date().toISOString(), sessionNumber,
          dto.title || (isOffline ? 'In-Person Session' : `Session ${sessionNumber}`),
          dto.recording_enabled || false, dto.scribe_enabled !== false,
          videoRoomId, videoRoomUrl, dto.pre_session_notes || null,
          dto.patient_email || null, dto.auto_generate_note !== false,
          priceCents, paymentStatus,
        ],
      );
    } catch (err: any) {
      if (err?.code !== '42703') throw err; // re-throw anything except "column does not exist"
      // Fallback: base schema only (migration 006 columns)
      result = await this.db.query(
        `INSERT INTO sessions (
          id, organization_id, therapist_id, patient_id,
          session_type, modality, status, scheduled_at,
          session_number, title, recording_enabled, scribe_enabled,
          video_room_id, video_room_url, pre_session_notes
        ) VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [
          sessionId, orgId, dto.therapist_id, dto.patient_id || null,
          sessionType, dto.modality || 'video',
          dto.scheduled_at || new Date().toISOString(), sessionNumber,
          dto.title || (isOffline ? 'In-Person Session' : `Session ${sessionNumber}`),
          dto.recording_enabled || false, dto.scribe_enabled !== false,
          videoRoomId, videoRoomUrl, dto.pre_session_notes || null,
        ],
      );
    }

    // Log timeline event only when a patient is linked
    if (dto.patient_id) {
      await this.db.execute(
        `INSERT INTO patient_timeline_events (id, patient_id, organization_id, event_type, title, reference_id, reference_type)
         VALUES ($1, $2, $3, 'session_scheduled', 'Session scheduled', $4, 'session')`,
        [uuidv4(), dto.patient_id, orgId, sessionId],
      );
    }

    const session = result[0];
    return { ...session, auto_start: !!dto.auto_start };
  }

  private async findOrCreateGuestPatient(
    orgId: string,
    therapistId: string,
    name: string,
    email: string | null,
  ): Promise<string> {
    if (email) {
      const existing = await this.db.queryOne<{ id: string }>(
        `SELECT id FROM patients WHERE organization_id = $1 AND email = $2 AND deleted_at IS NULL LIMIT 1`,
        [orgId, email.toLowerCase()],
      );
      if (existing) return existing.id;
    }

    const patientId = uuidv4();
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || null;

    await this.db.execute(
      `INSERT INTO patients (id, organization_id, primary_therapist_id, first_name, last_name, email, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'offline_session', 'active')`,
      [patientId, orgId, therapistId, firstName, lastName, email?.toLowerCase() || null],
    );
    await this.db.execute(
      `INSERT INTO patient_profiles (id, patient_id) VALUES ($1, $2)`,
      [uuidv4(), patientId],
    );
    await this.db.execute(
      `INSERT INTO therapist_patient_assignments (id, therapist_id, patient_id, organization_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (therapist_id, patient_id) DO NOTHING`,
      [uuidv4(), therapistId, patientId, orgId, therapistId],
    );

    return patientId;
  }

  async shareReportWithPatient(sessionId: string, orgId: string, email: string, noteId?: string) {
    const session = await this.findOne(sessionId, orgId);

    // Get the approved AI note (or specific one)
    const note = await this.db.queryOne<any>(
      noteId
        ? `SELECT n.*, t.display_name AS therapist_name FROM ai_session_notes n JOIN therapists t ON t.id = n.therapist_id WHERE n.id = $1 AND n.organization_id = $2`
        : `SELECT n.*, t.display_name AS therapist_name FROM ai_session_notes n JOIN therapists t ON t.id = n.therapist_id WHERE n.session_id = $1 AND n.organization_id = $2 AND n.status = 'approved' ORDER BY n.created_at DESC LIMIT 1`,
      noteId ? [noteId, orgId] : [sessionId, orgId],
    );

    if (!note) throw new Error('No approved note found for this session');

    const structuredContent = typeof note.structured_content === 'string'
      ? JSON.parse(note.structured_content)
      : note.structured_content || {};

    // Import mail service dynamically to avoid circular dep issues
    const { MailModule } = await import('../mail/mail.module');
    void MailModule;

    await this.db.execute(
      `INSERT INTO phi_access_log (id, user_id, organization_id, resource_type, resource_id, action, metadata)
       VALUES ($1, $2, $3, 'session_report', $4, 'share_with_patient', $5)`,
      [uuidv4(), session.therapist_id, orgId, sessionId, JSON.stringify({ email, note_id: note.id })],
    ).catch(() => {});

    return {
      shared: true,
      email,
      therapist_name: note.therapist_name,
      session_date: session.scheduled_at,
      content: structuredContent,
    };
  }

  async updateStatus(id: string, orgId: string, status: string, metadata: any = {}) {
    const session = await this.findOne(id, orgId);

    const validTransitions: Record<string, string[]> = {
      scheduled: ['waiting', 'in_progress', 'cancelled', 'no_show'],
      waiting: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: ['archived'],
      cancelled: [],
      no_show: [],
    };

    if (!validTransitions[session.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from '${session.status}' to '${status}'`,
      );
    }

    const updates: Record<string, any> = { status };

    if (status === 'in_progress') {
      updates.started_at = new Date().toISOString();

      // Create transcript record
      await this.db.execute(
        `INSERT INTO transcripts (id, session_id, patient_id, therapist_id, organization_id, status, language)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         ON CONFLICT (session_id) DO NOTHING`,
        [uuidv4(), id, session.patient_id || null, session.therapist_id, orgId, metadata.language || 'en'],
      );
    }

    if (status === 'completed') {
      updates.ended_at = new Date().toISOString();
      if (session.started_at) {
        updates.duration_minutes = Math.round(
          (new Date().getTime() - new Date(session.started_at).getTime()) / 60000,
        );
      }

      // Log timeline
      if (session.patient_id) {
        await this.db.execute(
          `INSERT INTO patient_timeline_events (id, patient_id, organization_id, event_type, title, reference_id, reference_type)
           VALUES ($1, $2, $3, 'session_completed', 'Session completed', $4, 'session')`,
          [uuidv4(), session.patient_id, orgId, id],
        );
      }

      // Fire billing hook — never blocks session completion
      this.billingService.onSessionCompleted({
        id,
        therapist_id: session.therapist_id,
        organization_id: orgId,
        scheduled_at: session.scheduled_at,
      }).catch((e) => this.logger.error(`Billing hook error: ${e.message}`));

      // Auto-generate AI output (SOAP notes, insights, treatment plan)
      this.aiService.autoGenerateSessionOutput(id, orgId).catch(
        (e) => this.logger.error(`Auto-generate failed for session ${id}: ${e.message}`),
      );
    }

    const setClauses = Object.entries(updates)
      .map(([key, _], i) => `${key} = $${i + 1}`)
      .join(', ');

    const result = await this.db.query(
      `UPDATE sessions SET ${setClauses}, updated_at = NOW() WHERE id = $${Object.keys(updates).length + 1} RETURNING *`,
      [...Object.values(updates), id],
    );

    return result[0];
  }

  async getTranscript(sessionId: string, orgId: string) {
    await this.findOne(sessionId, orgId);

    const transcript = await this.db.queryOne(
      'SELECT * FROM transcripts WHERE session_id = $1',
      [sessionId],
    );

    if (!transcript) return { transcript: null, segments: [] };

    const segments = await this.db.query(
      `SELECT * FROM transcript_segments WHERE session_id = $1 ORDER BY sequence_number ASC`,
      [sessionId],
    );

    return { transcript, segments };
  }

  async addTranscriptSegment(sessionId: string, orgId: string, dto: any) {
    await this.findOne(sessionId, orgId);

    const transcript = await this.db.queryOne<any>(
      'SELECT * FROM transcripts WHERE session_id = $1',
      [sessionId],
    );

    if (!transcript) throw new NotFoundException('Transcript not found for session');

    // Get next sequence number
    const lastSegment = await this.db.queryOne<any>(
      'SELECT MAX(sequence_number) as max_seq FROM transcript_segments WHERE transcript_id = $1',
      [transcript.id],
    );

    const sequenceNumber = (lastSegment?.max_seq || 0) + 1;

    const result = await this.db.query(
      `INSERT INTO transcript_segments (
        id, transcript_id, session_id, patient_id, organization_id,
        speaker, speaker_label, start_time_ms, end_time_ms, text,
        confidence, sequence_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        uuidv4(), transcript.id, sessionId, transcript.patient_id, orgId,
        dto.speaker || 'unknown', dto.speaker_label || null,
        dto.start_time_ms, dto.end_time_ms, dto.text,
        dto.confidence || null, sequenceNumber,
      ],
    );

    // Crisis keyword scan — keyword-first, loss-proof (never blocks the response)
    if (dto.text && typeof dto.text === 'string') {
      const lower = dto.text.toLowerCase();
      const matchedKeywords = LIVE_CRISIS_KEYWORDS.filter((kw) => lower.includes(kw));
      if (matchedKeywords.length > 0) {
        this.logger.warn(`[CRISIS SCAN] Keywords matched in session ${sessionId}: ${matchedKeywords.join(', ')}`);
        this.crisisService.handleKeywordHit(sessionId, orgId, matchedKeywords).catch((err) => {
          this.logger.error(`[CRISIS SCAN] handleKeywordHit failed for session ${sessionId}: ${err?.message}`);
        });
      }

      // Emotional context detection every 5 segments — cost control ($0.002/call)
      if (sequenceNumber > 0 && sequenceNumber % 5 === 0) {
        const session = await this.db.queryOne<any>(
          'SELECT patient_id FROM sessions WHERE id = $1',
          [sessionId],
        );
        if (session?.patient_id) {
          // Collect last ~500 chars of speech for context
          const recentSegments = await this.db.query<{ text: string }>(
            `SELECT text FROM transcript_segments
             WHERE transcript_id = $1
             ORDER BY sequence_number DESC LIMIT 5`,
            [transcript.id],
          );
          const recentText = recentSegments.map(s => s.text).reverse().join(' ').slice(-500);
          this.aiService.detectEmotionalContext(sessionId, orgId, recentText, session.patient_id).catch((err) => {
            this.logger.debug(`[EMOTIONAL AI] detectEmotionalContext failed: ${err?.message}`);
          });
        }
      }
    }

    return result[0];
  }

  async getAINote(sessionId: string, orgId: string) {
    await this.findOne(sessionId, orgId);
    return this.db.queryOne(
      `SELECT * FROM ai_session_notes WHERE session_id = $1 ORDER BY version DESC LIMIT 1`,
      [sessionId],
    );
  }

  async getMyReports(patientId: string, orgId: string) {
    return this.db.query(
      `SELECT sr.id, sr.report_type, sr.status, sr.created_at, sr.signed_at,
              s.scheduled_at AS session_date,
              t.display_name AS therapist_name,
              sr.content->>'summary' AS summary
       FROM session_reports sr
       JOIN sessions s ON s.id = sr.session_id
       JOIN therapists t ON t.id = sr.therapist_id
       WHERE sr.patient_id = $1
         AND sr.organization_id = $2
         AND sr.status = 'signed'
       ORDER BY sr.created_at DESC
       LIMIT 50`,
      [patientId, orgId],
    ).catch(() => []);
  }

  async getDashboardStats(orgId: string, therapistId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const [todaySessions, pendingNotes, activePatients, radarRequests] = await Promise.all([
      this.db.queryOne<any>(
        `SELECT COUNT(*) as count FROM sessions
         WHERE organization_id = $1 AND therapist_id = $2
           AND scheduled_at BETWEEN $3 AND $4`,
        [orgId, therapistId, startOfDay, endOfDay],
      ),
      this.db.queryOne<any>(
        `SELECT COUNT(*) as count FROM ai_session_notes n
         JOIN sessions s ON s.id = n.session_id
         WHERE s.organization_id = $1 AND s.therapist_id = $2
           AND n.status = 'draft'`,
        [orgId, therapistId],
      ),
      this.db.queryOne<any>(
        `SELECT COUNT(*) as count FROM patients
         WHERE organization_id = $1 AND primary_therapist_id = $2 AND status = 'active' AND deleted_at IS NULL`,
        [orgId, therapistId],
      ),
      this.db.queryOne<any>(
        `SELECT COUNT(*) as count FROM radar_requests
         WHERE status IN ('pending', 'broadcasting')
           AND (organization_id = $1 OR organization_id IS NULL)`,
        [orgId],
      ),
    ]);

    return {
      sessions_today: parseInt(todaySessions?.count || '0'),
      pending_notes: parseInt(pendingNotes?.count || '0'),
      active_patients: parseInt(activePatients?.count || '0'),
      radar_requests: parseInt(radarRequests?.count || '0'),
    };
  }

  async getJoinInfo(joinToken: string) {
    const session = await this.db.queryOne<any>(
      `SELECT s.id, s.status, s.scheduled_at, s.video_room_url, s.join_token,
              s.session_price_cents, s.patient_payment_status,
              t.display_name AS therapist_name,
              u.avatar_url AS therapist_avatar_url
       FROM sessions s
       JOIN therapists t ON t.id = s.therapist_id
       JOIN users u ON u.id = t.user_id
       WHERE s.join_token = $1::uuid AND s.status IN ('scheduled', 'waiting', 'in_progress')`,
      [joinToken],
    );
    if (!session) throw new NotFoundException('Session not found or has ended');
    return {
      session_id: session.id,
      therapist_id: session.therapist_id,
      therapist_name: session.therapist_name,
      therapist_avatar_url: session.therapist_avatar_url,
      scheduled_at: session.scheduled_at,
      status: session.status,
      video_room_url: session.video_room_url,
      requires_payment: !!(session.session_price_cents && session.patient_payment_status !== 'paid'),
      session_price_cents: session.session_price_cents,
      patient_payment_status: session.patient_payment_status,
    };
  }

  async initiatePatientPayment(joinToken: string, dto: { email: string; name?: string }) {
    const session = await this.db.queryOne<any>(
      `SELECT s.id, s.therapist_id, s.session_price_cents, s.patient_payment_status, s.join_token
       FROM sessions s
       WHERE s.join_token = $1::uuid AND s.status IN ('scheduled', 'waiting', 'in_progress')`,
      [joinToken],
    );
    if (!session) throw new NotFoundException('Session not found');
    if (!session.session_price_cents || session.session_price_cents <= 0) {
      throw new BadRequestException('Session does not require payment');
    }
    if (session.patient_payment_status === 'paid') {
      throw new BadRequestException('Session already paid');
    }
    const checkoutUrl = await this.billingService.createPatientSessionCheckout(
      session.id, session.therapist_id, dto.email, joinToken,
    );
    return { checkout_url: checkoutUrl };
  }

  async sendOfflineBill(sessionId: string, orgId: string, dto: { patient_email: string; amount_cents: number }) {
    const session = await this.db.queryOne<any>(
      `SELECT id, therapist_id, organization_id FROM sessions WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');
    const checkoutUrl = await this.billingService.createOfflineBillCheckout(
      sessionId, session.therapist_id, dto.patient_email, dto.amount_cents,
    );
    await this.mail.sendOfflinePaymentLink(
      dto.patient_email, '', '', dto.amount_cents, checkoutUrl || '', new Date(),
    ).catch(() => {});
    return { checkout_url: checkoutUrl };
  }

  async markOfflineCashPaid(sessionId: string, orgId: string, dto: { amount_cents: number }) {
    const session = await this.db.queryOne<any>(
      `SELECT id, therapist_id FROM sessions WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');
    await this.billingService.markOfflineSessionPaid(sessionId, session.therapist_id, dto.amount_cents);
    return { success: true };
  }

  async joinByToken(joinToken: string, dto: { name: string; email?: string }) {
    const session = await this.db.queryOne<any>(
      `SELECT s.*, t.display_name AS therapist_name, t.user_id AS therapist_user_id
       FROM sessions s
       JOIN therapists t ON t.id = s.therapist_id
       WHERE s.join_token = $1::uuid AND s.status IN ('scheduled', 'waiting', 'in_progress')`,
      [joinToken],
    );
    if (!session) throw new NotFoundException('Session not found or no longer accepting guests');

    // If no patient yet, store the join name
    if (!session.patient_id) {
      await this.db.execute(
        `UPDATE sessions SET join_name = $1, started_by_patient_at = NOW(), status = 'waiting', updated_at = NOW()
         WHERE join_token = $2::uuid`,
        [dto.name, joinToken],
      );
    } else {
      await this.db.execute(
        `UPDATE sessions SET started_by_patient_at = COALESCE(started_by_patient_at, NOW()), status = 'waiting', updated_at = NOW()
         WHERE join_token = $2::uuid`,
        [dto.name, joinToken],
      );
    }

    // Notify therapist in real-time that patient joined
    try {
      this.eventEmitter.emit('session.patient_joined', {
        sessionId: session.id,
        therapistUserId: session.therapist_user_id,
        patientName: dto.name,
      });
    } catch { /* non-critical */ }

    return {
      session_id: session.id,
      video_room_url: session.video_room_url,
      therapist_name: session.therapist_name,
    };
  }

  async sendInvites(sessionId: string, orgId: string, emails: string[], therapistName: string, therapistAppUrl: string) {
    const session = await this.db.queryOne<any>(
      `SELECT join_token, scheduled_at, title FROM sessions WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');
    const joinUrl = `${therapistAppUrl}/join/${session.join_token}`;
    return { join_url: joinUrl, invited: emails.length };
  }

  private async createDailyRoom(sessionId: string) {
    const dailyApiKey = this.config.get('video.dailyApiKey');
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        name: `therapy-${sessionId}`,
        properties: {
          enable_chat: true,
          enable_knocking: false,
          start_audio_off: false,
          start_video_off: false,
          exp: Math.floor(Date.now() / 1000) + 3600 * 4, // 4 hours
        },
      }),
    });

    if (!response.ok) throw new Error('Failed to create Daily.co room');
    return response.json();
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
