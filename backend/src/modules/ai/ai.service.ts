import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../../database/database.service';
import { ModelGatewayService } from './model-gateway.service';
import { ContextBuilderService } from './context-builder.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly modelGateway: ModelGatewayService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateSOAPNote(sessionId: string, orgId: string, therapistId: string, format: string = 'soap') {
    // Verify session exists
    const session = await this.db.queryOne<any>(
      'SELECT * FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');

    // Get active prompt from registry
    const promptKey = `${format.toUpperCase()}_NOTE_V1`;
    const prompt = await this.db.queryOne<any>(
      `SELECT template FROM prompt_registry WHERE full_key = $1 AND status = 'active'`,
      [promptKey],
    );

    // Build context
    const context = await this.contextBuilder.buildSessionContext(
      sessionId, session.patient_id, session.therapist_id, orgId,
    );
    const contextText = this.contextBuilder.formatContextForPrompt(context);

    // Determine system prompt based on format
    const systemPrompts: Record<string, string> = {
      soap: `You are a clinical documentation assistant specializing in mental health. 
Generate a SOAP note from the session transcript and context.
Return valid JSON with keys: subjective, objective, assessment, plan.
Keep it clinical, professional, and evidence-based.
This is a DRAFT for therapist review — never make final clinical decisions.`,
      dap: `Generate a DAP note. Return JSON with keys: data, assessment, plan.`,
      birp: `Generate a BIRP note. Return JSON with keys: behavior, intervention, response, plan.`,
    };

    const systemPrompt = prompt?.template || systemPrompts[format] || systemPrompts.soap;

    const startTime = Date.now();
    const response = await this.modelGateway.complete({
      task_type: format === 'soap' ? 'soap_note' : format === 'dap' ? 'dap_note' : 'birp_note',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextText },
      ],
      json_mode: true,
      session_id: sessionId,
      patient_id: session.patient_id,
      organization_id: orgId,
      user_id: therapistId,
    });

    let structuredContent: any;
    try {
      structuredContent = JSON.parse(response.content);
    } catch {
      structuredContent = { content: response.content };
    }

    // Save note
    const noteId = uuidv4();
    const result = await this.db.query(
      `INSERT INTO ai_session_notes (
        id, session_id, patient_id, therapist_id, organization_id,
        note_format, structured_content, raw_content, status,
        ai_model_used, prompt_version, generation_latency_ms, token_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12)
      ON CONFLICT DO NOTHING
      RETURNING *`,
      [
        noteId, sessionId, session.patient_id, session.therapist_id, orgId,
        format, JSON.stringify(structuredContent),
        Object.values(structuredContent).join('\n\n'),
        response.model_used, promptKey,
        response.latency_ms, response.input_tokens + response.output_tokens,
      ],
    );

    // Trigger async memory extraction
    this.extractMemoriesAsync(sessionId, session.patient_id, session.therapist_id, orgId).catch(
      (err) => this.logger.warn('Memory extraction failed:', err.message),
    );

    return { note: result[0] || { structured_content: structuredContent }, ai_metadata: response };
  }

  async generateSummary(sessionId: string, orgId: string, summaryType = 'brief') {
    const session = await this.db.queryOne<any>(
      'SELECT * FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');

    const context = await this.contextBuilder.buildSessionContext(
      sessionId, session.patient_id, session.therapist_id, orgId,
    );

    const response = await this.modelGateway.complete({
      task_type: 'session_summary',
      messages: [
        {
          role: 'system',
          content: `Summarize this therapy session in a clinical, professional manner.
Include: key themes discussed, patient's emotional state, progress on goals, any concerns.
Keep it concise (${summaryType === 'brief' ? '3-5' : '8-12'} sentences).
This is for therapist use only.`,
        },
        { role: 'user', content: this.contextBuilder.formatContextForPrompt(context) },
      ],
      session_id: sessionId,
      patient_id: session.patient_id,
      organization_id: orgId,
    });

    const summaryId = uuidv4();
    const result = await this.db.query(
      `INSERT INTO ai_session_summaries (
        id, session_id, patient_id, therapist_id, organization_id,
        summary_type, content, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
      [summaryId, sessionId, session.patient_id, session.therapist_id, orgId, summaryType, response.content],
    );

    return { summary: result[0] };
  }

  async getCopilotSuggestions(sessionId: string, orgId: string, therapistId: string) {
    const session = await this.db.queryOne<any>(
      'SELECT * FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');

    // Get recent transcript (last 10 segments)
    const recentSegments = await this.db.query<any>(
      `SELECT speaker, text FROM transcript_segments
       WHERE session_id = $1 ORDER BY sequence_number DESC LIMIT 10`,
      [sessionId],
    );
    const recentTranscript = recentSegments.reverse().map((s) => `${s.speaker}: ${s.text}`).join('\n');

    // Get patient context (lightweight version)
    const patient = await this.db.queryOne<any>(
      `SELECT p.first_name, STRING_AGG(pd.diagnosis_name, ', ') as diagnoses
       FROM patients p
       LEFT JOIN patient_diagnoses pd ON pd.patient_id = p.id AND pd.status = 'active'
       WHERE p.id = $1 GROUP BY p.id, p.first_name`,
      [session.patient_id],
    );

    const response = await this.modelGateway.complete({
      task_type: 'copilot_suggestions',
      messages: [
        {
          role: 'system',
          content: `You are an AI clinical copilot assisting a therapist during a live session.
Based on the recent conversation, provide 3-5 suggestions.
Return JSON array with items: { type: 'question'|'observation'|'reminder'|'risk', content: string }
Types: "question" = suggested question to ask, "observation" = clinical observation, "reminder" = something to follow up on, "risk" = risk indicator
Keep suggestions brief (1-2 sentences). Therapist decides whether to use them.`,
        },
        {
          role: 'user',
          content: `Patient: ${patient?.first_name || 'Patient'} (${patient?.diagnoses || 'No diagnosis'})

Recent conversation:
${recentTranscript}

Provide clinical suggestions for the therapist.`,
        },
      ],
      json_mode: true,
      session_id: sessionId,
      organization_id: orgId,
      user_id: therapistId,
    });

    let suggestions: any[] = [];
    try {
      const parsed = JSON.parse(response.content);
      suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || [];
    } catch {
      suggestions = [{ type: 'observation', content: response.content }];
    }

    // Log suggestions
    for (const suggestion of suggestions) {
      await this.db.execute(
        `INSERT INTO copilot_suggestion_logs (id, session_id, therapist_id, suggestion_type, suggestion_content)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), sessionId, therapistId, suggestion.type || 'observation', suggestion.content],
      ).catch(() => {});
    }

    return { suggestions };
  }

  async detectRisk(sessionId: string, orgId: string) {
    const session = await this.db.queryOne<any>(
      'SELECT * FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');

    const transcript = await this.contextBuilder['getCurrentTranscript'](sessionId);

    const response = await this.modelGateway.complete({
      task_type: 'risk_assessment',
      messages: [
        {
          role: 'system',
          content: `You are a clinical safety AI assistant. Analyze this therapy transcript for risk indicators.
Return JSON: {
  "risk_detected": boolean,
  "risk_level": "none"|"low"|"moderate"|"elevated"|"high"|"critical",
  "risk_type": "self_harm"|"suicide"|"violence"|"substance"|"general"|null,
  "indicators": string[],
  "confidence": number (0-1),
  "recommended_action": string
}
Be conservative — flag if uncertain. Therapist always makes final clinical decision.`,
        },
        { role: 'user', content: `Transcript:\n${transcript}` },
      ],
      json_mode: true,
      session_id: sessionId,
      patient_id: session.patient_id,
      organization_id: orgId,
    });

    let riskData: any = {};
    try {
      riskData = JSON.parse(response.content);
    } catch {
      riskData = { risk_detected: false, risk_level: 'none' };
    }

    // Save risk assessment if risk detected
    if (riskData.risk_detected && riskData.risk_level !== 'none') {
      await this.db.execute(
        `INSERT INTO risk_assessments (
          id, patient_id, therapist_id, session_id, organization_id,
          risk_type, risk_level, indicators, ai_detected, ai_confidence
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)`,
        [
          uuidv4(), session.patient_id, session.therapist_id, sessionId, orgId,
          riskData.risk_type || 'general',
          riskData.risk_level, riskData.indicators || [],
          riskData.confidence || 0.5,
        ],
      );

      // Broadcast real-time crisis alert to therapist + org admins
      const ALERT_LEVELS = ['elevated', 'high', 'critical'];
      if (ALERT_LEVELS.includes(riskData.risk_level)) {
        this.eventEmitter.emit('ai.risk_detected', {
          sessionId,
          therapistId: session.therapist_id,
          patientId: session.patient_id,
          orgId,
          riskLevel: riskData.risk_level,
          riskType: riskData.risk_type || 'general',
          indicators: riskData.indicators || [],
          confidence: riskData.confidence || 0.5,
          recommendedAction: riskData.recommended_action || '',
          timestamp: new Date().toISOString(),
        });

        // Insert in-app notifications for all admins in the org on high/critical
        if (['high', 'critical'].includes(riskData.risk_level)) {
          this.notifyOrgAdminsOfCrisis(orgId, sessionId, riskData).catch((err) => {
            this.logger.error(`[CRISIS] Failed to notify admins: ${err?.message}`);
          });
        }
      }
    }

    return riskData;
  }

  private async notifyOrgAdminsOfCrisis(orgId: string, sessionId: string, riskData: any) {
    // Fetch all admin/super_admin users in the org
    const admins = await this.db.query<{ id: string }>(
      `SELECT u.id FROM users u
       WHERE u.organization_id = $1
         AND u.role IN ('super_admin', 'admin')
         AND u.deleted_at IS NULL`,
      [orgId],
    );

    const title = `Crisis Alert — ${riskData.risk_level.toUpperCase()}`;
    const body = `Risk detected in session. Indicators: ${(riskData.indicators || []).join(', ')}. Confidence: ${Math.round((riskData.confidence || 0.5) * 100)}%.`;

    for (const admin of admins) {
      await this.db.execute(
        `INSERT INTO notifications (id, organization_id, user_id, channel, title, body, priority, status, created_at)
         VALUES ($1, $2, $3, 'in_app', $4, $5, 'urgent', 'pending', NOW())`,
        [uuidv4(), orgId, admin.id, title, body],
      );
    }

    this.logger.warn(`[CRISIS] Notified ${admins.length} admins in org ${orgId} for session ${sessionId}`);
  }

  private async extractMemoriesAsync(
    sessionId: string, patientId: string, therapistId: string, orgId: string,
  ) {
    try {
      const transcript = await this.contextBuilder['getCurrentTranscript'](sessionId);
      if (!transcript || transcript === '[No transcript yet]') return;

      const response = await this.modelGateway.complete({
        task_type: 'memory_extraction',
        messages: [
          {
            role: 'system',
            content: `Extract important clinical memories from this therapy session.
Return JSON array. Each memory: {
  "memory_type": "symptom"|"goal"|"relationship"|"life_event"|"medication"|"risk"|"treatment"|"strength"|"trigger"|"coping"|"general",
  "title": string (max 100 chars),
  "content": string (detailed, 1-3 sentences),
  "confidence_score": number (0-1)
}
Only extract clinically significant information. Max 10 memories.`,
          },
          { role: 'user', content: `Session transcript:\n${transcript}` },
        ],
        json_mode: true,
        session_id: sessionId,
        patient_id: patientId,
        organization_id: orgId,
      });

      let memories: any[] = [];
      try {
        const parsed = JSON.parse(response.content);
        memories = Array.isArray(parsed) ? parsed : parsed.memories || [];
      } catch { return; }

      // Save memories with embeddings
      for (const memory of memories) {
        try {
          const embedding = await this.modelGateway.embed(`${memory.title}: ${memory.content}`);
          const embeddingStr = `[${embedding.join(',')}]`;

          await this.db.execute(
            `INSERT INTO patient_memory (
              id, patient_id, therapist_id, organization_id,
              memory_type, title, content, confidence_score,
              source_session_id, status, embedding
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10::vector)`,
            [
              uuidv4(), patientId, therapistId, orgId,
              memory.memory_type, memory.title, memory.content,
              memory.confidence_score || 0.7, sessionId, embeddingStr,
            ],
          );
        } catch (err) {
          this.logger.warn('Failed to save memory:', err.message);
        }
      }

      this.logger.log(`Extracted ${memories.length} memories for patient ${patientId}`);
    } catch (err) {
      this.logger.error('Memory extraction error:', err.message);
    }
  }

  async approveNote(noteId: string, orgId: string, approverId: string, edits?: any) {
    const note = await this.db.queryOne<any>(
      `SELECT n.* FROM ai_session_notes n
       JOIN sessions s ON s.id = n.session_id
       WHERE n.id = $1 AND s.organization_id = $2`,
      [noteId, orgId],
    );
    if (!note) throw new NotFoundException('Note not found');

    const updatedContent = edits ? JSON.stringify(edits) : note.structured_content;

    const result = await this.db.query(
      `UPDATE ai_session_notes
       SET status = 'approved', approved_by = $1, approved_at = NOW(),
           structured_content = $2, therapist_edits = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [approverId, updatedContent, JSON.stringify(edits || {}), noteId],
    );

    return { note: result[0] };
  }

  async semanticMemorySearch(patientId: string, orgId: string, query: string, limit = 10) {
    try {
      const embedding = await this.modelGateway.embed(query);
      const embeddingStr = `[${embedding.join(',')}]`;

      return this.db.query(
        `SELECT id, memory_type, title, content, confidence_score,
          1 - (embedding <=> $1::vector) as similarity
         FROM patient_memory
         WHERE patient_id = $2 AND organization_id = $3 AND status = 'active'
         ORDER BY embedding <=> $1::vector
         LIMIT $4`,
        [embeddingStr, patientId, orgId, limit],
      );
    } catch (err) {
      this.logger.warn('Semantic search falling back to keyword:', err.message);
      return this.db.query(
        `SELECT id, memory_type, title, content, confidence_score, 0.5 as similarity
         FROM patient_memory
         WHERE patient_id = $1 AND organization_id = $2 AND status = 'active'
         ORDER BY created_at DESC LIMIT $3`,
        [patientId, orgId, limit],
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC — Anonymous AI chat (marketing site free trial)
  // No auth, no PHI stored, no DB writes. Crisis detection always active.
  // ─────────────────────────────────────────────────────────────────────────

  /** Keywords that always trigger an immediate safety response */
  private readonly CRISIS_KEYWORDS = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self-harm', 'self harm', 'cutting myself', 'hurt myself',
    'overdose', 'not worth living', 'no reason to live',
  ];

  private readonly CRISIS_RESPONSE =
    "I'm concerned about what you've shared. Please reach out to a crisis line right away — " +
    "call or text **988** (Suicide & Crisis Lifeline, US) or go to your nearest emergency room. " +
    "You deserve real support from a trained counselor. " +
    "If you'd like to connect with a licensed therapist through 24Therapy, we're here for you.";

  /**
   * Anonymous chat for the marketing-site free trial widget (/chat page + hero widget).
   *
   * Design constraints:
   *  - No JWT required (called by @Public / no guard)
   *  - No PHI written to DB — purely ephemeral
   *  - Crisis keywords always intercepted before hitting the model
   *  - Uses task_type: 'chat' → gpt-4o-mini (fast + cheap)
   *  - System prompt positions the AI as supportive but non-clinical
   */
  async anonymousChat(message: string): Promise<string> {
    if (!message || typeof message !== 'string') {
      return "I didn't catch that — could you share what's on your mind?";
    }

    const trimmed = message.trim();

    // 1. Crisis keyword intercept — always fires, no model call needed
    const lower = trimmed.toLowerCase();
    if (this.CRISIS_KEYWORDS.some((kw) => lower.includes(kw))) {
      this.logger.warn('[anonymousChat] Crisis keyword detected — returning safety response');
      return this.CRISIS_RESPONSE;
    }

    // 2. Length guard
    if (trimmed.length > 1000) {
      return "That's a lot to process — could you share the most important part in a sentence or two?";
    }

    const systemPrompt = `You are a warm, empathetic AI assistant for 24Therapy — a mental health platform connecting people with licensed therapists.

Your role in this free chat widget:
- Provide a supportive, non-judgmental space for someone exploring therapy
- Offer general emotional support, psychoeducation, and coping strategies
- Clearly communicate you are NOT a licensed therapist and cannot provide therapy, diagnosis, or treatment
- Gently guide users toward booking a session with a real therapist when appropriate

Tone: conversational, compassionate, human — never clinical or robotic.
Boundaries: do not diagnose, prescribe, or give specific clinical advice.
Length: keep responses concise (2–4 sentences) — this is a chat widget, not an essay.
Safety: if ANY mention of self-harm, suicide, or crisis arises, immediately direct to 988.

At the end of your response you may naturally (not forcefully) mention that a licensed therapist on 24Therapy can provide real, personalized support.`;

    try {
      const response = await this.modelGateway.complete({
        task_type: 'chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.8,
        max_tokens: 300,
        // Intentionally no session_id, patient_id, organization_id — anonymous
      });

      return response.content || "I'm here to listen. What's on your mind?";
    } catch (err) {
      this.logger.error('[anonymousChat] Model call failed:', err?.message);
      // Graceful fallback — never expose errors to end users
      return (
        "I'm here to listen. " +
        "While I'm just an AI and not a licensed therapist, I want you to know that reaching out " +
        "is a brave first step. A licensed therapist on 24Therapy can give you the real support you deserve."
      );
    }
  }
}
