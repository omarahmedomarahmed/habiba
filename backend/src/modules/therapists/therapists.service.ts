import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { MailService } from "../mail/mail.service";

@Injectable()
export class TherapistsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  // ============================================================
  // PROFILE
  // ============================================================

  async getMyProfile(userId: string, organizationId: string) {
    const therapist = await this.db.queryOne<Record<string, unknown>>(
      `SELECT t.*, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.role
       FROM therapists t
       JOIN users u ON u.id = t.user_id
       WHERE t.user_id = $1 AND t.organization_id = $2 AND t.deleted_at IS NULL`,
      [userId, organizationId]
    );

    if (!therapist) throw new NotFoundException("Therapist profile not found");

    // Fetch credentials
    const credentials = await this.db.query(
      `SELECT * FROM therapist_credentials WHERE therapist_id = $1 ORDER BY created_at DESC`,
      [therapist.id]
    );

    // Fetch specializations from junction table (back-filled from TEXT[] in migration 016)
    const specializations = await this.db.query(
      `SELECT specialization FROM therapist_specializations WHERE therapist_id = $1 ORDER BY specialization`,
      [therapist.id]
    );

    // Stats
    const stats = await this.db.queryOne<Record<string, unknown>>(
      `SELECT
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') AS total_sessions,
         COUNT(DISTINCT p.id) FILTER (WHERE tpa.ended_at IS NULL) AS active_patients,
         AVG(s.duration_minutes) FILTER (WHERE s.status = 'completed') AS avg_session_duration
       FROM therapists t
       LEFT JOIN sessions s ON s.therapist_id = t.id
       LEFT JOIN therapist_patient_assignments tpa ON tpa.therapist_id = t.id
       LEFT JOIN patients p ON p.id = tpa.patient_id
       WHERE t.id = $1`,
      [therapist.id]
    );

    return {
      ...therapist,
      credentials,
      specializations,
      stats,
    };
  }

  async updateProfile(userId: string, organizationId: string, data: Record<string, unknown>) {
    const therapist = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM therapists WHERE user_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [userId, organizationId]
    );

    if (!therapist) throw new NotFoundException("Therapist profile not found");

    // Update therapist fields
    const therapistFields: Record<string, unknown> = {};
    const userFields: Record<string, unknown> = {};

    const therapistKeys = ["bio", "specializations_text", "years_experience", "license_number", "license_state", "title", "accepting_new_patients"];
    const userKeys = ["first_name", "last_name", "phone", "avatar_url"];

    for (const [key, value] of Object.entries(data)) {
      if (therapistKeys.includes(key)) therapistFields[key] = value;
      if (userKeys.includes(key)) userFields[key] = value;
    }

    if (Object.keys(therapistFields).length > 0) {
      const setClauses = Object.keys(therapistFields)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(", ");
      await this.db.execute(
        `UPDATE therapists SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
        [therapist.id, ...Object.values(therapistFields)]
      );
    }

    if (Object.keys(userFields).length > 0) {
      const setClauses = Object.keys(userFields)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(", ");
      await this.db.execute(
        `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
        [userId, ...Object.values(userFields)]
      );
    }

    return this.getMyProfile(userId, organizationId);
  }

  // ============================================================
  // BOOKING SLUG
  // ============================================================

  async updatePublicSlug(userId: string, organizationId: string, slug: string): Promise<void> {
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      throw new BadRequestException('Slug must be 3-50 characters: lowercase letters, numbers, and hyphens only');
    }

    const therapist = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM therapists WHERE user_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [userId, organizationId],
    );
    if (!therapist) throw new NotFoundException('Therapist profile not found');

    try {
      await this.db.execute(
        `UPDATE therapists SET public_slug = $1, updated_at = NOW() WHERE id = $2`,
        [slug, therapist.id],
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('This booking URL is already taken');
      }
      throw err;
    }
  }

  // ============================================================
  // AVAILABILITY
  // ============================================================

  async getAvailability(therapistId: string) {
    const availability = await this.db.query(
      `SELECT * FROM therapist_availability WHERE therapist_id = $1 ORDER BY day_of_week, start_time`,
      [therapistId]
    );

    const exceptions = await this.db.query(
      `SELECT * FROM therapist_availability_exceptions
       WHERE therapist_id = $1 AND date >= CURRENT_DATE
       ORDER BY date ASC`,
      [therapistId]
    );

    return { availability, exceptions };
  }

  async updateAvailability(therapistId: string, slots: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
    session_types?: string[];
  }>) {
    await this.db.transaction(async (client) => {
      // Delete existing availability
      await client.query(
        `DELETE FROM therapist_availability WHERE therapist_id = $1`,
        [therapistId]
      );

      // Insert new slots
      for (const slot of slots) {
        await client.query(
          `INSERT INTO therapist_availability (therapist_id, day_of_week, start_time, end_time, is_available)
           VALUES ($1, $2, $3, $4, $5)`,
          [therapistId, slot.day_of_week, slot.start_time, slot.end_time, slot.is_available]
        );
      }
    });

    return this.getAvailability(therapistId);
  }

  // ============================================================
  // DASHBOARD STATS
  // ============================================================

  async getDashboardStats(userId: string, organizationId: string) {
    const therapist = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM therapists WHERE user_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [userId, organizationId]
    );

    if (!therapist) throw new NotFoundException("Therapist not found");

    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

    const [sessionsToday, sessionsMonth, activePatients, pendingNotes, riskAlerts] = await Promise.all([
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM sessions
         WHERE therapist_id = $1 AND DATE(scheduled_at) = $2 AND status != 'cancelled'`,
        [therapist.id, today]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM sessions
         WHERE therapist_id = $1 AND scheduled_at >= $2 AND status = 'completed'`,
        [therapist.id, monthStart]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(DISTINCT p.id) as count FROM patients p
         JOIN therapist_patient_assignments tpa ON tpa.patient_id = p.id
         WHERE tpa.therapist_id = $1 AND tpa.deleted_at IS NULL AND tpa.is_primary = TRUE AND p.deleted_at IS NULL`,
        [therapist.id]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM ai_session_notes n
         JOIN sessions s ON s.id = n.session_id
         WHERE s.therapist_id = $1 AND n.status IN ('generated', 'edited')`,
        [therapist.id]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM risk_assessments ra
         JOIN patients p ON p.id = ra.patient_id
         JOIN therapist_patient_assignments tpa ON tpa.patient_id = p.id
         WHERE tpa.therapist_id = $1 AND ra.risk_level IN ('high', 'critical') AND ra.is_active = TRUE`,
        [therapist.id]
      ),
    ]);

    // Revenue this month
    const revenue = await this.db.queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(sf.amount), 0) as total FROM session_fees sf
       JOIN sessions s ON s.id = sf.session_id
       WHERE s.therapist_id = $1 AND sf.created_at >= $2 AND sf.status = 'paid'`,
      [therapist.id, monthStart]
    );

    return {
      sessions_today: parseInt(sessionsToday?.count || "0"),
      sessions_this_month: parseInt(sessionsMonth?.count || "0"),
      active_patients: parseInt(activePatients?.count || "0"),
      pending_notes: parseInt(pendingNotes?.count || "0"),
      risk_alerts: parseInt(riskAlerts?.count || "0"),
      revenue_this_month: parseFloat(revenue?.total || "0"),
    };
  }

  // ============================================================
  // FIND ALL (for admin and practice)
  // ============================================================

  async findAll(
    organizationId: string,
    params: { search?: string; status?: string; limit?: number; offset?: number }
  ) {
    const { search, status, limit = 20, offset = 0 } = params;

    let whereClause = `WHERE t.organization_id = $1 AND t.deleted_at IS NULL`;
    const queryParams: unknown[] = [organizationId];

    if (status) {
      queryParams.push(status);
      whereClause += ` AND t.status = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (u.first_name ILIKE $${queryParams.length} OR u.last_name ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length})`;
    }

    const total = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM therapists t JOIN users u ON u.id = t.user_id ${whereClause}`,
      queryParams
    );

    queryParams.push(limit, offset);
    const data = await this.db.query(
      `SELECT t.*, u.first_name, u.last_name, u.email, u.avatar_url,
              (SELECT COUNT(*) FROM therapist_patient_assignments tpa WHERE tpa.therapist_id = t.id AND tpa.deleted_at IS NULL) AS patient_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.therapist_id = t.id AND s.status = 'completed') AS session_count
       FROM therapists t
       JOIN users u ON u.id = t.user_id
       ${whereClause}
       ORDER BY u.last_name, u.first_name
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    return {
      data,
      total: parseInt(total?.count || "0"),
      limit,
      offset,
    };
  }

  // ============================================================
  // RADAR SETTINGS
  // ============================================================

  async getRadarSettings(therapistId: string) {
    return this.db.queryOne(
      `SELECT * FROM radar_therapist_settings WHERE therapist_id = $1`,
      [therapistId]
    );
  }

  async updateRadarSettings(therapistId: string, settings: Record<string, unknown>) {
    const ALLOWED_KEYS = [
      'is_available_now', 'accepts_radar', 'max_sessions_day',
      'max_response_time_minutes', 'preferred_urgency_levels',
      'preferred_specializations', 'radar_bio', 'session_rate_usd',
    ];
    const filtered = Object.fromEntries(
      Object.entries(settings).filter(([k]) => ALLOWED_KEYS.includes(k)),
    );
    if (Object.keys(filtered).length === 0) return this.getRadarSettings(therapistId);

    const existing = await this.getRadarSettings(therapistId);

    if (existing) {
      const setClauses = Object.keys(filtered)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(', ');
      await this.db.execute(
        `UPDATE radar_therapist_settings SET ${setClauses}, updated_at = NOW() WHERE therapist_id = $1`,
        [therapistId, ...Object.values(filtered)],
      );
    } else {
      const keys = ['therapist_id', ...Object.keys(filtered)];
      const values = [therapistId, ...Object.values(filtered)];
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      await this.db.execute(
        `INSERT INTO radar_therapist_settings (${keys.join(', ')}) VALUES (${placeholders})`,
        values,
      );
    }

    return this.getRadarSettings(therapistId);
  }

  // ============================================================
  // VERIFICATION / APPROVAL (admin)
  // ============================================================

  async approveTherapist(therapistId: string, adminUserId: string): Promise<void> {
    await this.db.execute(
      `UPDATE therapists SET verification_status = 'approved', verified_by = $2, verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [therapistId, adminUserId],
    );
    const t = await this.db.queryOne<{ email: string; display_name: string }>(
      `SELECT u.email, COALESCE(t.display_name, u.first_name) AS display_name
       FROM therapists t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
      [therapistId],
    );
    if (t) await this.mail.sendTherapistApproved(t.email, t.display_name);
  }

  async rejectTherapist(therapistId: string, adminUserId: string, reason: string): Promise<void> {
    await this.db.execute(
      `UPDATE therapists SET verification_status = 'rejected', verified_by = $2, verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [therapistId, adminUserId],
    );
    const t = await this.db.queryOne<{ email: string; display_name: string }>(
      `SELECT u.email, COALESCE(t.display_name, u.first_name) AS display_name
       FROM therapists t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
      [therapistId],
    );
    if (t) await this.mail.sendTherapistRejected(t.email, t.display_name, reason);
  }

  async submitForReview(therapistId: string): Promise<void> {
    if (!therapistId) throw new NotFoundException("Therapist profile not found");
    // Only transition pending → under_review
    await this.db.execute(
      `UPDATE therapists SET verification_status = 'under_review', updated_at = NOW()
       WHERE id = $1 AND verification_status = 'pending'`,
      [therapistId],
    );
  }

  // ============================================================
  // BANK DETAILS / PAYOUTS
  // ============================================================

  async updateBankDetails(
    therapistId: string,
    payoutMethod: 'ach' | 'wire' | 'swift',
    bankDetails: Record<string, unknown>,
  ): Promise<void> {
    if (!therapistId) throw new NotFoundException("Therapist profile not found");
    if (!['ach', 'wire', 'swift'].includes(payoutMethod)) {
      throw new BadRequestException("Invalid payout method");
    }
    await this.db.execute(
      `UPDATE therapists SET payout_method = $2, bank_details = $3, updated_at = NOW() WHERE id = $1`,
      [therapistId, payoutMethod, JSON.stringify(bankDetails ?? {})],
    );
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
