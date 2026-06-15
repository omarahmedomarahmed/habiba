import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface CreateRadarRequestDto {
  specialization?: string;
  presenting_issues?: string[];
  preferred_language?: string;
  urgency_level?: "immediate" | "today" | "this_week";
  session_type?: "video" | "audio" | "chat";
  budget_min?: number;
  budget_max?: number;
  therapist_gender_preference?: string;
  timezone?: string;
  patient_id?: string; // if existing patient
  notes?: string;
}

@Injectable()
export class RadarService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ============================================================
  // CREATE REQUEST (Patient initiates)
  // ============================================================

  async createRequest(
    userId: string,
    organizationId: string,
    dto: CreateRadarRequestDto
  ) {
    // Get or create patient
    let patientId = dto.patient_id;
    if (!patientId) {
      const patient = await this.db.queryOne<{ id: string }>(
        `SELECT p.id FROM patients p
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL`,
        [userId, organizationId]
      );
      patientId = patient?.id;
    }

    if (!patientId) {
      throw new BadRequestException("Patient record not found. Please complete registration first.");
    }

    // Expire any existing active requests from this patient
    await this.db.execute(
      `UPDATE radar_requests SET status = 'expired', expired_at = NOW()
       WHERE patient_id = $1 AND status IN ('active', 'matching')`,
      [patientId]
    );

    // Calculate expiry based on urgency
    const timeoutMinutes = dto.urgency_level === "immediate" ? 10 :
                           dto.urgency_level === "today" ? 60 : 1440;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    // Create the radar request
    const request = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO radar_requests (
        id, patient_id, organization_id, presenting_issues,
        preferred_language, urgency, preferred_session_type, budget_per_session,
        preferred_gender, timezone, notes, status, expires_at
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12
       ) RETURNING *`,
      [
        this.db.generateId(), patientId, organizationId,
        dto.presenting_issues || [],
        dto.preferred_language || "en",
        dto.urgency_level || "today",
        dto.session_type || "video",
        dto.budget_max ?? dto.budget_min ?? null,
        dto.therapist_gender_preference,
        dto.timezone || "UTC",
        dto.notes,
        expiresAt,
      ]
    );

    if (!request) throw new Error("Failed to create radar request");

    // Trigger matching algorithm
    await this.triggerMatching(request.id as string, organizationId);

    // Emit event for real-time notifications
    this.eventEmitter.emit("radar.request.created", {
      requestId: request.id,
      organizationId,
      specialization: dto.specialization,
      urgency: dto.urgency_level,
    });

    return request;
  }

  // ============================================================
  // MATCHING ALGORITHM
  // Calls the PostgreSQL calculate_radar_match_score() function
  // ============================================================

  async triggerMatching(requestId: string, organizationId: string) {
    // Get the request details
    const request = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM radar_requests WHERE id = $1`,
      [requestId]
    );

    if (!request) return;

    // Find eligible therapists using the SQL matching function
    const matches = await this.db.query<{
      therapist_id: string;
      match_score: number;
      match_reasons: string[];
    }>(
      `SELECT
         t.id AS therapist_id,
         calculate_radar_match_score(t.id, $1) AS match_score,
         ARRAY['specialization_match', 'availability'] AS match_reasons
       FROM therapists t
       JOIN radar_therapist_settings rts ON rts.therapist_id = t.id
       WHERE t.organization_id = $2
         AND t.deleted_at IS NULL
         AND t.verification_status = 'approved'
         AND rts.radar_available_now = TRUE
         AND rts.radar_enabled = TRUE
         AND calculate_radar_match_score(t.id, $1) > 50
       ORDER BY match_score DESC
       LIMIT 5`,
      [requestId, organizationId]
    );

    // Create broadcast entries
    if (matches.length > 0) {
      for (const match of matches) {
        await this.db.execute(
          `INSERT INTO radar_broadcasts (id, request_id, therapist_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [this.db.generateId(), requestId, match.therapist_id]
        );

        // Emit real-time event to therapist
        this.eventEmitter.emit("radar.broadcast.sent", {
          therapistId: match.therapist_id,
          requestId,
          matchScore: match.match_score,
        });
      }

      // Update request status
      await this.db.execute(
        `UPDATE radar_requests SET status = 'matching', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );
    }

    return matches;
  }

  // ============================================================
  // THERAPIST — Get pending radar requests
  // ============================================================

  async getTherapistRequests(therapistId: string) {
    return this.db.query(
      `SELECT
         rb.id AS broadcast_id,
         rr.id AS request_id,
         rr.presenting_issues,
         rr.preferred_language,
         rr.urgency,
         rr.preferred_session_type,
         rr.budget_per_session,
         rr.expires_at,
         EXTRACT(EPOCH FROM (rr.expires_at - NOW())) AS seconds_remaining
       FROM radar_broadcasts rb
       JOIN radar_requests rr ON rr.id = rb.request_id
       WHERE rb.therapist_id = $1
         AND rb.responded_at IS NULL
         AND rr.status IN ('active', 'matching')
         AND rr.expires_at > NOW()
       ORDER BY rr.urgency ASC`,
      [therapistId]
    );
  }

  // ============================================================
  // THERAPIST — Accept a request
  // ============================================================

  async acceptRequest(
    therapistId: string,
    requestId: string,
    organizationId: string
  ) {
    // Verify the broadcast exists for this therapist
    const broadcast = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM radar_broadcasts WHERE therapist_id = $1 AND request_id = $2 AND responded_at IS NULL`,
      [therapistId, requestId]
    );

    if (!broadcast) {
      throw new NotFoundException("Request not found or already handled");
    }

    // Get the radar request
    const request = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM radar_requests WHERE id = $1 AND status IN ('active', 'matching') AND expires_at > NOW()`,
      [requestId]
    );

    if (!request) {
      throw new BadRequestException("Request has expired or been filled");
    }

    // Create a session in the database
    const sessionId = this.db.generateId();
    const roomName = `radar-${sessionId.slice(0, 8)}`;

    await this.db.transaction(async (client) => {
      // Create session
      await client.query(
        `INSERT INTO sessions (
          id, organization_id, therapist_id, patient_id, scheduled_at, status,
          session_type, daily_room_name, is_radar_session
         ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes', 'waiting', $5, $6, TRUE)`,
        [
          sessionId, organizationId, therapistId, request.patient_id,
          request.preferred_session_type || "video", roomName,
        ]
      );

      // Update broadcast
      await client.query(
        `UPDATE radar_broadcasts SET response = 'accepted', responded_at = NOW() WHERE id = $1`,
        [broadcast.id]
      );

      // Update request status
      await client.query(
        `UPDATE radar_requests SET status = 'matched', matched_therapist_id = $2, matched_at = NOW()
         WHERE id = $1`,
        [requestId, therapistId]
      );

      // Mark other broadcasts for this request as declined
      await client.query(
        `UPDATE radar_broadcasts SET response = 'expired', responded_at = NOW()
         WHERE request_id = $1 AND therapist_id != $2 AND responded_at IS NULL`,
        [requestId, therapistId]
      );

      // Create radar_sessions record
      await client.query(
        `INSERT INTO radar_sessions (id, request_id, session_id, therapist_id, patient_id, match_score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          this.db.generateId(), requestId, sessionId,
          therapistId, request.patient_id,
          (broadcast as unknown as Record<string, unknown>).match_score || 0,
        ]
      );
    });

    // Emit events
    this.eventEmitter.emit("radar.request.accepted", {
      requestId,
      sessionId,
      therapistId,
      patientId: request.patient_id,
    });

    return {
      session_id: sessionId,
      room_name: roomName,
      message: "Session created. Patient has been notified.",
    };
  }

  // ============================================================
  // THERAPIST — Decline a request
  // ============================================================

  async declineRequest(therapistId: string, requestId: string, reason?: string) {
    await this.db.execute(
      `UPDATE radar_broadcasts SET response = 'declined', responded_at = NOW(), decline_reason = $3
       WHERE therapist_id = $1 AND request_id = $2`,
      [therapistId, requestId, reason || null]
    );

    return { success: true };
  }

  // ============================================================
  // GET REQUEST STATUS (patient side)
  // ============================================================

  async getRequestStatus(requestId: string, patientId: string) {
    const request = await this.db.queryOne<Record<string, unknown>>(
      `SELECT rr.*, rs.session_id,
              t.id AS therapist_id, u.first_name AS therapist_first_name,
              u.last_name AS therapist_last_name, u.avatar_url AS therapist_avatar
       FROM radar_requests rr
       LEFT JOIN radar_sessions rs ON rs.request_id = rr.id
       LEFT JOIN therapists t ON t.id = rs.therapist_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE rr.id = $1 AND rr.patient_id = $2`,
      [requestId, patientId]
    );

    if (!request) throw new NotFoundException("Request not found");

    return request;
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  async getRadarAnalytics(organizationId: string, period = "30d") {
    const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : 90;

    return this.db.queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${daysBack} days') AS total_requests,
         COUNT(*) FILTER (WHERE status = 'matched' AND created_at >= NOW() - INTERVAL '${daysBack} days') AS matched_requests,
         COUNT(*) FILTER (WHERE status = 'expired' AND created_at >= NOW() - INTERVAL '${daysBack} days') AS expired_requests,
         ROUND(
           COUNT(*) FILTER (WHERE status = 'matched')::DECIMAL /
           NULLIF(COUNT(*), 0) * 100, 1
         ) AS match_rate_pct,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (matched_at - created_at)) / 60)
           FILTER (WHERE matched_at IS NOT NULL), 1
         ) AS avg_match_time_minutes
       FROM radar_requests
       WHERE organization_id = $1`,
      [organizationId]
    );
  }

  // ============================================================
  // MARKET HEALTH (live view)
  // ============================================================

  async getMarketHealth(organizationId: string) {
    return this.db.queryOne(
      `SELECT * FROM radar_market_health WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
