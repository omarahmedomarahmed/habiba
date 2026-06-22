import { Injectable, NotFoundException, Logger, BadRequestException, HttpException, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../../database/database.service';
import { ModelGatewayService } from './model-gateway.service';
import { ContextBuilderService } from './context-builder.service';
import { AICompanionService } from './ai-companion.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly modelGateway: ModelGatewayService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly eventEmitter: EventEmitter2,
    private readonly companion: AICompanionService,
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
        noteId, sessionId, session.patient_id || null, session.therapist_id, orgId,
        format, JSON.stringify(structuredContent),
        Object.values(structuredContent).join('\n\n'),
        response.model_used, promptKey,
        response.latency_ms, response.input_tokens + response.output_tokens,
      ],
    );

    // Trigger async memory extraction (only if patient is linked)
    if (session.patient_id) this.extractMemoriesAsync(sessionId, session.patient_id, session.therapist_id, orgId).catch(
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
      [summaryId, sessionId, session.patient_id || null, session.therapist_id, orgId, summaryType, response.content],
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

  @OnEvent('crisis.run_ai')
  async runAiForCrisis(payload: { sessionId: string; orgId: string }) {
    await this.detectRisk(payload.sessionId, payload.orgId).catch((err) => {
      this.logger.error(`[CRISIS AI] detectRisk failed for session ${payload.sessionId}: ${err?.message}`);
    });
  }

  async detectRisk(sessionId: string, orgId: string) {
    const session = await this.db.queryOne<any>(
      `SELECT s.*, th.user_id AS therapist_user_id, pt.user_id AS patient_user_id
       FROM sessions s
       JOIN therapists th ON th.id = s.therapist_id
       LEFT JOIN patients pt ON pt.id = s.patient_id
       WHERE s.id = $1 AND s.organization_id = $2`,
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
          risk_type, risk_level, indicators, ai_detected, ai_confidence,
          source, alert_status, alert_delivered_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,'ai','delivered',NOW())`,
        [
          uuidv4(), session.patient_id, session.therapist_id, sessionId, orgId,
          riskData.risk_type || 'general',
          riskData.risk_level, riskData.indicators || [],
          riskData.confidence || 0.5,
        ],
      );

      // Notify crisis module for potential re-escalation (dedup logic lives there)
      this.eventEmitter.emit('crisis.ai_analyzed', {
        sessionId,
        orgId,
        riskDetected: true,
        riskLevel: riskData.risk_level,
        riskType: riskData.risk_type || 'general',
        indicators: riskData.indicators || [],
        confidence: riskData.confidence || 0.5,
        recommendedAction: riskData.recommended_action || '',
        therapistId: session.therapist_id,
        therapistUserId: session.therapist_user_id,
        patientId: session.patient_id,
        patientUserId: session.patient_user_id,
      });

      // Broadcast real-time crisis alert to therapist + org admins
      const ALERT_LEVELS = ['elevated', 'high', 'critical'];
      if (ALERT_LEVELS.includes(riskData.risk_level)) {
        this.eventEmitter.emit('ai.risk_detected', {
          sessionId,
          therapistId: session.therapist_id,
          therapistUserId: session.therapist_user_id,
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
          // Schedule proactive AI companion follow-up for the patient
          const patientId = session.patient_id;
          setTimeout(() => {
            this.companion.triggerCrisisFollowUp(patientId, orgId).catch(() => {});
          }, 15 * 60 * 1000); // 15 minutes after the session
        }
      }
    }

    return riskData;
  }

  async detectEmotionalContext(sessionId: string, orgId: string, recentText: string, patientId: string) {
    const response = await this.modelGateway.complete({
      task_type: 'emotional_analysis',
      messages: [
        {
          role: 'system',
          content: `You are a clinical emotional intelligence system analyzing therapy session language.
Return JSON exactly:
{
  "primaryEmotion": "grief|shame|fear|anger|hopelessness|dissociation|anxiety|numbness|sadness|mixed",
  "intensity": "mild|moderate|strong",
  "minimizingLanguage": boolean,
  "linguisticPace": "fast|normal|slow|fragmented",
  "emotionalTrajectory": "improving|stable|declining|volatile",
  "clinicalNote": "one sentence for therapist copilot panel",
  "interventionSuggestion": "one specific technique therapist could use now"
}`,
        },
        { role: 'user', content: `Patient speech:\n"${recentText}"` },
      ],
      json_mode: true,
      session_id: sessionId,
      patient_id: patientId,
      organization_id: orgId,
    });

    let emotionalData: any = {};
    try {
      emotionalData = JSON.parse(response.content);
    } catch {
      emotionalData = { primaryEmotion: 'unknown', intensity: 'mild' };
    }

    // Emit to copilot panel in real-time
    this.eventEmitter.emit('ai.emotional_context', {
      sessionId, patientId, orgId,
      emotion: emotionalData.primaryEmotion,
      intensity: emotionalData.intensity,
      minimizingLanguage: emotionalData.minimizingLanguage,
      trajectory: emotionalData.emotionalTrajectory,
      clinicalNote: emotionalData.clinicalNote,
      interventionSuggestion: emotionalData.interventionSuggestion,
      timestamp: new Date().toISOString(),
    });

    return emotionalData;
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

  // ─── Auto-generate after session ends ────────────────────────────────────

  async autoGenerateSessionOutput(sessionId: string, orgId: string): Promise<void> {
    const session = await this.db.queryOne<any>(
      'SELECT * FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, orgId],
    );
    if (!session) return;

    const context = await this.contextBuilder.buildSessionContext(
      sessionId, session.patient_id, session.therapist_id, orgId,
    );
    const contextText = this.contextBuilder.formatContextForPrompt(context);

    const systemPrompt = `You are a clinical documentation AI for a mental health therapist.
Analyze this therapy session and generate comprehensive structured output.
Return valid JSON with these exact keys:
{
  "soap_note": { "subjective": "...", "objective": "...", "assessment": "...", "plan": "..." },
  "session_summary": "2-3 sentence summary of the session",
  "key_talking_points": ["point 1", "point 2", "point 3"],
  "clinical_observations": "observations about patient presentation, affect, behavior",
  "potential_diagnosis": "diagnostic impressions (NOT a formal diagnosis — therapist review required)",
  "treatment_recommendations": "evidence-based recommendations for treatment",
  "follow_up": "recommended follow-up timeframe (e.g. 'In 2 weeks')"
}
Keep it clinical, professional, and evidence-based. This is a draft for therapist review.`;

    try {
      const response = await this.modelGateway.complete({
        task_type: 'soap_note',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextText },
        ],
        json_mode: true,
        session_id: sessionId,
        patient_id: session.patient_id,
        organization_id: orgId,
      });

      let structuredContent: any;
      try {
        structuredContent = JSON.parse(response.content);
      } catch {
        structuredContent = { content: response.content };
      }

      const noteId = uuidv4();
      await this.db.execute(
        `INSERT INTO ai_session_notes (
          id, session_id, patient_id, therapist_id, organization_id,
          note_format, structured_content, raw_content, status,
          ai_model_used, generation_latency_ms, token_count
        ) VALUES ($1,$2,$3,$4,$5,'soap',$6,$7,'draft',$8,$9,$10)
        ON CONFLICT DO NOTHING`,
        [
          noteId, sessionId, session.patient_id || null, session.therapist_id, orgId,
          JSON.stringify(structuredContent),
          structuredContent.session_summary || Object.values(structuredContent.soap_note || {}).join('\n\n'),
          response.model_used,
          response.latency_ms, response.input_tokens + response.output_tokens,
        ],
      );

      // Save follow-up recommendation to session
      if (structuredContent.follow_up) {
        await this.db.execute(
          `UPDATE sessions SET follow_up_recommendation = $1, ai_insights = $2, updated_at = NOW() WHERE id = $3`,
          [
            structuredContent.follow_up,
            JSON.stringify({
              key_talking_points: structuredContent.key_talking_points || [],
              clinical_observations: structuredContent.clinical_observations || '',
              potential_diagnosis: structuredContent.potential_diagnosis || '',
              treatment_recommendations: structuredContent.treatment_recommendations || '',
            }),
            sessionId,
          ],
        );
      }

      this.logger.log(`Auto-generated session output for session ${sessionId}`);
    } catch (err) {
      this.logger.error(`autoGenerateSessionOutput failed for ${sessionId}: ${err.message}`);
    }
  }

  // ─── Session-specific AI chat ─────────────────────────────────────────────

  async sessionChat(
    sessionId: string,
    therapistId: string,
    orgId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<{ reply: string; credits_remaining: number | 'unlimited' }> {
    const therapist = await this.db.queryOne<{ current_plan_key: string }>(
      `SELECT current_plan_key FROM therapists WHERE id = $1`,
      [therapistId],
    );
    const planKey = therapist?.current_plan_key || 'pay_per_session';
    const isPaidPlan = ['starter', 'pro', 'practice', 'enterprise'].includes(planKey);

    let creditsRemaining: number | 'unlimited' = 'unlimited';
    if (!isPaidPlan) {
      const updated = await this.db.queryOne<{ balance: number }>(
        `UPDATE ai_assistant_credits SET balance = balance - 1, updated_at = NOW()
         WHERE therapist_id = $1 AND balance > 0 RETURNING balance`,
        [therapistId],
      );
      if (!updated) {
        throw new HttpException(
          { message: 'AI credits exhausted. Please upgrade your plan.', code: 'CREDITS_EXHAUSTED', credits_balance: 0, upsell: 'Upgrade to Starter ($59/mo) for unlimited messages.' },
          402,
        );
      }
      creditsRemaining = updated.balance;
    }

    const session = await this.db.queryOne<any>(
      `SELECT s.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
       FROM sessions s LEFT JOIN patients p ON p.id = s.patient_id
       WHERE s.id = $1 AND s.organization_id = $2`,
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');

    const context = await this.contextBuilder.buildSessionContext(
      sessionId, session.patient_id, therapistId, orgId,
    );
    const contextText = this.contextBuilder.formatContextForPrompt(context);
    const patientName = session.patient_first_name
      ? `${session.patient_first_name} ${session.patient_last_name || ''}`.trim()
      : 'the patient';

    const systemPrompt = `You are a clinical AI assistant helping a therapist reflect on a specific session.
Session context: Session with ${patientName} on ${session.scheduled_at ? new Date(session.scheduled_at).toLocaleDateString() : 'an unknown date'}.
${contextText}
Answer questions about this session, the transcript, and clinical insights.
Be concise, evidence-based, and always recommend therapist review for clinical decisions.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    const result = await this.modelGateway.complete({
      task_type: 'assistant',
      messages,
      max_tokens: 600,
      therapist_id: therapistId,
      session_id: sessionId,
      organization_id: orgId,
    } as any);

    return { reply: result.content, credits_remaining: creditsRemaining };
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

  async transcribeAudio(sessionId: string, orgId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('No audio data received');

    const session = await this.db.queryOne<any>(
      `SELECT s.*, t.user_id AS therapist_user_id
       FROM sessions s
       JOIN therapists t ON t.id = s.therapist_id
       WHERE s.id = $1 AND s.organization_id = $2`,
      [sessionId, orgId],
    );
    if (!session) throw new NotFoundException('Session not found');

    try {
      const text = await this.modelGateway.transcribe(file.buffer, file.mimetype);

      if (!text || !text.trim()) return { text: '', timestamp: new Date().toISOString() };

      const segmentData = await this.addTranscriptSegment(sessionId, orgId, {
        text: text.trim(),
        speaker: 'therapist',
        timestamp: new Date().toISOString(),
      });

      // Every 5 segments: trigger emotional context (patient-facing) and copilot suggestions
      if (segmentData && segmentData.seq % 5 === 0) {
        if (session.patient_id) {
          this.detectEmotionalContext(sessionId, orgId, text.trim(), session.patient_id)
            .catch((e) => this.logger.warn('Emotional context failed:', e?.message));
        }
        this.triggerCopilotBatch(sessionId, orgId, session.therapist_id, session.therapist_user_id)
          .catch((e) => this.logger.warn('Copilot batch failed:', e?.message));
      }

      return { text: text.trim(), timestamp: new Date().toISOString(), segment_id: segmentData?.id };
    } catch (err: any) {
      this.logger.error(`Transcription failed for session (no PHI): ${err?.message}`);
      throw new HttpException('Transcription failed', 500);
    }
  }

  private async addTranscriptSegment(sessionId: string, orgId: string, dto: any): Promise<{ id: string; seq: number } | null> {
    const transcript = await this.db.queryOne<any>(
      'SELECT id FROM transcripts WHERE session_id = $1',
      [sessionId],
    );
    if (!transcript) return null;

    const lastSeq = await this.db.queryOne<any>(
      'SELECT COALESCE(MAX(sequence_number),0) as max_seq FROM transcript_segments WHERE transcript_id = $1',
      [transcript.id],
    );
    const seq = (lastSeq?.max_seq || 0) + 1;
    const segmentId = uuidv4();

    await this.db.execute(
      `INSERT INTO transcript_segments (id, transcript_id, speaker, text, timestamp, sequence_number)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [segmentId, transcript.id, dto.speaker || 'therapist', dto.text, dto.timestamp, seq],
    );

    // Broadcast to session room via event bus so EventsGateway can push over WebSocket
    this.eventEmitter.emit('transcript.new_segment', {
      sessionId,
      segmentId,
      speaker: dto.speaker || 'therapist',
      text: dto.text,
      timestamp: dto.timestamp,
      seq,
    });

    return { id: segmentId, seq };
  }

  private async triggerCopilotBatch(sessionId: string, orgId: string, therapistId: string, therapistUserId: string) {
    try {
      const { suggestions } = await this.getCopilotSuggestions(sessionId, orgId, therapistId);
      if (suggestions?.length > 0) {
        this.eventEmitter.emit('ai.copilot_batch', {
          sessionId,
          therapistUserId,
          suggestions,
        });
      }
    } catch (err: any) {
      this.logger.warn('Copilot batch generation failed:', err?.message);
    }
  }

  // ─── Therapist AI Assistant ────────────────────────────────────────────────

  /**
   * Chat about the therapist's own sessions/patients. Credits-gated for PAYG.
   * NEVER logs message content — PHI invariant.
   */
  async assistantChat(
    therapistId: string,
    orgId: string,
    message: string,
    range: 'today' | 'this_week' | 'last_week' | undefined,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    sessionId?: string,
    patientId?: string,
  ): Promise<{ reply: string; credits_remaining: number | 'unlimited' }> {
    // Verify credits (PAYG) or plan (paid)
    const therapist = await this.db.queryOne<{ current_plan_key: string }>(
      `SELECT current_plan_key FROM therapists WHERE id = $1`,
      [therapistId],
    );
    const planKey = therapist?.current_plan_key || 'pay_per_session';
    const isPaidPlan = ['starter', 'pro', 'practice', 'enterprise'].includes(planKey);

    let creditsRemaining: number | 'unlimited' = 'unlimited';
    if (!isPaidPlan) {
      // Atomically decrement credits
      const updated = await this.db.queryOne<{ balance: number }>(
        `UPDATE ai_assistant_credits
         SET balance = balance - 1, updated_at = NOW()
         WHERE therapist_id = $1 AND balance > 0
         RETURNING balance`,
        [therapistId],
      );
      if (!updated) {
        throw new HttpException(
          { message: 'AI credits exhausted. Please upgrade your plan.', code: 'CREDITS_EXHAUSTED', credits_balance: 0, upsell: 'Every session gives you 5 messages. Upgrade to Starter ($59/mo) for unlimited.' },
          402,
        );
      }
      creditsRemaining = updated.balance;
    }

    // Build context from therapist's sessions in range
    const rangeFilter = this._buildDateFilter(range);
    const sessions = await this.db.query<any>(
      `SELECT s.id, s.scheduled_at, s.ended_at, s.status,
              p.first_name AS patient_first_name,
              COALESCE(ais.brief, '') AS summary,
              COALESCE(
                (SELECT json_build_object('key_themes', si.key_themes, 'risk_level', si.risk_level)
                 FROM session_intelligence si WHERE si.session_id = s.id LIMIT 1),
                '{}'::json
              ) AS intelligence,
              COALESCE(
                (SELECT COUNT(*) FROM ai_session_notes asn WHERE asn.session_id = s.id), 0
              ) AS notes_count
       FROM sessions s
       JOIN patients p ON p.id = s.patient_id
       LEFT JOIN ai_session_summaries ais ON ais.session_id = s.id
       WHERE s.therapist_id = $1 AND s.organization_id = $2
         ${rangeFilter}
         AND s.status IN ('completed','in_progress')
       ORDER BY s.scheduled_at DESC
       LIMIT 12`,
      [therapistId, orgId],
    );

    const contextLines = sessions.map((s: any) => {
      const date = s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : 'Unknown date';
      const intel = typeof s.intelligence === 'string' ? JSON.parse(s.intelligence) : s.intelligence;
      return [
        `Session on ${date} with patient ${s.patient_first_name}:`,
        s.summary ? `  Summary: ${s.summary}` : '  Summary: not yet generated',
        intel?.key_themes?.length ? `  Key themes: ${intel.key_themes.join(', ')}` : '',
        intel?.risk_level ? `  Risk level: ${intel.risk_level}` : '',
        `  Notes: ${s.notes_count > 0 ? 'generated' : 'not generated'}`,
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    // Build optional session/patient specific context
    let specificContext = '';
    if (sessionId) {
      const specificSession = await this.db.queryOne<any>(
        `SELECT s.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
         FROM sessions s LEFT JOIN patients p ON p.id = s.patient_id
         WHERE s.id = $1 AND s.organization_id = $2`,
        [sessionId, orgId],
      );
      if (specificSession) {
        const ctx = await this.contextBuilder.buildSessionContext(sessionId, specificSession.patient_id, therapistId, orgId);
        specificContext = `\n\nFOCUS SESSION:\n${this.contextBuilder.formatContextForPrompt(ctx)}`;
      }
    } else if (patientId) {
      const patient = await this.db.queryOne<any>(
        `SELECT first_name, last_name FROM patients WHERE id = $1 AND organization_id = $2`,
        [patientId, orgId],
      );
      if (patient) {
        specificContext = `\n\nFOCUS PATIENT: ${patient.first_name} ${patient.last_name || ''} (${patientId})`;
      }
    }

    const rangeLabel = range === 'today' ? 'today' : range === 'this_week' ? 'this week' : range === 'last_week' ? 'last week' : 'recent sessions';
    const systemPrompt = [
      `You are a practice assistant for a licensed therapist. You have access to their ${rangeLabel} session data.`,
      `Answer questions about their sessions, patients, and practice.`,
      `Always cite which session/date you're referring to. Never invent sessions or details.`,
      `Do not provide diagnoses. For crisis questions, remind the therapist of the crisis protocol and Radar system.`,
      `Keep replies concise and clinically useful.`,
      sessions.length > 0
        ? `\n\nSESSION DATA:\n${contextLines}`
        : `\n\nNo sessions found for ${rangeLabel}.`,
      specificContext,
    ].join('\n');

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-8).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    const result = await this.modelGateway.complete({
      task_type: 'assistant',
      messages,
      max_tokens: 700,
      therapist_id: therapistId,
      organization_id: orgId,
    } as any);

    return {
      reply: result.content,
      credits_remaining: creditsRemaining,
    };
  }

  async getAssistantCredits(therapistId: string): Promise<{ balance: number | 'unlimited' }> {
    const therapist = await this.db.queryOne<{ current_plan_key: string }>(
      `SELECT current_plan_key FROM therapists WHERE id = $1`,
      [therapistId],
    );
    const planKey = therapist?.current_plan_key || 'pay_per_session';
    const isPaidPlan = ['starter', 'pro', 'practice', 'enterprise'].includes(planKey);

    if (isPaidPlan) return { balance: 'unlimited' };

    const credits = await this.db.queryOne<{ balance: number }>(
      `SELECT balance FROM ai_assistant_credits WHERE therapist_id = $1`,
      [therapistId],
    );
    return { balance: credits?.balance ?? 0 };
  }

  private _buildDateFilter(range: 'today' | 'this_week' | 'last_week' | undefined): string {
    if (!range || range === 'today') {
      return `AND s.scheduled_at >= DATE_TRUNC('day', NOW())`;
    }
    if (range === 'this_week') {
      return `AND s.scheduled_at >= DATE_TRUNC('week', NOW())`;
    }
    if (range === 'last_week') {
      return `AND s.scheduled_at >= DATE_TRUNC('week', NOW()) - INTERVAL '7 days'
              AND s.scheduled_at < DATE_TRUNC('week', NOW())`;
    }
    return '';
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
