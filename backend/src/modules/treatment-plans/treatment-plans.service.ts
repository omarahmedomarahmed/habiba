import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TreatmentPlansService {
  constructor(private readonly db: DatabaseService) {}

  async list(orgId: string, query: any = {}) {
    const { therapist_id, patient_id, status, page = 1, limit = 20 } = query;
    const params: any[] = [orgId];
    const where: string[] = ['tp.organization_id = $1'];
    if (therapist_id) { params.push(therapist_id); where.push(`tp.therapist_id = $${params.length}`); }
    if (patient_id) { params.push(patient_id); where.push(`tp.patient_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`tp.status = $${params.length}`); }
    params.push(limit, (page - 1) * limit);
    const rows = await this.db.query(
      `SELECT tp.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM treatment_plans tp LEFT JOIN patients p ON p.id = tp.patient_id
       WHERE ${where.join(' AND ')} ORDER BY tp.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ).catch(() => []);
    return rows;
  }

  async getProtocols() {
    return [
      { id: 'cbt', name: 'Cognitive Behavioral Therapy (CBT)', evidence: 'Level I', modality: 'CBT', sessions: 12, condition: 'Depression, Anxiety' },
      { id: 'dbt', name: 'Dialectical Behavior Therapy (DBT)', evidence: 'Level I', modality: 'DBT', sessions: 24, condition: 'BPD, Emotional Dysregulation' },
      { id: 'emdr', name: 'EMDR Therapy', evidence: 'Level I', modality: 'EMDR', sessions: 8, condition: 'PTSD, Trauma' },
      { id: 'act', name: 'Acceptance and Commitment Therapy (ACT)', evidence: 'Level I', modality: 'ACT', sessions: 12, condition: 'Anxiety, Depression, Chronic Pain' },
      { id: 'mbct', name: 'Mindfulness-Based Cognitive Therapy (MBCT)', evidence: 'Level I', modality: 'MBCT', sessions: 8, condition: 'Recurrent Depression' },
      { id: 'eft', name: 'Emotion-Focused Therapy (EFT)', evidence: 'Level II', modality: 'EFT', sessions: 16, condition: 'Couples, Attachment Issues' },
    ];
  }

  async getOne(id: string, orgId: string) {
    const plan = await this.db.queryOne(
      `SELECT tp.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM treatment_plans tp LEFT JOIN patients p ON p.id = tp.patient_id
       WHERE tp.id = $1 AND tp.organization_id = $2`,
      [id, orgId],
    ).catch(() => null);
    if (!plan) throw new NotFoundException('Treatment plan not found');
    return plan;
  }

  async create(orgId: string, therapistId: string, dto: any) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await this.db.query(
      `INSERT INTO treatment_plans
         (id, organization_id, patient_id, therapist_id, status, presenting_problem,
          primary_diagnosis, secondary_diagnoses, goals, interventions,
          therapeutic_approach, frequency, estimated_sessions, completed_sessions,
          start_date, review_date, clinical_notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id, orgId, dto.patient_id, therapistId,
        dto.status || 'active',
        dto.presenting_problem || '',
        dto.primary_diagnosis || '',
        JSON.stringify(dto.secondary_diagnoses || []),
        JSON.stringify(dto.goals || []),
        JSON.stringify(dto.interventions || []),
        dto.therapeutic_approach || 'CBT',
        dto.frequency || 'weekly',
        dto.estimated_sessions || 12,
        0,
        dto.start_date || now.split('T')[0],
        dto.review_date || null,
        dto.clinical_notes || '',
        now, now,
      ],
    ).catch(() => null);
    return this.getOne(id, orgId);
  }

  async update(id: string, orgId: string, dto: any) {
    const fields: string[] = [];
    const params: any[] = [];
    const allowedFields = ['status', 'presenting_problem', 'primary_diagnosis', 'secondary_diagnoses',
      'goals', 'interventions', 'therapeutic_approach', 'frequency', 'estimated_sessions',
      'completed_sessions', 'review_date', 'end_date', 'clinical_notes'];
    for (const field of allowedFields) {
      if (dto[field] !== undefined) {
        params.push(typeof dto[field] === 'object' ? JSON.stringify(dto[field]) : dto[field]);
        fields.push(`${field} = $${params.length}`);
      }
    }
    if (fields.length === 0) return this.getOne(id, orgId);
    params.push(new Date().toISOString(), id, orgId);
    await this.db.query(
      `UPDATE treatment_plans SET ${fields.join(', ')}, updated_at = $${params.length - 2}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}`,
      params,
    ).catch(() => null);
    return this.getOne(id, orgId);
  }

  async addGoal(planId: string, orgId: string, goal: any) {
    const plan = await this.getOne(planId, orgId);
    const goals = Array.isArray(plan.goals) ? plan.goals : [];
    const newGoal = { id: uuidv4(), ...goal, status: goal.status || 'not_started', progress: goal.progress || 0, created_at: new Date().toISOString() };
    goals.push(newGoal);
    await this.db.query(
      `UPDATE treatment_plans SET goals = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4`,
      [JSON.stringify(goals), new Date().toISOString(), planId, orgId],
    ).catch(() => null);
    return newGoal;
  }

  async getGoals(planId: string, orgId: string) {
    const plan = await this.getOne(planId, orgId);
    return Array.isArray(plan.goals) ? plan.goals : [];
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
