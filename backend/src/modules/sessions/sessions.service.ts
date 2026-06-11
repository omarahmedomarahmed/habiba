import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { AIService } from '../ai/ai.service';
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
    @Inject(forwardRef(() => AIService)) private readonly aiService: AIService,
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

    const sessions = await this.db.query(
      `SELECT s.*,
        p.first_name || ' ' || COALESCE(p.last_name, '') as patient_name,
        p.email as patient_email,
        t.display_name as therapist_name,
        (SELECT COUNT(*) FROM transcript_segments ts JOIN transcripts tr ON tr.id = ts.transcript_id WHERE tr.session_id = s.id) as transcript_segment_count,
        (SELECT id FROM ai_session_notes WHERE session_id = s.id LIMIT 1) as has_ai_note
       FROM sessions s
       JOIN patients p ON p.id = s.patient_id
       JOIN therapists t ON t.id = s.therapist_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY s.scheduled_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return sessions;
  }

  async findOne(id: string, orgId: string) {
    const session = await this.db.queryOne(
      `SELECT s.*,
        p.first_name || ' ' || COALESCE(p.last_name, '') as patient_name,
        p.email as patient_email,
        t.display_name as therapist_name,
        t.user_id as therapist_user_id
       FROM sessions s
       JOIN patients p ON p.id = s.patient_id
       JOIN therapists t ON t.id = s.therapist_id
       WHERE s.id = $1 AND s.organization_id = $2`,
      [id, orgId],
    );

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getTherapistUsage(therapistId: string): Promise<{ plan_key: string; sessions_this_month: number; max_sessions_month: number | null; trial_session_used: boolean }> {
    const row = await this.db.queryOne<any>(
      `SELECT t.current_plan_key, t.trial_session_used,
              COALESCE(u.sessions_this_month, 0) AS sessions_this_month,
              sp.max_sessions_month
       FROM therapists t
       LEFT JOIN therapist_monthly_session_counts u ON u.therapist_id = t.id
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
      return; // first session allowed
    }

    if (usage.plan_key === 'pay_per_session') {
      return; // always allowed — billed individually
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

    const sessionId = uuidv4();

    // Get session number for this therapist-patient pair
    const sessionCount = await this.db.queryOne<any>(
      `SELECT COUNT(*) as count FROM sessions
       WHERE therapist_id = $1 AND patient_id = $2`,
      [dto.therapist_id, dto.patient_id],
    );

    const sessionNumber = (parseInt(sessionCount?.count || '0') + 1);

    // Create video room if needed
    let videoRoomId = null;
    let videoRoomUrl = null;

    if (dto.modality === 'video' && this.config.get('video.dailyApiKey')) {
      // Create Daily.co room
      try {
        const room = await this.createDailyRoom(sessionId);
        videoRoomId = room.name;
        videoRoomUrl = room.url;
      } catch (err) {
        console.warn('Could not create Daily.co room:', err.message);
      }
    }

    const result = await this.db.query(
      `INSERT INTO sessions (
        id, organization_id, therapist_id, patient_id,
        session_type, modality, status, scheduled_at,
        session_number, title, recording_enabled, scribe_enabled,
        video_room_id, video_room_url, pre_session_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        sessionId, orgId, dto.therapist_id, dto.patient_id,
        dto.session_type || 'standard', dto.modality || 'video',
        dto.scheduled_at || null, sessionNumber,
        dto.title || `Session ${sessionNumber}`,
        dto.recording_enabled || false, dto.scribe_enabled !== false,
        videoRoomId, videoRoomUrl, dto.pre_session_notes || null,
      ],
    );

    // Log timeline event
    await this.db.execute(
      `INSERT INTO patient_timeline_events (id, patient_id, organization_id, event_type, title, reference_id, reference_type)
       VALUES ($1, $2, $3, 'session_scheduled', 'Session scheduled', $4, 'session')`,
      [uuidv4(), dto.patient_id, orgId, sessionId],
    );

    return result[0];
  }

  async updateStatus(id: string, orgId: string, status: string, metadata: any = {}) {
    const session = await this.findOne(id, orgId);

    const validTransitions: Record<string, string[]> = {
      scheduled: ['waiting', 'cancelled', 'no_show'],
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
        [uuidv4(), id, session.patient_id, session.therapist_id, orgId, metadata.language || 'en'],
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
      await this.db.execute(
        `INSERT INTO patient_timeline_events (id, patient_id, organization_id, event_type, title, reference_id, reference_type)
         VALUES ($1, $2, $3, 'session_completed', 'Session completed', $4, 'session')`,
        [uuidv4(), session.patient_id, orgId, id],
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

    // Crisis keyword scan — fire-and-forget (never blocks the response)
    if (dto.text && typeof dto.text === 'string') {
      const lower = dto.text.toLowerCase();
      const matched = LIVE_CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
      if (matched) {
        this.logger.warn(`[CRISIS SCAN] Keyword matched in session ${sessionId} — triggering GPT-4o risk assessment`);
        this.aiService.detectRisk(sessionId, orgId).catch((err) => {
          this.logger.error(`[CRISIS SCAN] detectRisk failed for session ${sessionId}: ${err?.message}`);
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
