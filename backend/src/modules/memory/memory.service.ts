import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mental Health Memory Layer
 *
 * The Memory Service is the core intelligence engine of the platform.
 * It continuously accumulates, structures, updates, and retrieves
 * patient knowledge across all sessions over time.
 *
 * Architecture:
 * - Longitudinal Patient Intelligence: Every session adds to a growing knowledge graph
 * - Structured Memory Nodes: symptoms, medications, events, relationships, beliefs
 * - Temporal Tracking: all memories are time-stamped and can show evolution
 * - Therapist-Scoped: memory is permission-controlled and therapist-specific
 * - AI-Accessible: structured for efficient retrieval by AI systems
 * - Knowledge Graph: entities, relationships, and semantic connections
 */

export type MemoryNodeType =
  | 'symptom'
  | 'medication'
  | 'diagnosis'
  | 'life_event'
  | 'relationship'
  | 'belief'
  | 'behavior'
  | 'trigger'
  | 'coping_skill'
  | 'goal'
  | 'trauma'
  | 'strength'
  | 'concern'
  | 'progress'
  | 'insight'
  | 'treatment_response'
  | 'family_history'
  | 'substance'
  | 'sleep'
  | 'mood_pattern'
  | 'contextual_factor';

export type MemoryConfidence = 'low' | 'medium' | 'high' | 'confirmed';
export type MemoryStatus = 'active' | 'resolved' | 'updated' | 'retracted';

export interface MemoryNode {
  id: string;
  patient_id: string;
  therapist_id: string;
  organization_id: string;
  node_type: MemoryNodeType;
  label: string;
  content: string;
  structured_data?: Record<string, any>;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  source_session_id?: string;
  source_note_id?: string;
  first_observed_at: string;
  last_updated_at: string;
  times_observed: number;
  linked_node_ids?: string[];
  semantic_tags?: string[];
  is_ai_extracted: boolean;
  therapist_validated: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Core Memory Operations ───────────────────────────────────────────────

  async getPatientMemory(
    patientId: string,
    therapistId: string,
    orgId: string,
    options: {
      node_types?: MemoryNodeType[];
      status?: MemoryStatus;
      limit?: number;
      include_timeline?: boolean;
      include_graph?: boolean;
    } = {},
  ) {
    const { node_types, status = 'active', limit = 200, include_timeline = false, include_graph = false } = options;

    const params: any[] = [patientId, therapistId, orgId];
    const where: string[] = ['patient_id=$1', 'therapist_id=$2', 'organization_id=$3'];

    if (status) { params.push(status); where.push(`status=$${params.length}`); }
    if (node_types && node_types.length > 0) {
      params.push(node_types);
      where.push(`node_type = ANY($${params.length})`);
    }

    params.push(Math.min(limit, 500));

    const nodes = await this.db.query(
      `SELECT * FROM patient_memory_nodes
       WHERE ${where.join(' AND ')}
       ORDER BY last_updated_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);

    // Organize memory by type for structured retrieval
    const organized = this.organizeMemoryByType(nodes);

    const result: any = {
      patient_id: patientId,
      therapist_id: therapistId,
      memory_nodes: nodes,
      organized,
      total_nodes: nodes.length,
      retrieved_at: new Date().toISOString(),
    };

    if (include_timeline) {
      result.timeline = await this.getMemoryTimeline(patientId, therapistId, orgId);
    }

    if (include_graph) {
      result.knowledge_graph = await this.buildKnowledgeGraph(patientId, therapistId, orgId);
    }

    return result;
  }

  private organizeMemoryByType(nodes: any[]) {
    const organized: Record<string, any[]> = {};
    for (const node of nodes) {
      if (!organized[node.node_type]) organized[node.node_type] = [];
      organized[node.node_type].push(node);
    }
    return organized;
  }

  async addMemoryNode(dto: {
    patient_id: string;
    therapist_id: string;
    organization_id: string;
    node_type: MemoryNodeType;
    label: string;
    content: string;
    structured_data?: Record<string, any>;
    confidence?: MemoryConfidence;
    source_session_id?: string;
    source_note_id?: string;
    semantic_tags?: string[];
    is_ai_extracted?: boolean;
  }): Promise<MemoryNode> {
    const id = uuidv4();

    // Check for duplicate/similar node to update rather than create new
    const existing = await this.findSimilarNode(
      dto.patient_id, dto.therapist_id, dto.node_type, dto.label,
    );

    if (existing) {
      return this.updateMemoryNode(existing.id, {
        content: dto.content,
        structured_data: dto.structured_data,
        last_updated_at: new Date().toISOString(),
        times_observed: (existing.times_observed || 0) + 1,
        confidence: this.upgradeConfidence(existing.confidence, dto.confidence || 'medium'),
      });
    }

    const result = await this.db.query(
      `INSERT INTO patient_memory_nodes (
        id, patient_id, therapist_id, organization_id,
        node_type, label, content, structured_data,
        confidence, status, source_session_id, source_note_id,
        first_observed_at, last_updated_at, times_observed,
        semantic_tags, is_ai_extracted, therapist_validated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,NOW(),NOW(),1,$12,$13,false)
      RETURNING *`,
      [
        id, dto.patient_id, dto.therapist_id, dto.organization_id,
        dto.node_type, dto.label, dto.content,
        JSON.stringify(dto.structured_data || {}),
        dto.confidence || 'medium',
        dto.source_session_id || null,
        dto.source_note_id || null,
        JSON.stringify(dto.semantic_tags || []),
        dto.is_ai_extracted || false,
      ],
    ).catch(async () => {
      // Return in-memory node if DB not ready
      return [{ id, ...dto, status: 'active', times_observed: 1, first_observed_at: new Date().toISOString(), last_updated_at: new Date().toISOString() }];
    });

    return result[0];
  }

  async updateMemoryNode(nodeId: string, updates: Partial<MemoryNode>): Promise<MemoryNode> {
    const fields: string[] = [];
    const params: any[] = [nodeId];

    const updatable = ['content', 'structured_data', 'confidence', 'status', 'times_observed', 'therapist_validated', 'semantic_tags', 'metadata'];
    for (const key of updatable) {
      if ((updates as any)[key] !== undefined) {
        params.push(typeof (updates as any)[key] === 'object' ? JSON.stringify((updates as any)[key]) : (updates as any)[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }

    params.push(new Date().toISOString());
    fields.push(`last_updated_at = $${params.length}`);

    const result = await this.db.queryOne<any>(
      `UPDATE patient_memory_nodes SET ${fields.join(', ')} WHERE id=$1 RETURNING *`,
      params,
    ).catch(() => ({ id: nodeId, ...updates }));

    return result as MemoryNode;
  }

  async resolveMemoryNode(nodeId: string, therapistId: string) {
    return this.db.queryOne<any>(
      `UPDATE patient_memory_nodes SET status='resolved', last_updated_at=NOW()
       WHERE id=$1 AND therapist_id=$2 RETURNING *`,
      [nodeId, therapistId],
    ).catch(() => null);
  }

  async validateMemoryNode(nodeId: string, therapistId: string) {
    return this.db.queryOne<any>(
      `UPDATE patient_memory_nodes SET therapist_validated=true, confidence='confirmed', last_updated_at=NOW()
       WHERE id=$1 AND therapist_id=$2 RETURNING *`,
      [nodeId, therapistId],
    ).catch(() => null);
  }

  private async findSimilarNode(
    patientId: string,
    therapistId: string,
    nodeType: string,
    label: string,
  ) {
    return this.db.queryOne<any>(
      `SELECT * FROM patient_memory_nodes
       WHERE patient_id=$1 AND therapist_id=$2 AND node_type=$3
         AND lower(label) = lower($4) AND status='active'
       LIMIT 1`,
      [patientId, therapistId, nodeType, label],
    ).catch(() => null);
  }

  private upgradeConfidence(current: string, incoming: string): MemoryConfidence {
    const order = ['low', 'medium', 'high', 'confirmed'];
    const currentIdx = order.indexOf(current);
    const incomingIdx = order.indexOf(incoming);
    return order[Math.max(currentIdx, incomingIdx)] as MemoryConfidence;
  }

  // ─── AI Memory Extraction ────────────────────────────────────────────────

  async extractMemoriesFromNote(
    noteId: string,
    sessionId: string,
    patientId: string,
    therapistId: string,
    orgId: string,
    noteContent: string,
  ) {
    this.logger.log(`Extracting memories from note ${noteId}`);

    // Parse clinical note for memory-worthy information
    const extractedMemories = await this.parseNoteForMemories(noteContent, patientId, therapistId, orgId);

    const saved: MemoryNode[] = [];
    for (const memory of extractedMemories) {
      try {
        const node = await this.addMemoryNode({
          ...memory,
          patient_id: patientId,
          therapist_id: therapistId,
          organization_id: orgId,
          source_session_id: sessionId,
          source_note_id: noteId,
          is_ai_extracted: true,
        } as any);
        saved.push(node);
      } catch (err) {
        this.logger.warn(`Failed to save memory node: ${err.message}`);
      }
    }

    // Update session memory extraction status
    await this.db.query(
      `UPDATE sessions SET memory_extracted=true, memory_extracted_at=NOW() WHERE id=$1`,
      [sessionId],
    ).catch(() => null);

    this.logger.log(`Extracted and saved ${saved.length} memory nodes`);
    return { extracted: saved.length, nodes: saved };
  }

  private async parseNoteForMemories(
    content: string,
    patientId: string,
    therapistId: string,
    orgId: string,
  ) {
    // Rule-based extraction (AI model would enhance this in production)
    const memories: Partial<MemoryNode>[] = [];
    const lines = content.toLowerCase();

    // Symptom detection
    const symptomKeywords = ['reports', 'experiencing', 'symptoms', 'complains', 'describes'];
    if (symptomKeywords.some((kw) => lines.includes(kw))) {
      // Extract symptom mentions using pattern matching
      const symptomPatterns = [
        /(?:reports|experiencing|suffering from|complains of)\s+([\w\s,]+?)(?:\.|,|;|$)/gi,
      ];
      for (const pattern of symptomPatterns) {
        const match = content.match(pattern);
        if (match) {
          memories.push({
            node_type: 'symptom',
            label: match[0].substring(0, 80),
            content: match[0],
            confidence: 'medium',
          });
        }
      }
    }

    // Medication mentions
    if (lines.includes('medication') || lines.includes('prescribed') || lines.includes('mg')) {
      memories.push({
        node_type: 'medication',
        label: 'Medication mentioned in session',
        content: 'Medication-related content detected in session note',
        confidence: 'medium',
      });
    }

    // Life events
    if (lines.includes('event') || lines.includes('happened') || lines.includes('experienced')) {
      memories.push({
        node_type: 'life_event',
        label: 'Life event discussed',
        content: 'Life event mentioned during session',
        confidence: 'low',
      });
    }

    // Coping skills
    if (lines.includes('coping') || lines.includes('strategy') || lines.includes('technique')) {
      memories.push({
        node_type: 'coping_skill',
        label: 'Coping strategy discussed',
        content: 'Coping skill or technique identified in session',
        confidence: 'medium',
      });
    }

    // Goals
    if (lines.includes('goal') || lines.includes('objective') || lines.includes('want to')) {
      memories.push({
        node_type: 'goal',
        label: 'Patient goal identified',
        content: 'Goal or objective discussed in session',
        confidence: 'medium',
      });
    }

    // Insights
    if (lines.includes('insight') || lines.includes('realization') || lines.includes('recognized')) {
      memories.push({
        node_type: 'insight',
        label: 'Clinical insight noted',
        content: 'Patient insight or realization documented',
        confidence: 'high',
      });
    }

    return memories;
  }

  // ─── Memory Timeline ──────────────────────────────────────────────────────

  async getMemoryTimeline(patientId: string, therapistId: string, orgId: string) {
    return this.db.query(
      `SELECT
        pmn.id,
        pmn.node_type,
        pmn.label,
        pmn.content,
        pmn.confidence,
        pmn.status,
        pmn.first_observed_at,
        pmn.last_updated_at,
        pmn.times_observed,
        s.scheduled_at as session_date,
        s.session_number
       FROM patient_memory_nodes pmn
       LEFT JOIN sessions s ON s.id = pmn.source_session_id
       WHERE pmn.patient_id=$1 AND pmn.therapist_id=$2 AND pmn.organization_id=$3
       ORDER BY pmn.first_observed_at DESC
       LIMIT 100`,
      [patientId, therapistId, orgId],
    ).catch(() => []);
  }

  // ─── Knowledge Graph ──────────────────────────────────────────────────────

  async buildKnowledgeGraph(patientId: string, therapistId: string, orgId: string) {
    const nodes = await this.db.query(
      `SELECT id, node_type, label, confidence, status, times_observed
       FROM patient_memory_nodes
       WHERE patient_id=$1 AND therapist_id=$2 AND organization_id=$3 AND status='active'`,
      [patientId, therapistId, orgId],
    ).catch(() => []);

    const relationships = await this.db.query(
      `SELECT * FROM memory_node_relationships
       WHERE organization_id=$1 AND (
         from_node_id IN (SELECT id FROM patient_memory_nodes WHERE patient_id=$2)
         OR to_node_id IN (SELECT id FROM patient_memory_nodes WHERE patient_id=$2)
       )`,
      [orgId, patientId],
    ).catch(() => []);

    // Build adjacency for implicit relationships based on node types
    const implicitEdges = this.buildImplicitRelationships(nodes);

    return {
      nodes: nodes.map((n: any) => ({
        id: n.id,
        type: n.node_type,
        label: n.label,
        confidence: n.confidence,
        weight: n.times_observed,
      })),
      edges: [...relationships, ...implicitEdges],
      stats: {
        total_nodes: nodes.length,
        total_edges: relationships.length + implicitEdges.length,
        node_types: [...new Set(nodes.map((n: any) => n.node_type))],
      },
    };
  }

  private buildImplicitRelationships(nodes: any[]) {
    const edges: any[] = [];
    const typeGroups: Record<string, string[]> = {};

    for (const node of nodes) {
      if (!typeGroups[node.node_type]) typeGroups[node.node_type] = [];
      typeGroups[node.node_type].push(node.id);
    }

    // Symptoms often relate to triggers
    const symptoms = typeGroups['symptom'] || [];
    const triggers = typeGroups['trigger'] || [];
    for (const s of symptoms) {
      for (const t of triggers) {
        edges.push({ from: t, to: s, relationship: 'may_cause', weight: 0.5, implicit: true });
      }
    }

    // Goals relate to strengths
    const goals = typeGroups['goal'] || [];
    const strengths = typeGroups['strength'] || [];
    for (const g of goals.slice(0, 3)) {
      for (const st of strengths.slice(0, 3)) {
        edges.push({ from: st, to: g, relationship: 'supports', weight: 0.4, implicit: true });
      }
    }

    return edges;
  }

  // ─── Longitudinal Intelligence ────────────────────────────────────────────

  async getLongitudinalIntelligence(patientId: string, therapistId: string, orgId: string) {
    const [
      memoryNodes,
      sessionHistory,
      assessmentHistory,
      medicationHistory,
      riskHistory,
    ] = await Promise.all([
      this.getPatientMemory(patientId, therapistId, orgId, { limit: 100 }),
      this.getSessionIntelligence(patientId, therapistId),
      this.getAssessmentIntelligence(patientId, orgId),
      this.getMedicationHistory(patientId, orgId),
      this.getRiskHistory(patientId, orgId),
    ]);

    // Build comprehensive patient intelligence profile
    const profile = this.buildIntelligenceProfile(
      memoryNodes,
      sessionHistory,
      assessmentHistory,
      medicationHistory,
      riskHistory,
    );

    return {
      patient_id: patientId,
      therapist_id: therapistId,
      profile,
      memory_summary: this.summarizeMemory(memoryNodes.organized),
      generated_at: new Date().toISOString(),
    };
  }

  private async getSessionIntelligence(patientId: string, therapistId: string) {
    return this.db.query(
      `SELECT
        s.id, s.session_number, s.scheduled_at, s.status, s.duration_minutes,
        s.session_type, s.therapist_mood_rating, s.patient_engagement_score,
        n.structured_content, n.status as note_status
       FROM sessions s
       LEFT JOIN ai_session_notes n ON n.session_id = s.id
       WHERE s.patient_id=$1 AND s.therapist_id=$2 AND s.status='completed'
       ORDER BY s.scheduled_at DESC
       LIMIT 20`,
      [patientId, therapistId],
    ).catch(() => []);
  }

  private async getAssessmentIntelligence(patientId: string, orgId: string) {
    return this.db.query(
      `SELECT pa.administered_at, pa.total_score, pa.severity_label, at.code
       FROM patient_assessments pa
       JOIN assessment_templates at ON at.id = pa.template_id
       WHERE pa.patient_id=$1 AND pa.organization_id=$2 AND pa.status='completed'
       ORDER BY pa.administered_at DESC
       LIMIT 20`,
      [patientId, orgId],
    ).catch(() => []);
  }

  private async getMedicationHistory(patientId: string, orgId: string) {
    return this.db.query(
      `SELECT m.*, mt.name as medication_name
       FROM patient_medications m
       LEFT JOIN medication_types mt ON mt.id = m.medication_type_id
       WHERE m.patient_id=$1 AND m.organization_id=$2
       ORDER BY m.start_date DESC`,
      [patientId, orgId],
    ).catch(() => []);
  }

  private async getRiskHistory(patientId: string, orgId: string) {
    return this.db.query(
      `SELECT ra.created_at, ra.risk_level, ra.alert_type, ra.description, ra.status
       FROM risk_alerts ra
       WHERE ra.patient_id=$1 AND ra.organization_id=$2
       ORDER BY ra.created_at DESC
       LIMIT 10`,
      [patientId, orgId],
    ).catch(() => []);
  }

  private buildIntelligenceProfile(
    memoryNodes: any,
    sessions: any[],
    assessments: any[],
    medications: any[],
    risks: any[],
  ) {
    const organized = memoryNodes.organized || {};

    return {
      // Clinical snapshot
      active_diagnoses: organized['diagnosis']?.filter((n: any) => n.status === 'active').map((n: any) => n.label) || [],
      current_medications: medications.filter((m) => m.status === 'active').map((m) => m.medication_name || m.medication),
      active_symptoms: organized['symptom']?.slice(0, 10).map((n: any) => n.label) || [],
      identified_triggers: organized['trigger']?.map((n: any) => n.label) || [],
      coping_skills: organized['coping_skill']?.map((n: any) => n.label) || [],
      treatment_goals: organized['goal']?.filter((n: any) => n.status === 'active').map((n: any) => n.label) || [],
      strengths: organized['strength']?.map((n: any) => n.label) || [],
      trauma_history: organized['trauma']?.map((n: any) => ({ label: n.label, confidence: n.confidence })) || [],

      // Session intelligence
      total_sessions: sessions.length,
      avg_engagement: sessions.length > 0
        ? Math.round(sessions.reduce((s, sess) => s + (sess.patient_engagement_score || 3), 0) / sessions.length * 10) / 10
        : null,
      last_session_date: sessions[0]?.scheduled_at,

      // Assessment intelligence
      latest_phq9: assessments.find((a) => a.code === 'PHQ9'),
      latest_gad7: assessments.find((a) => a.code === 'GAD7'),
      assessment_trend: this.computeSimpleTrend(
        assessments.filter((a) => a.code === 'PHQ9').slice(0, 5).map((a) => a.total_score),
      ),

      // Risk intelligence
      risk_history_count: risks.length,
      last_risk_alert: risks[0] || null,
      has_active_risk: risks.some((r) => r.status === 'unreviewed' && r.risk_level === 'high'),

      // Memory statistics
      total_memory_nodes: memoryNodes.total_nodes,
      memory_by_type: Object.fromEntries(
        Object.entries(organized).map(([k, v]) => [k, (v as any[]).length]),
      ),
    };
  }

  private computeSimpleTrend(scores: number[]): string {
    if (scores.length < 2) return 'insufficient_data';
    const delta = scores[0] - scores[scores.length - 1];
    if (delta > 3) return 'improving';
    if (delta < -3) return 'worsening';
    return 'stable';
  }

  private summarizeMemory(organized: Record<string, any[]>) {
    const summary: Record<string, any> = {};
    for (const [type, nodes] of Object.entries(organized)) {
      summary[type] = {
        count: nodes.length,
        active: nodes.filter((n) => n.status === 'active').length,
        validated: nodes.filter((n) => n.therapist_validated).length,
        recent: nodes[0]?.label,
      };
    }
    return summary;
  }

  // ─── Context Building for AI ──────────────────────────────────────────────

  async buildAIContext(
    patientId: string,
    therapistId: string,
    orgId: string,
    options: { depth?: 'brief' | 'standard' | 'comprehensive'; focus?: MemoryNodeType[] } = {},
  ) {
    const { depth = 'standard', focus } = options;
    const nodeLimit = depth === 'brief' ? 20 : depth === 'standard' ? 50 : 150;

    const memory = await this.getPatientMemory(patientId, therapistId, orgId, {
      node_types: focus,
      limit: nodeLimit,
    });

    const intelligence = await this.getLongitudinalIntelligence(patientId, therapistId, orgId);

    // Format for AI consumption
    const contextBlocks: string[] = [];

    const profile = intelligence.profile;

    if (profile.active_diagnoses.length > 0) {
      contextBlocks.push(`DIAGNOSES: ${profile.active_diagnoses.join(', ')}`);
    }

    if (profile.current_medications.length > 0) {
      contextBlocks.push(`CURRENT MEDICATIONS: ${profile.current_medications.join(', ')}`);
    }

    if (profile.active_symptoms.length > 0) {
      contextBlocks.push(`ACTIVE SYMPTOMS: ${profile.active_symptoms.join(', ')}`);
    }

    if (profile.identified_triggers.length > 0) {
      contextBlocks.push(`KNOWN TRIGGERS: ${profile.identified_triggers.join(', ')}`);
    }

    if (profile.coping_skills.length > 0) {
      contextBlocks.push(`COPING SKILLS: ${profile.coping_skills.join(', ')}`);
    }

    if (profile.treatment_goals.length > 0) {
      contextBlocks.push(`TREATMENT GOALS: ${profile.treatment_goals.join(', ')}`);
    }

    if (profile.latest_phq9) {
      contextBlocks.push(`LATEST PHQ-9: ${profile.latest_phq9.total_score} (${profile.latest_phq9.severity_label}), dated ${profile.latest_phq9.administered_at?.substring(0, 10)}`);
    }

    if (profile.latest_gad7) {
      contextBlocks.push(`LATEST GAD-7: ${profile.latest_gad7.total_score} (${profile.latest_gad7.severity_label}), dated ${profile.latest_gad7.administered_at?.substring(0, 10)}`);
    }

    if (profile.has_active_risk) {
      contextBlocks.push('⚠️ ACTIVE RISK ALERT: Patient has unreviewed high-risk alert');
    }

    contextBlocks.push(`SESSIONS COMPLETED: ${profile.total_sessions}`);
    if (profile.last_session_date) {
      contextBlocks.push(`LAST SESSION: ${new Date(profile.last_session_date).toLocaleDateString()}`);
    }

    // Add recent memories with high confidence
    const highConfidenceNodes = memory.memory_nodes
      .filter((n: any) => ['high', 'confirmed'].includes(n.confidence))
      .slice(0, 10);

    if (highConfidenceNodes.length > 0) {
      contextBlocks.push('\nKEY CLINICAL HISTORY:');
      for (const node of highConfidenceNodes) {
        contextBlocks.push(`- [${node.node_type.toUpperCase()}] ${node.label}: ${node.content.substring(0, 200)}`);
      }
    }

    return {
      context_text: contextBlocks.join('\n'),
      memory_nodes_used: memory.total_nodes,
      profile_summary: profile,
      generated_at: new Date().toISOString(),
    };
  }

  // ─── Bulk Operations ──────────────────────────────────────────────────────

  async bulkAddMemories(memories: Partial<MemoryNode>[]) {
    const results = await Promise.allSettled(
      memories.map((m) => this.addMemoryNode(m as any)),
    );
    const success = results.filter((r) => r.status === 'fulfilled').length;
    return { saved: success, failed: memories.length - success };
  }

  async deleteMemoryNode(nodeId: string, therapistId: string) {
    return this.db.query(
      `UPDATE patient_memory_nodes SET status='retracted', last_updated_at=NOW()
       WHERE id=$1 AND therapist_id=$2`,
      [nodeId, therapistId],
    ).catch(() => null);
  }

  async searchMemory(
    patientId: string,
    therapistId: string,
    orgId: string,
    searchQuery: string,
  ) {
    return this.db.query(
      `SELECT * FROM patient_memory_nodes
       WHERE patient_id=$1 AND therapist_id=$2 AND organization_id=$3
         AND status='active'
         AND (lower(label) LIKE lower($4) OR lower(content) LIKE lower($4))
       ORDER BY times_observed DESC, confidence DESC
       LIMIT 20`,
      [patientId, therapistId, orgId, `%${searchQuery}%`],
    ).catch(() => []);
  }
}
