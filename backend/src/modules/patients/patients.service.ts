import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PatientsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(orgId: string, query: any = {}) {
    const { search, status, therapist_id, limit = 20, cursor } = query;
    const params: any[] = [orgId];
    let whereClauses = ['p.organization_id = $1', 'p.deleted_at IS NULL'];

    if (status) {
      params.push(status);
      whereClauses.push(`p.status = $${params.length}`);
    }

    if (therapist_id) {
      params.push(therapist_id);
      whereClauses.push(`p.primary_therapist_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(p.first_name ILIKE $${params.length} OR p.last_name ILIKE $${params.length} OR p.email ILIKE $${params.length})`);
    }

    if (cursor) {
      params.push(cursor);
      whereClauses.push(`p.created_at < (SELECT created_at FROM patients WHERE id = $${params.length})`);
    }

    params.push(Math.min(Number(limit), 100));

    const sql = `
      SELECT
        p.*,
        t.display_name as primary_therapist_name,
        (SELECT COUNT(*) FROM sessions s WHERE s.patient_id = p.id AND s.status = 'completed') as completed_sessions,
        (SELECT MAX(score) FROM patient_mood_entries m WHERE m.patient_id = p.id ORDER BY recorded_at DESC LIMIT 1) as latest_mood
      FROM patients p
      LEFT JOIN therapists t ON t.id = p.primary_therapist_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT $${params.length}
    `;

    const patients = await this.db.query(sql, params);

    return {
      patients,
      has_more: patients.length === Number(limit),
      next_cursor: patients.length > 0 ? patients[patients.length - 1].id : null,
    };
  }

  async findByUserId(userId: string, orgId: string) {
    const patient = await this.db.queryOne<any>(
      `SELECT p.*,
              t.display_name AS primary_therapist_name,
              t.user_id      AS primary_therapist_user_id,
              tu.first_name || ' ' || tu.last_name AS primary_therapist_display_name,
              tu.phone AS primary_therapist_phone,
              t.id           AS primary_therapist_id
       FROM patients p
       LEFT JOIN therapists t  ON t.id = p.primary_therapist_id AND t.deleted_at IS NULL
       LEFT JOIN users      tu ON tu.id = t.user_id
       WHERE p.user_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL`,
      [userId, orgId],
    );
    if (!patient) throw new NotFoundException('Patient profile not found');
    return patient;
  }

  async findOne(id: string, orgId: string) {
    const patient = await this.db.queryOne(
      `SELECT p.*,
        pp.*,
        t.display_name as primary_therapist_name,
        t.user_id as primary_therapist_user_id
       FROM patients p
       LEFT JOIN patient_profiles pp ON pp.patient_id = p.id
       LEFT JOIN therapists t ON t.id = p.primary_therapist_id
       WHERE p.id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL`,
      [id, orgId],
    );

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Get recent sessions
    const recentSessions = await this.db.query(
      `SELECT s.id, s.scheduled_at, s.status, s.modality, s.duration_minutes,
        t.display_name as therapist_name
       FROM sessions s
       JOIN therapists t ON t.id = s.therapist_id
       WHERE s.patient_id = $1 AND s.organization_id = $2
       ORDER BY s.scheduled_at DESC LIMIT 5`,
      [id, orgId],
    );

    // Get active diagnoses
    const diagnoses = await this.db.query(
      `SELECT * FROM patient_diagnoses
       WHERE patient_id = $1 AND status = 'active'
       ORDER BY is_primary DESC, created_at DESC`,
      [id],
    );

    // Get active goals
    const goals = await this.db.query(
      `SELECT * FROM patient_goals
       WHERE patient_id = $1 AND status = 'active'
       ORDER BY priority DESC, created_at DESC LIMIT 10`,
      [id],
    );

    // Get current medications
    const medications = await this.db.query(
      `SELECT pm.*, m.name as medication_name, m.drug_class
       FROM patient_medications pm
       JOIN medications m ON m.id = pm.medication_id
       WHERE pm.patient_id = $1 AND pm.status = 'active'`,
      [id],
    );

    // Get risk assessments
    const riskAssessments = await this.db.query(
      `SELECT * FROM risk_assessments
       WHERE patient_id = $1 AND resolved_at IS NULL
       ORDER BY created_at DESC LIMIT 5`,
      [id],
    );

    return {
      ...patient,
      recent_sessions: recentSessions,
      diagnoses,
      goals,
      medications,
      risk_assessments: riskAssessments,
    };
  }

  async create(orgId: string, therapistId: string, dto: any) {
    return this.db.transaction(async (client) => {
      const patientId = uuidv4();

      const result = await client.query(
        `INSERT INTO patients (
          id, organization_id, primary_therapist_id,
          first_name, last_name, preferred_name, date_of_birth,
          gender, pronouns, email, phone, address,
          emergency_contact, status, anonymous_mode, source, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          patientId, orgId, therapistId,
          dto.first_name, dto.last_name || null, dto.preferred_name || null, dto.date_of_birth || null,
          dto.gender || null, dto.pronouns || null, dto.email || null, dto.phone || null,
          JSON.stringify(dto.address || {}),
          JSON.stringify(dto.emergency_contact || {}),
          dto.status || 'active', dto.anonymous_mode || false,
          dto.source || 'manual', dto.tags || [],
        ],
      );

      const patient = result.rows[0];

      // Create patient profile
      await client.query(
        `INSERT INTO patient_profiles (id, patient_id, occupation, relationship_status)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), patientId, dto.occupation || null, dto.relationship_status || null],
      );

      // Create therapist-patient assignment
      await client.query(
        `INSERT INTO therapist_patient_assignments (id, therapist_id, patient_id, organization_id, assigned_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (therapist_id, patient_id) DO NOTHING`,
        [uuidv4(), therapistId, patientId, orgId, therapistId],
      );

      // Log timeline event
      await client.query(
        `INSERT INTO patient_timeline_events (id, patient_id, organization_id, event_type, title, created_by)
         VALUES ($1, $2, $3, 'patient_created', 'Patient profile created', $4)`,
        [uuidv4(), patientId, orgId, therapistId],
      );

      return patient;
    });
  }

  async update(id: string, orgId: string, dto: any) {
    const patient = await this.findOne(id, orgId);

    const updateFields: string[] = [];
    const params: any[] = [];

    const allowedFields = [
      'first_name', 'last_name', 'preferred_name', 'date_of_birth',
      'gender', 'pronouns', 'email', 'phone', 'status', 'on_medication', 'tags', 'notes'
    ];

    allowedFields.forEach((field) => {
      if (dto[field] !== undefined) {
        params.push(dto[field]);
        updateFields.push(`${field} = $${params.length}`);
      }
    });

    if (updateFields.length === 0) return patient;

    params.push(id);
    params.push(orgId);

    const result = await this.db.query(
      `UPDATE patients SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING *`,
      params,
    );

    return result[0];
  }

  async softDelete(id: string, orgId: string) {
    await this.findOne(id, orgId);
    await this.db.execute(
      'UPDATE patients SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2',
      [id, orgId],
    );
    return { success: true };
  }

  async getTimeline(patientId: string, orgId: string, limit = 50) {
    await this.findOne(patientId, orgId); // Verify access
    return this.db.query(
      `SELECT * FROM patient_timeline_events
       WHERE patient_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [patientId, orgId, limit],
    );
  }

  async getMoodTrend(patientId: string, orgId: string, days = 30) {
    await this.findOne(patientId, orgId);
    return this.db.query(
      `SELECT * FROM patient_mood_entries
       WHERE patient_id = $1 AND organization_id = $2
         AND recorded_at > NOW() - ($3 || ' days')::INTERVAL
       ORDER BY recorded_at ASC`,
      [patientId, orgId, days],
    );
  }

  async addMoodEntry(patientId: string, orgId: string, dto: any) {
    await this.findOne(patientId, orgId);
    const result = await this.db.query(
      `INSERT INTO patient_mood_entries (id, patient_id, organization_id, score, emotions, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [uuidv4(), patientId, orgId, dto.score, dto.emotions || [], dto.notes || null, dto.source || 'manual'],
    );
    return result[0];
  }

  async getAssessments(patientId: string, orgId: string) {
    await this.findOne(patientId, orgId);
    return this.db.query(
      `SELECT ar.*, at.name as template_name, at.code as template_code
       FROM assessment_results ar
       JOIN assessment_templates at ON at.id = ar.template_id
       WHERE ar.patient_id = $1 AND ar.organization_id = $2
       ORDER BY ar.created_at DESC`,
      [patientId, orgId],
    );
  }

  async getMemories(patientId: string, orgId: string) {
    await this.findOne(patientId, orgId);
    return this.db.query(
      `SELECT * FROM patient_memory
       WHERE patient_id = $1 AND organization_id = $2 AND status = 'active'
       ORDER BY created_at DESC LIMIT 50`,
      [patientId, orgId],
    );
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
