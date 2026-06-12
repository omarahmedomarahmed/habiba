import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import { Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { buildCorsOriginFn } from "../config/cors";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  therapistId?: string;
  role?: string;
}

/**
 * 24Therapy WebSocket Event Gateway
 *
 * Handles real-time events for:
 * - Session transcription streaming
 * - AI Copilot suggestions (live during session)
 * - Radar request broadcasts to therapists
 * - Notification delivery
 * - Session room participants
 */
@WebSocketGateway({
  cors: {
    origin: buildCorsOriginFn(process.env.NODE_ENV === "production"),
    credentials: true,
  },
  namespace: "/ws",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  // Map: userId → socketId(s)
  private readonly userSockets = new Map<string, Set<string>>();
  // Map: sessionId → socketId(s)
  private readonly sessionRooms = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  // ============================================================
  // CONNECTION LIFECYCLE
  // ============================================================

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        client.disconnect();
        return;
      }

      // Tokens are signed {sub, org, role} — map to named fields
      const payload = this.jwtService.verify<{
        sub: string;
        org: string;
        role: string;
      }>(token);

      const userId = payload.sub;
      const organizationId = payload.org;

      client.userId = userId;
      client.organizationId = organizationId;
      client.role = payload.role;

      // Look up therapist profile id so handleRiskAlert can map it to a user room
      if (payload.role === "therapist") {
        const row = await this.db.queryOne<{ id: string }>(
          'SELECT id FROM therapists WHERE user_id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1',
          [userId, organizationId],
        );
        client.therapistId = row?.id;
      }

      // Join user-specific room
      client.join(`user:${userId}`);

      // Staff-only room — receives crisis_alert and other clinical events.
      // Patients must NOT join this room (PHI isolation invariant).
      const isStaff = ["therapist", "admin", "super_admin"].includes(payload.role);
      if (isStaff) {
        client.join(`staff:${organizationId}`);
      }

      // Org-wide room for non-clinical broadcasts (e.g. system announcements).
      // Crisis alerts are NOT emitted here — use staff: room instead.
      client.join(`org:${organizationId}`);

      // Track socket by userId
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // If therapist, join therapist room for radar broadcasts
      if (payload.role === "therapist" || payload.role === "admin") {
        client.join(`therapists:${organizationId}`);
      }

      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);

      // Send connection acknowledgment
      client.emit("connected", {
        message: "Connected to 24Therapy real-time services",
        userId,
      });
    } catch (error) {
      this.logger.error("Authentication failed for WebSocket connection", error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      sockets?.delete(client.id);
      if (sockets?.size === 0) this.userSockets.delete(client.userId);
    }

    // Remove from session rooms
    for (const [sessionId, socketIds] of this.sessionRooms.entries()) {
      socketIds.delete(client.id);
      if (socketIds.size === 0) this.sessionRooms.delete(sessionId);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ============================================================
  // SESSION ROOM MANAGEMENT
  // ============================================================

  @SubscribeMessage("join_session")
  handleJoinSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string }
  ) {
    const { session_id } = data;
    client.join(`session:${session_id}`);

    if (!this.sessionRooms.has(session_id)) {
      this.sessionRooms.set(session_id, new Set());
    }
    this.sessionRooms.get(session_id)!.add(client.id);

    // Notify others in session
    client.to(`session:${session_id}`).emit("participant_joined", {
      userId: client.userId,
      role: client.role,
    });

    this.logger.log(`User ${client.userId} joined session ${session_id}`);
  }

  @SubscribeMessage("leave_session")
  handleLeaveSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string }
  ) {
    client.leave(`session:${data.session_id}`);
    client.to(`session:${data.session_id}`).emit("participant_left", {
      userId: client.userId,
    });
  }

  // ============================================================
  // TRANSCRIPT STREAMING
  // ============================================================

  @SubscribeMessage("transcript_segment")
  handleTranscriptSegment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      session_id: string;
      segment: {
        speaker: string;
        text: string;
        timestamp: number;
        is_final: boolean;
      };
    }
  ) {
    // Broadcast segment to session room (both therapist and patient see transcript)
    this.server.to(`session:${data.session_id}`).emit("transcript_update", {
      session_id: data.session_id,
      segment: data.segment,
    });
  }

  // ============================================================
  // COPILOT SUGGESTION STREAMING
  // ============================================================

  @SubscribeMessage("request_copilot")
  async handleCopilotRequest(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string; context?: string }
  ) {
    // Acknowledge receipt
    client.emit("copilot_processing", { session_id: data.session_id });
    // AI service will emit back via the event bus
  }

  // Broadcast copilot suggestion to specific therapist
  sendCopilotSuggestion(therapistId: string, sessionId: string, suggestion: {
    type: string;
    content: string;
    priority: string;
    source?: string;
  }) {
    this.server.to(`user:${therapistId}`).emit("copilot_suggestion", {
      session_id: sessionId,
      suggestion,
    });
  }

  // ============================================================
  // RADAR BROADCASTS
  // ============================================================

  @OnEvent("radar.broadcast.sent")
  handleRadarBroadcast(payload: {
    therapistId: string;
    requestId: string;
    matchScore: number;
  }) {
    this.server.to(`user:${payload.therapistId}`).emit("radar_request", {
      request_id: payload.requestId,
      match_score: payload.matchScore,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Radar broadcast sent to therapist ${payload.therapistId}`);
  }

  @OnEvent("radar.request.accepted")
  handleRadarAccepted(payload: {
    requestId: string;
    sessionId: string;
    therapistId: string;
    patientId: string;
  }) {
    // Notify patient
    this.server.to(`user:${payload.patientId}`).emit("radar_matched", {
      request_id: payload.requestId,
      session_id: payload.sessionId,
      message: "A therapist has accepted your request! Your session is ready.",
    });

    // Notify therapist
    this.server.to(`user:${payload.therapistId}`).emit("radar_session_ready", {
      session_id: payload.sessionId,
    });
  }

  // ============================================================
  // DIRECT MESSAGES
  // ============================================================

  @OnEvent("message.sent")
  handleMessageSent(payload: {
    conversationId: string;
    messageId: string;
    senderUserId: string;
    recipientUserId: string;
    orgId: string;
  }) {
    // Deliver only to the recipient — sender uses optimistic UI
    this.server.to(`user:${payload.recipientUserId}`).emit("new_message", {
      conversation_id: payload.conversationId,
      message_id: payload.messageId,
      sender_id: payload.senderUserId,
    });
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  @OnEvent("notification.created")
  handleNotification(payload: {
    userId: string;
    notification: {
      id: string;
      title?: string;
      body: string;
      channel: string;
      action_url?: string;
    };
  }) {
    this.server.to(`user:${payload.userId}`).emit("notification", payload.notification);
  }

  // ============================================================
  // RISK ALERTS
  // ============================================================

  @OnEvent("ai.risk_detected")
  async handleRiskAlert(payload: {
    sessionId: string;
    therapistId: string;    // therapists table PK
    patientId: string;
    orgId: string;
    riskLevel: string;
    riskType: string;
    indicators: string[];
    confidence: number;
    recommendedAction: string;
    timestamp: string;
    therapistUserId?: string;  // populated by crisis module (P2); fallback: DB lookup
  }) {
    const alertPayload = {
      session_id: payload.sessionId,
      patient_id: payload.patientId,
      risk_level: payload.riskLevel,
      risk_type: payload.riskType,
      indicators: payload.indicators,
      confidence: payload.confidence,
      recommended_action: payload.recommendedAction,
      timestamp: payload.timestamp,
    };

    // Resolve therapist's user_id (the crisis module will supply therapistUserId in P2;
    // fall back to a DB lookup so alerts work before that module exists)
    let therapistUserId = payload.therapistUserId;
    if (!therapistUserId) {
      const row = await this.db.queryOne<{ user_id: string }>(
        'SELECT user_id FROM therapists WHERE id = $1 LIMIT 1',
        [payload.therapistId],
      );
      therapistUserId = row?.user_id || payload.therapistId;
    }

    // Alert the therapist directly via their user room
    this.server.to(`user:${therapistUserId}`).emit("crisis_alert", alertPayload);

    // Alert all staff (admins) in the organization.
    // Uses staff: room — patients are never in this room (PHI isolation invariant).
    this.server.to(`staff:${payload.orgId}`).emit("crisis_alert", {
      ...alertPayload,
      therapist_id: payload.therapistId,
      therapist_user_id: therapistUserId,
    });

    this.logger.warn(
      `[CRISIS] risk_level=${payload.riskLevel} session=${payload.sessionId} org=${payload.orgId}`,
    );
  }

  @OnEvent("crisis.support")
  handleCrisisSupport(payload: {
    patientUserId: string;
    conversationId: string | null;
    message: string;
  }) {
    // Patients receive supportive handoff only — no risk levels or clinical indicators
    this.server.to(`user:${payload.patientUserId}`).emit("crisis_support", {
      conversation_id: payload.conversationId,
      message: payload.message,
    });
  }

  @OnEvent("ai.emotional_context")
  handleEmotionalContext(payload: {
    sessionId: string;
    patientId: string;
    orgId: string;
    emotion: string;
    intensity: string;
    minimizingLanguage: boolean;
    trajectory: string;
    clinicalNote: string;
    interventionSuggestion: string;
    timestamp: string;
  }) {
    // Emit only to the session room — therapist sees this in their copilot panel
    this.server.to(`session:${payload.sessionId}`).emit("emotional_context", {
      emotion: payload.emotion,
      intensity: payload.intensity,
      minimizing_language: payload.minimizingLanguage,
      trajectory: payload.trajectory,
      clinical_note: payload.clinicalNote,
      intervention_suggestion: payload.interventionSuggestion,
      timestamp: payload.timestamp,
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  // Emit to all users in an organization
  emitToOrg(organizationId: string, event: string, data: unknown) {
    this.server.to(`org:${organizationId}`).emit(event, data);
  }

  // Emit to a specific user
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Emit to a session room
  emitToSession(sessionId: string, event: string, data: unknown) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  // Get active user count
  getActiveUsersCount(): number {
    return this.userSockets.size;
  }
}
