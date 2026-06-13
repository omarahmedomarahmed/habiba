import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../database/database.service";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";

interface NotificationPayload {
  userId: string;
  organizationId?: string;
  templateKey: string;
  channel: "email" | "sms" | "in_app" | "push";
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
  priority?: "low" | "normal" | "high" | "urgent";
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ============================================================
  // SEND NOTIFICATION
  // ============================================================

  async send(payload: NotificationPayload): Promise<string | null> {
    // Get template
    const template = await this.db.queryOne<{
      id: string;
      body_text: string;
      body_html?: string;
      subject?: string;
      variables: string[];
    }>(
      `SELECT * FROM notification_templates
       WHERE template_key = $1 AND channel = $2 AND is_active = TRUE`,
      [payload.templateKey, payload.channel]
    );

    if (!template) return null;

    // Check user preferences
    const prefs = await this.getUserPreferences(payload.userId);
    if (!this.isNotificationAllowed(payload, prefs)) return null;

    // Interpolate variables
    let body = template.body_text;
    let subject = template.subject || "";

    if (payload.variables) {
      for (const [key, value] of Object.entries(payload.variables)) {
        body = body.replace(new RegExp(`{{${key}}}`, "g"), value);
        subject = subject.replace(new RegExp(`{{${key}}}`, "g"), value);
      }
    }

    // Create notification record
    const notificationId = this.db.generateId();
    await this.db.execute(
      `INSERT INTO notifications (
        id, organization_id, user_id, template_key, channel, title, body,
        metadata, scheduled_for, priority, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
      [
        notificationId,
        payload.organizationId,
        payload.userId,
        payload.templateKey,
        payload.channel,
        subject || null,
        body,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
        payload.scheduledFor || new Date(),
        payload.priority || "normal",
      ]
    );

    // Enqueue for delivery
    await this.db.execute(
      `INSERT INTO notification_queue (notification_id, priority, next_attempt_at)
       VALUES ($1, $2, $3)`,
      [
        notificationId,
        this.getPriorityNumber(payload.priority || "normal"),
        payload.scheduledFor || new Date(),
      ]
    );

    // For in-app: emit real-time event immediately
    if (payload.channel === "in_app") {
      this.eventEmitter.emit("notification.created", {
        userId: payload.userId,
        notification: {
          id: notificationId,
          title: subject,
          body,
          channel: "in_app",
          metadata: payload.metadata,
        },
      });

      // Mark as delivered immediately for in-app
      await this.db.execute(
        `UPDATE notifications SET status = 'delivered', delivered = TRUE, delivered_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );
    }

    return notificationId;
  }

  // ============================================================
  // BATCH SEND
  // ============================================================

  async sendBatch(notifications: NotificationPayload[]): Promise<void> {
    await Promise.all(notifications.map((n) => this.send(n)));
  }

  // ============================================================
  // GET NOTIFICATIONS (for user)
  // ============================================================

  async getUserNotifications(
    userId: string,
    params: {
      limit?: number;
      offset?: number;
      unread_only?: boolean;
      // new-style params from controller
      page?: number;
      unreadOnly?: boolean;
      channel?: string;
    }
  ) {
    const limit = params.limit ?? 20;
    const page = params.page ?? 1;
    const offset = params.offset ?? (page - 1) * limit;
    const unread_only = params.unreadOnly ?? params.unread_only ?? false;
    const channel = params.channel ?? 'in_app';

    let whereExtra = "";
    if (unread_only) whereExtra = " AND read = FALSE";

    const [notifications, unreadCount, totalCount] = await Promise.all([
      this.db.query(
        `SELECT * FROM notifications
         WHERE user_id = $1 AND channel = $2 ${whereExtra}
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, channel, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications
         WHERE user_id = $1 AND channel = $2 AND read = FALSE`,
        [userId, channel]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications
         WHERE user_id = $1 AND channel = $2 ${whereExtra}`,
        [userId, channel]
      ),
    ]);

    return {
      notifications,
      data: notifications,
      total: parseInt(totalCount?.count || "0"),
      unreadCount: parseInt(unreadCount?.count || "0"),
      unread_count: parseInt(unreadCount?.count || "0"),
      page,
      limit,
    };
  }

  async markRead(notificationId: string, userId: string) {
    await this.db.execute(
      `UPDATE notifications SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
    return { success: true };
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = await this.db.query<{ id: string }>(
      `UPDATE notifications SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND read = FALSE
       RETURNING id`,
      [userId],
    );
    return rows.length;
  }

  // ============================================================
  // PREFERENCES
  // ============================================================

  async getUserPreferences(userId: string) {
    const prefs = await this.db.queryOne(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (!prefs) {
      // Create default preferences
      await this.db.execute(
        `INSERT INTO notification_preferences (id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [this.db.generateId(), userId]
      );
      return await this.db.queryOne(`SELECT * FROM notification_preferences WHERE user_id = $1`, [userId]);
    }

    return prefs;
  }

  async updatePreferences(userId: string, prefs: Record<string, unknown>) {
    const allowedKeys = [
      "email_enabled", "email_session_reminders", "email_report_ready",
      "email_assessment_due", "email_payment_events", "email_marketing",
      "email_radar_matches", "email_risk_alerts",
      "sms_enabled", "sms_session_reminders", "sms_radar_matches",
      "in_app_enabled", "push_enabled", "push_token",
      "quiet_hours_enabled", "quiet_start", "quiet_end", "timezone",
    ];

    const filteredPrefs = Object.fromEntries(
      Object.entries(prefs).filter(([k]) => allowedKeys.includes(k))
    );

    if (Object.keys(filteredPrefs).length === 0) return this.getUserPreferences(userId);

    const setClauses = Object.keys(filteredPrefs)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(", ");

    await this.db.execute(
      `UPDATE notification_preferences SET ${setClauses}, updated_at = NOW() WHERE user_id = $1`,
      [userId, ...Object.values(filteredPrefs)]
    );

    return this.getUserPreferences(userId);
  }

  // ============================================================
  // EVENT-DRIVEN NOTIFICATION HANDLERS
  // ============================================================

  @OnEvent("session.scheduled")
  async handleSessionScheduled(payload: {
    therapistId: string;
    patientId: string;
    sessionTime: Date;
    therapistName: string;
    patientName: string;
    sessionUrl: string;
  }) {
    // Notify patient
    await this.send({
      userId: payload.patientId,
      templateKey: "email.session_reminder_24h",
      channel: "email",
      variables: {
        patient_name: payload.patientName,
        therapist_name: payload.therapistName,
        session_time: payload.sessionTime.toLocaleString(),
        session_url: payload.sessionUrl,
        timezone: "UTC",
      },
      priority: "high",
    });

    // In-app for patient
    await this.send({
      userId: payload.patientId,
      templateKey: "in_app.session_reminder",
      channel: "in_app",
      variables: {
        therapist_name: payload.therapistName,
        session_time: payload.sessionTime.toLocaleString(),
      },
      metadata: { session_url: payload.sessionUrl },
    });
  }

  @OnEvent("ai.note_generated")
  async handleNoteGenerated(payload: {
    therapistId: string;
    patientName: string;
    noteType: string;
    noteId: string;
    noteUrl: string;
  }) {
    await this.send({
      userId: payload.therapistId,
      templateKey: "in_app.report_ready",
      channel: "in_app",
      variables: {
        patient_name: payload.patientName,
        note_type: payload.noteType,
      },
      metadata: { note_id: payload.noteId, note_url: payload.noteUrl },
      priority: "normal",
    });
  }

  @OnEvent("ai.risk_detected")
  async handleRiskDetected(payload: {
    therapistId: string;
    patientName: string;
    sessionId: string;
    riskLevel: string;
  }) {
    await this.send({
      userId: payload.therapistId,
      templateKey: "in_app.risk_alert",
      channel: "in_app",
      variables: {
        patient_name: payload.patientName,
        session_date: new Date().toLocaleDateString(),
      },
      metadata: { session_id: payload.sessionId, risk_level: payload.riskLevel },
      priority: "urgent",
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private isNotificationAllowed(
    payload: NotificationPayload,
    prefs: Record<string, unknown> | null
  ): boolean {
    if (!prefs) return true;

    if (payload.channel === "email" && !prefs.email_enabled) return false;
    if (payload.channel === "sms" && !prefs.sms_enabled) return false;
    if (payload.channel === "in_app" && !prefs.in_app_enabled) return false;
    if (payload.channel === "push" && !prefs.push_enabled) return false;

    return true;
  }

  private getPriorityNumber(priority: string): number {
    const map: Record<string, number> = { urgent: 1, high: 3, normal: 5, low: 8 };
    return map[priority] || 5;
  }

  // ============================================================
  // ADDITIONAL METHODS (used by controller)
  // ============================================================

  async getNotificationById(id: string, userId: string) {
    return this.db.queryOne(
      `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }

  async deleteNotification(id: string, userId: string) {
    await this.db.execute(
      `UPDATE notifications SET deleted_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL`,
      [userId],
    );
    return parseInt(row?.count || '0', 10);
  }

  async getUserPushDevices(userId: string) {
    return this.db.query(
      `SELECT id, platform, device_name, is_active, last_used_at, created_at
       FROM push_devices WHERE user_id = $1 AND is_active = TRUE ORDER BY last_used_at DESC`,
      [userId],
    );
  }

  async registerPushDevice(
    userId: string,
    body: { device_token: string; platform: string; device_name?: string },
  ) {
    return this.db.queryOne(
      `INSERT INTO push_devices (user_id, device_token, platform, device_name, is_active, created_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       ON CONFLICT (device_token) DO UPDATE
         SET is_active = TRUE, last_used_at = NOW(), device_name = EXCLUDED.device_name
       RETURNING id, platform, device_name, created_at`,
      [userId, body.device_token, body.platform, body.device_name || null],
    );
  }

  async removePushDevice(userId: string, token: string) {
    await this.db.execute(
      `UPDATE push_devices SET is_active = FALSE WHERE user_id = $1 AND device_token = $2`,
      [userId, token],
    );
  }

  async getConversations(
    userId: string,
    organizationId: string,
    opts: { page: number; limit: number },
  ) {
    const offset = (opts.page - 1) * opts.limit;
    return this.db.query(
      `SELECT c.id, c.subject, c.status, c.last_message_at,
              cp.unread_count,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       WHERE c.organization_id = $2
       ORDER BY c.last_message_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, organizationId, opts.limit, offset],
    );
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    opts: { page: number; limit: number; before?: string },
  ) {
    const offset = (opts.page - 1) * opts.limit;
    let query = `SELECT m.id, m.content, m.message_type, m.created_at, m.sender_id,
                        u.full_name AS sender_name
                 FROM messages m
                 JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = $1`;
    const params: any[] = [conversationId];
    let idx = 2;

    if (opts.before) {
      query += ` AND m.created_at < $${idx++}`;
      params.push(opts.before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(opts.limit, offset);

    return this.db.query(query, params);
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    body: { content: string; message_type?: string; metadata?: Record<string, unknown> },
  ) {
    const message = await this.db.queryOne(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, content, message_type, created_at`,
      [
        conversationId,
        senderId,
        body.content,
        body.message_type || 'text',
        body.metadata ? JSON.stringify(body.metadata) : null,
      ],
    );

    // Update conversation last_message_at
    await this.db.execute(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId],
    );

    // Emit event for real-time delivery
    this.eventEmitter.emit('message.sent', {
      conversationId,
      senderId,
      message,
    });

    return message;
  }

  async getQueueStatus(organizationId: string) {
    const stats = await this.db.queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'processing') AS processing,
         COUNT(*) FILTER (WHERE status = 'sent') AS sent_today,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed
       FROM notification_queue
       WHERE created_at > NOW() - INTERVAL '24 hours'`,
      [],
    );
    return stats;
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
