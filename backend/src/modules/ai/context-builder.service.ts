import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface SessionContext {
  patient_summary: string;
  recent_sessions: string;
  current_goals: string;
  assessments: string;
  medications: string;
  risk_flags: string;
  therapist_preferences: string;
  relevant_memories: string;
  current_transcript: string;
}

@Injectable()
export class ContextBuilderService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Build full patient context for AI generation.
   * Poor context = poor output. This is the most critical step.
   */
  async buildSessionContext(
    sessionId: string,
    patientId: string,
    therapistId: string,
    orgId: string,
    queryText?: string,
  ): Promise<SessionContext> {
    const [
      patient,
      recentSessions,
      goals,
      assessments,
      medications,
      riskAssessments,
      memories,
      transcript,
    ] = await Promise.all([
      this.getPatientSummary(patientId, orgId),
      this.getRecentSessionSummaries(patientId, orgId, 3),
      this.getActiveGoals(patientId, orgId),
      this.getLatestAssessments(patientId, orgId),
      this.getActiveMedications(patientId, orgId),
      this.getActiveRiskFlags(patientId, orgId),
      this.getRelevantMemories(patientId, orgId, queryText),
      this.getCurrentTranscript(sessionId),
    ]);

    const therapistPrefs = await this.getTherapistPreferences(therapistId);

    return {
      patient_summary: patient,
      recent_sessions: recentSessions,
      current_goals: goals,
      assessments,
      medications,
      risk_flags: riskAssessments,
      therapist_preferences: therapistPrefs,
      relevant_memories: memories,
      current_transcript: transcript,
    };
  }

  private async getPatientSummary(patientId: string, orgId: string): Promise<string> {
    const patient = await this.db.queryOne<any>(
      `SELECT p.first_name, p.last_name, p.date_of_birth, p.gender,
        p.total_sessions, p.last_session_at,
        STRING_AGG(DISTINCT pd.diagnosis_name, ', ') as diagnoses
       FROM patients p
       LEFT JOIN patient_diagnoses pd ON pd.patient_id = p.id AND pd.status = 'active'
       WHERE p.id = $1 AND p.organization_id = $2
       GROUP BY p.id, p.first_name, p.last_name, p.date_of_birth, p.gender, p.total_sessions, p.last_session_at`,
      [patientId, orgId],
    );

    if (!patient) return 'No patient data available.';

    const age = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    return `Patient: ${patient.first_name} ${patient.last_name || ''}
Age: ${age ? `${age} years old` : 'Unknown'}
Gender: ${patient.gender || 'Not specified'}
Total sessions: ${patient.total_sessions}
Last session: ${patient.last_session_at ? new Date(patient.last_session_at).toLocaleDateString() : 'First session'}
Active diagnoses: ${patient.diagnoses || 'None documented'}`;
  }

  private async getRecentSessionSummaries(patientId: string, orgId: string, count: number): Promise<string> {
    const summaries = await this.db.query<any>(
      `SELECT s.scheduled_at, ass.content
       FROM sessions s
       LEFT JOIN ai_session_summaries ass ON ass.session_id = s.id AND ass.summary_type = 'brief'
       WHERE s.patient_id = $1 AND s.organization_id = $2 AND s.status = 'completed'
       ORDER BY s.scheduled_at DESC LIMIT $3`,
      [patientId, orgId, count],
    );

    if (!summaries.length) return 'No previous session summaries available.';

    return summaries
      .map((s, i) => `Session ${i + 1} (${new Date(s.scheduled_at).toLocaleDateString()}): ${s.content || 'No summary available'}`)
      .join('\n\n');
  }

  private async getActiveGoals(patientId: string, orgId: string): Promise<string> {
    const goals = await this.db.query<any>(
      `SELECT title, description, progress_score, category
       FROM patient_goals
       WHERE patient_id = $1 AND organization_id = $2 AND status = 'active'
       ORDER BY priority DESC LIMIT 5`,
      [patientId, orgId],
    );

    if (!goals.length) return 'No active treatment goals documented.';

    return goals
      .map((g) => `- ${g.title} (${g.progress_score}% progress): ${g.description || ''}`)
      .join('\n');
  }

  private async getLatestAssessments(patientId: string, orgId: string): Promise<string> {
    const assessments = await this.db.query<any>(
      `SELECT at.name, at.code, ar.total_score, ar.severity_label, ar.completed_at
       FROM assessment_results ar
       JOIN assessment_templates at ON at.id = ar.template_id
       WHERE ar.patient_id = $1 AND ar.organization_id = $2 AND ar.status = 'completed'
       ORDER BY ar.completed_at DESC LIMIT 5`,
      [patientId, orgId],
    );

    if (!assessments.length) return 'No assessments completed.';

    return assessments
      .map((a) => `${a.name}: ${a.total_score} (${a.severity_label || 'Scored'}) — ${new Date(a.completed_at).toLocaleDateString()}`)
      .join('\n');
  }

  private async getActiveMedications(patientId: string, orgId: string): Promise<string> {
    const meds = await this.db.query<any>(
      `SELECT m.name, pm.dosage, pm.frequency, pm.start_date
       FROM patient_medications pm
       JOIN medications m ON m.id = pm.medication_id
       WHERE pm.patient_id = $1 AND pm.status = 'active'
       ORDER BY pm.start_date DESC`,
      [patientId, orgId],
    );

    if (!meds.length) return 'No active medications on record.';

    return meds
      .map((m) => `- ${m.name} ${m.dosage || ''} ${m.frequency || ''} (since ${m.start_date ? new Date(m.start_date).toLocaleDateString() : 'Unknown'})`)
      .join('\n');
  }

  private async getActiveRiskFlags(patientId: string, orgId: string): Promise<string> {
    const risks = await this.db.query<any>(
      `SELECT risk_type, risk_level, indicators, created_at
       FROM risk_assessments
       WHERE patient_id = $1 AND organization_id = $2 AND resolved_at IS NULL
       ORDER BY created_at DESC LIMIT 3`,
      [patientId, orgId],
    );

    if (!risks.length) return 'No active risk flags.';

    return risks
      .map((r) => `⚠️ ${r.risk_type.toUpperCase()} — ${r.risk_level} risk. Indicators: ${(r.indicators || []).join(', ')}`)
      .join('\n');
  }

  private async getRelevantMemories(patientId: string, orgId: string, queryText?: string): Promise<string> {
    // For now, get recent memories. With pgvector, this would use semantic search.
    const memories = await this.db.query<any>(
      `SELECT memory_type, title, content, confidence_score
       FROM patient_memory
       WHERE patient_id = $1 AND organization_id = $2 AND status = 'active'
       ORDER BY created_at DESC LIMIT 10`,
      [patientId, orgId],
    );

    if (!memories.length) return 'No patient memories extracted yet.';

    return memories
      .map((m) => `[${m.memory_type}] ${m.title}: ${m.content}`)
      .join('\n');
  }

  private async getCurrentTranscript(sessionId: string): Promise<string> {
    const segments = await this.db.query<any>(
      `SELECT speaker, text FROM transcript_segments
       WHERE session_id = $1
       ORDER BY sequence_number ASC`,
      [sessionId],
    );

    if (!segments.length) return '[No transcript yet]';

    return segments
      .map((s) => `${s.speaker.toUpperCase()}: ${s.text}`)
      .join('\n');
  }

  private async getTherapistPreferences(therapistId: string): Promise<string> {
    const therapist = await this.db.queryOne<any>(
      `SELECT therapy_modalities, session_types FROM therapists WHERE id = $1`,
      [therapistId],
    );

    if (!therapist) return 'CBT framework preferred.';

    return `Therapy modalities: ${(therapist.therapy_modalities || []).join(', ') || 'Not specified'}
Preferred session types: ${(therapist.session_types || []).join(', ') || 'Video'}`;
  }

  formatContextForPrompt(context: SessionContext): string {
    return `PATIENT CONTEXT:
${context.patient_summary}

RECENT SESSIONS:
${context.recent_sessions}

ACTIVE TREATMENT GOALS:
${context.current_goals}

LATEST ASSESSMENTS:
${context.assessments}

MEDICATIONS:
${context.medications}

RISK FLAGS:
${context.risk_flags}

THERAPIST PREFERENCES:
${context.therapist_preferences}

RELEVANT PATIENT MEMORIES:
${context.relevant_memories}

CURRENT SESSION TRANSCRIPT:
${context.current_transcript}`;
  }
}
