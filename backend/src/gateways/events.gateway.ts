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
    origin: [
      process.env.THERAPIST_PORTAL_URL || "http://localhost:3001",
      process.env.PATIENT_PORTAL_URL || "http://localhost:3002",
      process.env.ADMIN_PORTAL_URL || "http://localhost:3003",
    ],
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

  constructor(private readonly jwtService: JwtService) {}

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

      const payload = this.jwtService.verify<{
        userId: string;
        organizationId: string;
        role: string;
        therapistId?: string;
      }>(token);

      client.userId = payload.userId;
      client.organizationId = payload.organizationId;
      client.role = payload.role;
      client.therapistId = payload.therapistId;

      // Join organization room
      client.join(`org:${payload.organizationId}`);

      // Join user-specific room
      client.join(`user:${payload.userId}`);

      // Track socket by userId
      if (!this.userSockets.has(payload.userId)) {
        this.userSockets.set(payload.userId, new Set());
      }
      this.userSockets.get(payload.userId)!.add(client.id);

      // If therapist, join therapist room for radar broadcasts
      if (payload.role === "therapist" || payload.role === "admin") {
        client.join(`therapists:${payload.organizationId}`);
      }

      this.logger.log(`Client connected: ${client.id} (user: ${payload.userId})`);

      // Send connection acknowledgment
      client.emit("connected", {
        message: "Connected to 24Therapy real-time services",
        userId: payload.userId,
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
  handleRiskAlert(payload: {
    sessionId: string;
    therapistId: string;
    patientId: string;
    orgId: string;
    riskLevel: string;
    riskType: string;
    indicators: string[];
    confidence: number;
    recommendedAction: string;
    timestamp: string;
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

    // Alert the therapist in the session
    this.server.to(`user:${payload.therapistId}`).emit("crisis_alert", alertPayload);

    // Alert all admins in the organization
    this.server.to(`org:${payload.orgId}`).emit("crisis_alert", {
      ...alertPayload,
      therapist_id: payload.therapistId,
    });

    this.logger.warn(
      `[CRISIS] risk_level=${payload.riskLevel} session=${payload.sessionId} org=${payload.orgId}`,
    );
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
