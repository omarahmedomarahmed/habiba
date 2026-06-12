import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { ListNotesQueryDto, CreateNoteDto, UpdateNoteDto } from './dto/notes.dto';

// Maps DB status values to the labels the portal uses (and back).
const STATUS_OUT: Record<string, string> = {
  approved: 'finalized',
  pending_review: 'needs_review',
};
const STATUS_IN: Record<string, string> = {
  finalized: 'approved',
  needs_review: 'pending_review',
};

// Presents any note format in the four-section shape the editor renders.
function toSections(format: string, structured: Record<string, any>): Record<string, string> {
  const s = structured || {};
  switch ((format || 'soap').toLowerCase()) {
    case 'dap':
      return { subjective: s.data || '', objective: '', assessment: s.assessment || '', plan: s.plan || '' };
    case 'birp':
      return { subjective: s.behavior || '', objective: s.intervention || '', assessment: s.response || '', plan: s.plan || '' };
    default:
      return {
        subjective: s.subjective || '',
        objective: s.objective || '',
        assessment: s.assessment || '',
        plan: s.plan || '',
      };
  }
}

function fromSections(format: string, sections: Record<string, string>): Record<string, string> {
  switch ((format || 'soap').toLowerCase()) {
    case 'dap':
      return { data: sections.subjective || '', assessment: sections.assessment || '', plan: sections.plan || '' };
    case 'birp':
      return {
        behavior: sections.subjective || '', intervention: sections.objective || '',
        response: sections.assessment || '', plan: sections.plan || '',
      };
    default:
      return {
        subjective: sections.subjective || '', objective: sections.objective || '',
        assessment: sections.assessment || '', plan: sections.plan || '',
      };
  }
}

function rawFromSections(sections: Record<string, string>): string {
  return Object.entries(sections)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k.toUpperCase()}:\n${v}`)
    .join('\n\n');
}

@Injectable()
export class NotesService {
  constructor(private readonly db: DatabaseService) {}

  private mapRow(row: any) {
    const wordCount = row.raw_content
      ? String(row.raw_content).trim().split(/\s+/).filter(Boolean).length
      : 0;
    return {
      id: row.id,
      session_id: row.session_id,
      patient_id: row.patient_id,
      patient_name: row.patient_name || 'Patient',
      therapist_name: row.therapist_name || '',
      session_date: row.session_date || row.created_at,
      session_number: row.session_number || 0,
      note_format: String(row.note_format || 'soap').toUpperCase(),
      status: STATUS_OUT[row.status] || row.status || 'draft',
      ai_generated: !!row.ai_model_used,
      created_at: row.created_at,
      finalized_at: row.approved_at || null,
      word_count: wordCount,
      risk_flag: false,
      preview: row.raw_content ? String(row.raw_content).slice(0, 160) : '',
      tags: [],
      version: row.version,
    };
  }

  async list(orgId: string, therapistId: string | null, query: ListNotesQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const params: any[] = [orgId];
    const where = [`n.organization_id = $1`, `n.status <> 'archived'`];

    if (therapistId) { params.push(therapistId); where.push(`n.therapist_id = $${params.length}`); }
    if (query.session_id) { params.push(query.session_id); where.push(`n.session_id = $${params.length}`); }
    if (query.patient_id) { params.push(query.patient_id); where.push(`n.patient_id = $${params.length}`); }
    if (query.status && STATUS_IN[query.status] !== undefined) {
      params.push(STATUS_IN[query.status]); where.push(`n.status = $${params.length}`);
    } else if (query.status && ['draft', 'pending_review', 'approved'].includes(query.status)) {
      params.push(query.status); where.push(`n.status = $${params.length}`);
    }
    if (query.format) {
      params.push(query.format.toLowerCase()); where.push(`n.note_format = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      where.push(`(p.first_name || ' ' || COALESCE(p.last_name, '') ILIKE $${params.length} OR n.raw_content ILIKE $${params.length})`);
    }

    const baseFrom = `
      FROM ai_session_notes n
      JOIN patients p ON p.id = n.patient_id
      JOIN sessions s ON s.id = n.session_id
      JOIN therapists t ON t.id = n.therapist_id
      WHERE ${where.join(' AND ')}`;

    const countRow = await this.db.queryOne<{ total: string }>(
      `SELECT COUNT(*) AS total ${baseFrom}`, params,
    );

    params.push(limit, (page - 1) * limit);
    const rows = await this.db.query(
      `SELECT n.*,
              p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
              t.display_name AS therapist_name,
              s.scheduled_at AS session_date,
              s.session_number
       ${baseFrom}
       ORDER BY n.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { data: rows.map((r: any) => this.mapRow(r)), total: parseInt(countRow?.total || '0', 10) };
  }

  async findOne(id: string, orgId: string) {
    const row = await this.db.queryOne<any>(
      `SELECT n.*,
              p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
              t.display_name AS therapist_name,
              s.scheduled_at AS session_date,
              s.session_number
       FROM ai_session_notes n
       JOIN patients p ON p.id = n.patient_id
       JOIN sessions s ON s.id = n.session_id
       JOIN therapists t ON t.id = n.therapist_id
       WHERE n.id = $1 AND n.organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Note not found');
    return {
      ...this.mapRow(row),
      content: { SOAP: toSections(row.note_format, row.structured_content) },
      ai_suggestions: [],
    };
  }

  async create(orgId: string, userId: string, dto: CreateNoteDto) {
    const session = await this.db.queryOne<any>(
      `SELECT id, patient_id, therapist_id FROM sessions WHERE id = $1 AND organization_id = $2`,
      [dto.session_id, orgId],
    );
    if (!session) throw new BadRequestException('Session not found in your organization');

    const format = (dto.note_format || 'soap').toLowerCase();
    const sections = (dto.content as any)?.SOAP || {};
    const structured = fromSections(format, sections);
    const raw = rawFromSections(structured);

    const row = await this.db.queryOne<any>(
      `INSERT INTO ai_session_notes (
         id, session_id, patient_id, therapist_id, organization_id,
         note_format, structured_content, raw_content, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft')
       RETURNING *`,
      [uuidv4(), session.id, session.patient_id, session.therapist_id, orgId, format, JSON.stringify(structured), raw],
    );
    return this.mapRow(row);
  }

  async update(id: string, orgId: string, dto: UpdateNoteDto) {
    const row = await this.db.queryOne<any>(
      `SELECT * FROM ai_session_notes WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Note not found');
    if (row.status === 'archived') throw new BadRequestException('Note is archived');

    const sections = (dto.content as any)?.SOAP;
    if (!sections) return this.mapRow(row);

    const merged = { ...toSections(row.note_format, row.structured_content), ...sections };
    const structured = fromSections(row.note_format, merged);
    const raw = rawFromSections(structured);

    const updated = await this.db.queryOne<any>(
      `UPDATE ai_session_notes
       SET structured_content = $3, raw_content = $4,
           therapist_edits = $5, version = version + 1, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, orgId, JSON.stringify(structured), raw, JSON.stringify(sections)],
    );
    return this.mapRow(updated);
  }

  async finalize(id: string, orgId: string, userId: string) {
    const updated = await this.db.queryOne<any>(
      `UPDATE ai_session_notes
       SET status = 'approved', approved_by = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND status <> 'archived'
       RETURNING *`,
      [id, orgId, userId],
    );
    if (!updated) throw new NotFoundException('Note not found');
    return this.mapRow(updated);
  }

  async archive(id: string, orgId: string) {
    const updated = await this.db.queryOne<any>(
      `UPDATE ai_session_notes
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, orgId],
    );
    if (!updated) throw new NotFoundException('Note not found');
    return { id: updated.id, archived: true };
  }
}
