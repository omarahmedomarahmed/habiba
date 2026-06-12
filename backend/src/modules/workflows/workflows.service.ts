import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mental Health Workflow Engine
 *
 * A comprehensive workflow management system that automates and orchestrates
 * all clinical, administrative, and operational workflows across the platform.
 *
 * Workflow types:
 * - Intake workflows (patient onboarding, consent collection, initial assessment)
 * - Session workflows (pre-session prep, in-session assistance, post-session tasks)
 * - Treatment workflows (treatment plan creation, review, goal tracking)
 * - Care protocols (evidence-based care pathways like CBT, DBT, ACT)
 * - Administrative workflows (billing, scheduling, reporting)
 * - Crisis workflows (risk alerts, emergency protocols, escalation)
 * - Discharge workflows (outcome summary, aftercare planning, follow-up)
 */

export type WorkflowType =
  | 'patient_intake'
  | 'session_pre'
  | 'session_post'
  | 'treatment_plan_review'
  | 'assessment_scheduled'
  | 'risk_escalation'
  | 'billing_cycle'
  | 'discharge'
  | 'care_protocol'
  | 'follow_up'
  | 'onboarding_therapist'
  | 'consent_collection'
  | 'medication_review'
  | 'referral';

export type WorkflowStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Workflow Templates ───────────────────────────────────────────────────

  async listWorkflowTemplates(query: any = {}) {
    const { workflow_type, is_active = true } = query;
    const builtIn = this.getBuiltInWorkflowTemplates();

    if (workflow_type) {
      return builtIn.filter((t) => t.workflow_type === workflow_type);
    }

    return builtIn;
  }

  private getBuiltInWorkflowTemplates() {
    return [
      {
        id: 'wf-intake',
        name: 'Patient Intake Workflow',
        workflow_type: 'patient_intake',
        description: 'Complete onboarding process for new patients',
        estimated_duration_days: 7,
        steps: [
          { order: 1, name: 'Collect demographic information', type: 'form', required: true },
          { order: 2, name: 'Obtain signed consent forms', type: 'consent', required: true },
          { order: 3, name: 'Initial PHQ-9 assessment', type: 'assessment', required: true, template_code: 'PHQ9' },
          { order: 4, name: 'Initial GAD-7 assessment', type: 'assessment', required: true, template_code: 'GAD7' },
          { order: 5, name: 'Schedule first session', type: 'scheduling', required: true },
          { order: 6, name: 'Send welcome email', type: 'notification', required: false },
          { order: 7, name: 'Create initial treatment plan', type: 'treatment_plan', required: false },
        ],
      },
      {
        id: 'wf-session-pre',
        name: 'Pre-Session Preparation',
        workflow_type: 'session_pre',
        description: 'Automated preparation tasks before each session',
        estimated_duration_days: 0,
        steps: [
          { order: 1, name: 'Review patient memory context', type: 'ai_context', required: true },
          { order: 2, name: 'Check pending assessments', type: 'assessment_check', required: true },
          { order: 3, name: 'Review risk alerts', type: 'risk_check', required: true },
          { order: 4, name: 'Send session reminder to patient', type: 'notification', required: false },
          { order: 5, name: 'Load previous session notes', type: 'data_load', required: true },
        ],
      },
      {
        id: 'wf-session-post',
        name: 'Post-Session Documentation',
        workflow_type: 'session_post',
        description: 'Complete documentation and follow-up tasks after each session',
        estimated_duration_days: 1,
        steps: [
          { order: 1, name: 'Generate AI session note', type: 'ai_note', required: true },
          { order: 2, name: 'Review and finalize note', type: 'note_review', required: true },
          { order: 3, name: 'Extract memory updates', type: 'memory_extraction', required: true },
          { order: 4, name: 'Update treatment plan progress', type: 'treatment_update', required: false },
          { order: 5, name: 'Schedule next session', type: 'scheduling', required: false },
          { order: 6, name: 'Assign homework/resources', type: 'resource_assignment', required: false },
          { order: 7, name: 'Submit billing', type: 'billing', required: false },
        ],
      },
      {
        id: 'wf-risk-escalation',
        name: 'Crisis Risk Escalation',
        workflow_type: 'risk_escalation',
        description: 'Emergency protocol for high-risk patient situations',
        estimated_duration_days: 0,
        steps: [
          { order: 1, name: 'Immediate risk assessment (C-SSRS)', type: 'assessment', required: true, template_code: 'C-SSRS' },
          { order: 2, name: 'Alert supervisor/administrator', type: 'alert', required: true },
          { order: 3, name: 'Document safety plan', type: 'safety_plan', required: true },
          { order: 4, name: 'Contact emergency services if needed', type: 'emergency_contact', required: false },
          { order: 5, name: 'Schedule follow-up within 24 hours', type: 'scheduling', required: true },
          { order: 6, name: 'Notify care team', type: 'notification', required: true },
        ],
      },
      {
        id: 'wf-treatment-review',
        name: 'Treatment Plan Review',
        workflow_type: 'treatment_plan_review',
        description: 'Periodic review and update of treatment plans',
        estimated_duration_days: 3,
        steps: [
          { order: 1, name: 'Review current goals and progress', type: 'review', required: true },
          { order: 2, name: 'Administer outcome measures', type: 'assessment', required: true },
          { order: 3, name: 'Update goals if needed', type: 'goal_update', required: true },
          { order: 4, name: 'Review medication effectiveness', type: 'medication_review', required: false },
          { order: 5, name: 'Update treatment modalities', type: 'treatment_update', required: true },
          { order: 6, name: 'Document review summary', type: 'documentation', required: true },
        ],
      },
      {
        id: 'wf-discharge',
        name: 'Discharge Workflow',
        workflow_type: 'discharge',
        description: 'Complete discharge process with outcome documentation',
        estimated_duration_days: 7,
        steps: [
          { order: 1, name: 'Final outcome assessments', type: 'assessment', required: true },
          { order: 2, name: 'Generate discharge summary', type: 'ai_summary', required: true },
          { order: 3, name: 'Create aftercare plan', type: 'aftercare_plan', required: true },
          { order: 4, name: 'Provide referrals if needed', type: 'referral', required: false },
          { order: 5, name: 'Share discharge documentation with patient', type: 'document_share', required: true },
          { order: 6, name: 'Schedule 30-day follow-up', type: 'scheduling', required: false },
          { order: 7, name: 'Archive patient records', type: 'archival', required: false },
        ],
      },
    ];
  }

  // ─── Active Workflows ─────────────────────────────────────────────────────

  async listWorkflows(orgId: string, query: any = {}) {
    const { therapist_id, patient_id, status, workflow_type, limit = 20 } = query;
    const params: any[] = [orgId];
    const where: string[] = ['w.organization_id=$1'];

    if (therapist_id) { params.push(therapist_id); where.push(`w.therapist_id=$${params.length}`); }
    if (patient_id) { params.push(patient_id); where.push(`w.patient_id=$${params.length}`); }
    if (status) { params.push(status); where.push(`w.status=$${params.length}`); }
    if (workflow_type) { params.push(workflow_type); where.push(`w.workflow_type=$${params.length}`); }

    params.push(Math.min(Number(limit), 100));

    return this.db.query(
      `SELECT w.*,
        p.first_name || ' ' || p.last_name as patient_name,
        t.display_name as therapist_name
       FROM clinical_workflows w
       LEFT JOIN patients p ON p.id = w.patient_id
       LEFT JOIN therapists t ON t.id = w.therapist_id
       WHERE ${where.join(' AND ')}
       ORDER BY w.created_at DESC
       LIMIT $${params.length}`,
      params,
    ).catch(() => []);
  }

  async getWorkflow(workflowId: string, orgId: string) {
    const workflow = await this.db.queryOne<any>(
      `SELECT w.*,
        p.first_name || ' ' || p.last_name as patient_name,
        t.display_name as therapist_name
       FROM clinical_workflows w
       LEFT JOIN patients p ON p.id = w.patient_id
       LEFT JOIN therapists t ON t.id = w.therapist_id
       WHERE w.id=$1 AND w.organization_id=$2`,
      [workflowId, orgId],
    ).catch(() => null);

    if (!workflow) throw new NotFoundException('Workflow not found');

    // Get tasks
    const tasks = await this.db.query(
      `SELECT * FROM workflow_tasks WHERE workflow_id=$1 ORDER BY task_order ASC`,
      [workflowId],
    ).catch(() => []);

    return { ...workflow, tasks };
  }

  async createWorkflow(dto: {
    organization_id: string;
    therapist_id: string;
    patient_id?: string;
    workflow_type: WorkflowType;
    template_id?: string;
    title?: string;
    context?: Record<string, any>;
    session_id?: string;
    triggered_by?: string;
  }) {
    const id = uuidv4();
    const template = this.getBuiltInWorkflowTemplates().find((t) => t.workflow_type === dto.workflow_type);

    const result = await this.db.query(
      `INSERT INTO clinical_workflows (
        id, organization_id, therapist_id, patient_id,
        workflow_type, template_id, title, status,
        context, session_id, triggered_by, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,NOW())
      RETURNING *`,
      [
        id, dto.organization_id, dto.therapist_id, dto.patient_id || null,
        dto.workflow_type, dto.template_id || template?.id || null,
        dto.title || template?.name || dto.workflow_type,
        JSON.stringify(dto.context || {}),
        dto.session_id || null,
        dto.triggered_by || 'system',
      ],
    ).catch(() => [{ id, ...dto, status: 'pending', created_at: new Date().toISOString() }]);

    // Create workflow tasks from template
    if (template) {
      await this.createWorkflowTasks(id, template.steps, dto.organization_id);
    }

    return result[0];
  }

  private async createWorkflowTasks(workflowId: string, steps: any[], orgId: string) {
    for (const step of steps) {
      const taskId = uuidv4();
      await this.db.query(
        `INSERT INTO workflow_tasks (
          id, workflow_id, organization_id, task_order, name, task_type,
          status, is_required, metadata, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,NOW())`,
        [taskId, workflowId, orgId, step.order, step.name, step.type,
         step.required, JSON.stringify({ template_code: step.template_code })],
      ).catch(() => null);
    }
  }

  async updateWorkflowStatus(workflowId: string, status: WorkflowStatus, orgId: string) {
    return this.db.queryOne<any>(
      `UPDATE clinical_workflows
       SET status=$2, updated_at=NOW(),
           completed_at = CASE WHEN $2 IN ('completed','cancelled') THEN NOW() ELSE completed_at END
       WHERE id=$1 AND organization_id=$3 RETURNING *`,
      [workflowId, status, orgId],
    ).catch(() => null);
  }

  async completeWorkflowTask(taskId: string, workflowId: string, orgId: string, result?: any) {
    await this.db.query(
      `UPDATE workflow_tasks SET status='completed', completed_at=NOW(), result=$3
       WHERE id=$1 AND workflow_id=$2`,
      [taskId, workflowId, JSON.stringify(result || {})],
    ).catch(() => null);

    // Check if all required tasks are complete
    const allTasks = await this.db.query(
      `SELECT * FROM workflow_tasks WHERE workflow_id=$1`,
      [workflowId],
    ).catch(() => []);

    const requiredTasks = allTasks.filter((t: any) => t.is_required);
    const allCompleted = requiredTasks.every((t: any) => ['completed', 'skipped'].includes(t.status));

    if (allCompleted && requiredTasks.length > 0) {
      await this.updateWorkflowStatus(workflowId, 'completed', orgId);
    }

    return { task_completed: true, workflow_completed: allCompleted };
  }

  // ─── Session Workflows ────────────────────────────────────────────────────

  async triggerSessionWorkflows(sessionId: string, eventType: 'pre_session' | 'post_session', orgId: string, therapistId: string, patientId: string) {
    const workflowType = eventType === 'pre_session' ? 'session_pre' : 'session_post';

    return this.createWorkflow({
      organization_id: orgId,
      therapist_id: therapistId,
      patient_id: patientId,
      workflow_type: workflowType,
      session_id: sessionId,
      triggered_by: 'session_event',
    });
  }

  // ─── Pending Workflows Summary ────────────────────────────────────────────

  async getPendingWorkflows(therapistId: string, orgId: string) {
    const workflows = await this.db.query(
      `SELECT w.*,
        p.first_name || ' ' || p.last_name as patient_name,
        COUNT(t.id) FILTER (WHERE t.status='pending') as pending_tasks,
        COUNT(t.id) as total_tasks
       FROM clinical_workflows w
       LEFT JOIN patients p ON p.id = w.patient_id
       LEFT JOIN workflow_tasks t ON t.workflow_id = w.id
       WHERE w.therapist_id=$1 AND w.organization_id=$2 AND w.status IN ('pending','active')
       GROUP BY w.id, p.first_name, p.last_name
       ORDER BY w.created_at DESC
       LIMIT 20`,
      [therapistId, orgId],
    ).catch(() => []);

    return workflows;
  }

  // ─── Care Protocols ───────────────────────────────────────────────────────

  async getCareProtocols() {
    return [
      {
        id: 'cbt-depression',
        name: 'CBT for Depression',
        description: 'Cognitive Behavioral Therapy protocol for Major Depressive Disorder',
        modality: 'CBT',
        target_condition: 'MDD',
        recommended_sessions: 16,
        evidence_level: 'Level I - Strong Evidence',
        phases: [
          { phase: 1, name: 'Assessment & Psychoeducation', sessions: '1-4', goals: ['Establish therapeutic alliance', 'Assess symptoms', 'Introduce CBT model'] },
          { phase: 2, name: 'Behavioral Activation', sessions: '5-8', goals: ['Increase activity scheduling', 'Address avoidance', 'Monitor mood patterns'] },
          { phase: 3, name: 'Cognitive Restructuring', sessions: '9-12', goals: ['Identify cognitive distortions', 'Challenge negative thoughts', 'Develop balanced thinking'] },
          { phase: 4, name: 'Skills Consolidation & Relapse Prevention', sessions: '13-16', goals: ['Consolidate skills', 'Develop relapse prevention plan', 'Prepare for termination'] },
        ],
        outcome_measures: ['PHQ9', 'GAD7'],
        resources: ['Thought record worksheet', 'Activity scheduling form', 'Behavioral activation diary'],
      },
      {
        id: 'dbt-bpd',
        name: 'DBT Skills Training',
        description: 'Dialectical Behavior Therapy for Borderline Personality Disorder and emotional dysregulation',
        modality: 'DBT',
        target_condition: 'BPD',
        recommended_sessions: 24,
        evidence_level: 'Level I - Strong Evidence',
        phases: [
          { phase: 1, name: 'Mindfulness Skills', sessions: '1-6', goals: ['Observe and describe', 'Participate fully', 'Be non-judgmental'] },
          { phase: 2, name: 'Distress Tolerance', sessions: '7-12', goals: ['Crisis survival skills', 'Reality acceptance', 'Radical acceptance'] },
          { phase: 3, name: 'Emotion Regulation', sessions: '13-18', goals: ['Identify emotions', 'Reduce vulnerability', 'Build positive experiences'] },
          { phase: 4, name: 'Interpersonal Effectiveness', sessions: '19-24', goals: ['DEAR MAN skills', 'Relationship effectiveness', 'Self-respect effectiveness'] },
        ],
        outcome_measures: ['PHQ9', 'PCL5'],
        resources: ['DBT diary card', 'Skills training manual'],
      },
      {
        id: 'emdr-trauma',
        name: 'EMDR Trauma Processing',
        description: 'Eye Movement Desensitization and Reprocessing for PTSD and trauma',
        modality: 'EMDR',
        target_condition: 'PTSD',
        recommended_sessions: 12,
        evidence_level: 'Level I - Strong Evidence',
        phases: [
          { phase: 1, name: 'History Taking & Treatment Planning', sessions: '1-2' },
          { phase: 2, name: 'Preparation & Stabilization', sessions: '3-4' },
          { phase: 3, name: 'Assessment of Target Memory', sessions: '5-6' },
          { phase: 4, name: 'Desensitization & Reprocessing', sessions: '7-10' },
          { phase: 5, name: 'Closure & Re-evaluation', sessions: '11-12' },
        ],
        outcome_measures: ['PCL5', 'PHQ9'],
        resources: ['Trauma history form', 'Safe place exercise', 'Body scan protocol'],
      },
      {
        id: 'act-anxiety',
        name: 'ACT for Anxiety',
        description: 'Acceptance and Commitment Therapy for anxiety disorders',
        modality: 'ACT',
        target_condition: 'Anxiety',
        recommended_sessions: 12,
        evidence_level: 'Level II - Moderate Evidence',
        phases: [
          { phase: 1, name: 'Creative Hopelessness', sessions: '1-3' },
          { phase: 2, name: 'Defusion & Acceptance', sessions: '4-6' },
          { phase: 3, name: 'Values Clarification', sessions: '7-9' },
          { phase: 4, name: 'Committed Action', sessions: '10-12' },
        ],
        outcome_measures: ['GAD7', 'PHQ9'],
        resources: ['Values worksheet', 'Defusion techniques', 'Mindfulness exercises'],
      },
    ];
  }

  // ─── Treatment Plans ──────────────────────────────────────────────────────

  async getTreatmentPlan(patientId: string, orgId: string) {
    return this.db.queryOne<any>(
      `SELECT tp.*,
        t.display_name as therapist_name,
        p.first_name || ' ' || p.last_name as patient_name
       FROM treatment_plans tp
       LEFT JOIN therapists t ON t.id = tp.therapist_id
       LEFT JOIN patients p ON p.id = tp.patient_id
       WHERE tp.patient_id=$1 AND tp.organization_id=$2 AND tp.status='active'
       ORDER BY tp.created_at DESC LIMIT 1`,
      [patientId, orgId],
    ).catch(() => null);
  }

  async createTreatmentPlan(dto: {
    patient_id: string;
    therapist_id: string;
    organization_id: string;
    diagnoses: string[];
    goals: Array<{ description: string; target_date?: string; priority: 'high' | 'medium' | 'low' }>;
    interventions: string[];
    modality: string;
    frequency: string;
    estimated_sessions?: number;
    care_protocol_id?: string;
  }) {
    const id = uuidv4();

    const result = await this.db.query(
      `INSERT INTO treatment_plans (
        id, patient_id, therapist_id, organization_id,
        diagnoses, goals, interventions, modality, frequency,
        estimated_sessions, care_protocol_id, status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',NOW())
      RETURNING *`,
      [
        id, dto.patient_id, dto.therapist_id, dto.organization_id,
        JSON.stringify(dto.diagnoses),
        JSON.stringify(dto.goals),
        JSON.stringify(dto.interventions),
        dto.modality, dto.frequency,
        dto.estimated_sessions || null,
        dto.care_protocol_id || null,
      ],
    ).catch(() => [{ id, ...dto, status: 'active', created_at: new Date().toISOString() }]);

    return result[0];
  }

  async updateTreatmentPlan(planId: string, orgId: string, updates: any) {
    const fields: string[] = [];
    const params: any[] = [planId, orgId];
    const allowed = ['goals', 'interventions', 'diagnoses', 'modality', 'frequency', 'status', 'estimated_sessions'];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        params.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
        fields.push(`${key}=$${params.length}`);
      }
    }

    params.push(new Date().toISOString());
    fields.push(`updated_at=$${params.length}`);

    return this.db.queryOne<any>(
      `UPDATE treatment_plans SET ${fields.join(',')} WHERE id=$1 AND organization_id=$2 RETURNING *`,
      params,
    ).catch(() => null);
  }

  // ─── Homework (patient-visible tasks) ─────────────────────────────────────

  async createHomework(orgId: string, therapistId: string, dto: {
    patient_id: string; title: string; description?: string; category?: string;
    tool_slug?: string; due_date?: string; estimated_mins?: number;
    reflection_prompts?: string[];
  }) {
    const patient = await this.db.queryOne<any>(
      `SELECT id FROM patients WHERE id = $1 AND organization_id = $2`,
      [dto.patient_id, orgId],
    );
    if (!patient) throw new NotFoundException('Patient not found in your organization');

    const workflowId = uuidv4();
    await this.db.query(
      `INSERT INTO clinical_workflows (
        id, organization_id, therapist_id, patient_id,
        workflow_type, title, status, context, triggered_by, created_at
      ) VALUES ($1,$2,$3,$4,'homework',$5,'in_progress',$6,'therapist',NOW())`,
      [workflowId, orgId, therapistId, dto.patient_id, dto.title,
       JSON.stringify({ category: dto.category || 'exercises', tool_slug: dto.tool_slug || null })],
    );

    const taskId = uuidv4();
    const task = await this.db.queryOne<any>(
      `INSERT INTO workflow_tasks (
        id, workflow_id, organization_id, task_order, name, task_type,
        status, is_required, metadata, due_date, assigned_to_patient, created_at
      ) VALUES ($1,$2,$3,1,$4,'homework','pending',true,$5,$6,true,NOW())
      RETURNING *`,
      [taskId, workflowId, orgId, dto.title,
       JSON.stringify({
         description: dto.description || '',
         category: dto.category || 'exercises',
         tool_slug: dto.tool_slug || null,
         estimated_mins: dto.estimated_mins || 15,
         reflection_prompts: dto.reflection_prompts || [],
       }),
       dto.due_date || null],
    );
    return { workflow_id: workflowId, task };
  }

  async listPatientHomework(orgId: string, patientId: string) {
    const rows = await this.db.query<any>(
      `SELECT wt.*, w.title AS workflow_title, w.created_at AS assigned_date,
              t.display_name AS assigned_by
       FROM workflow_tasks wt
       JOIN clinical_workflows w ON w.id = wt.workflow_id
       LEFT JOIN therapists t ON t.id = w.therapist_id
       WHERE wt.organization_id = $1
         AND wt.assigned_to_patient = true
         AND w.workflow_type = 'homework'
         AND w.patient_id = $2
       ORDER BY wt.created_at DESC`,
      [orgId, patientId],
    );
    return rows.map((r: any) => {
      const meta = r.metadata || {};
      return {
        id: r.id,
        title: r.name,
        description: meta.description || '',
        category: meta.category || 'exercises',
        assigned_by: r.assigned_by || 'Your therapist',
        assigned_date: r.assigned_date,
        due_date: r.due_date,
        status: r.status === 'completed' ? 'completed' : 'pending',
        estimated_mins: meta.estimated_mins || 15,
        points: meta.points || 25,
        reflection_prompts: meta.reflection_prompts || [],
        completed_at: r.completed_at,
        completion_note: r.result?.note || null,
      };
    });
  }

  // Completes a task by id alone (patient portal call shape). Patients may
  // only complete their own homework; staff can complete any org task.
  async completeTaskById(taskId: string, orgId: string, user: { role: string; patientId?: string }, note?: string) {
    const task = await this.db.queryOne<any>(
      `SELECT wt.id, wt.workflow_id, w.patient_id
       FROM workflow_tasks wt
       JOIN clinical_workflows w ON w.id = wt.workflow_id
       WHERE wt.id = $1 AND wt.organization_id = $2`,
      [taskId, orgId],
    );
    if (!task) throw new NotFoundException('Task not found');
    if (user.role === 'patient' && task.patient_id !== user.patientId) {
      throw new NotFoundException('Task not found');
    }
    return this.completeWorkflowTask(taskId, task.workflow_id, orgId, { note: note || '' });
  }

  // ─── Workflow Analytics ───────────────────────────────────────────────────

  async getWorkflowAnalytics(orgId: string) {
    return this.db.queryOne<any>(
      `SELECT
        COUNT(*) as total_workflows,
        COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status='active' THEN 1 END) as active,
        COUNT(CASE WHEN status='pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status='error' THEN 1 END) as errors,
        AVG(CASE WHEN status='completed'
          THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600
        END) as avg_completion_hours
       FROM clinical_workflows WHERE organization_id=$1`,
      [orgId],
    ).catch(() => ({}));
  }
}
