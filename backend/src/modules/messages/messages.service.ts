import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { CreateConversationDto, SendMessageDto, ListMessagesQueryDto } from './dto/messages.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listConversations(userId: string, orgId: string) {
    const rows = await this.db.query<any>(
      `SELECT
         c.id, c.type, c.status, c.priority, c.last_message_at, c.created_at,
         c.patient_id, c.therapist_id,
         -- patient side
         pu.id   AS patient_user_id,
         pu.first_name || ' ' || pu.last_name AS patient_name,
         -- therapist side
         tu.id   AS therapist_user_id,
         tu.first_name || ' ' || tu.last_name AS therapist_name,
         -- last message preview
         lm.content AS last_message,
         -- unread count for this user
         (SELECT COUNT(*) FROM messages m2
          WHERE m2.conversation_id = c.id
            AND m2.read = false
            AND m2.sender_id <> $1) AS unread_count
       FROM conversations c
       JOIN patients   pt ON pt.id = c.patient_id
       JOIN therapists th ON th.id = c.therapist_id
       JOIN users pu ON pu.id = pt.user_id
       JOIN users tu ON tu.id = th.user_id
       LEFT JOIN LATERAL (
         SELECT content FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE c.organization_id = $2
         AND (pt.user_id = $1 OR th.user_id = $1)
         AND c.status = 'active'
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId, orgId],
    );

    return rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      priority: r.priority,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      unread_count: Number(r.unread_count),
      patient_id: r.patient_id,
      therapist_id: r.therapist_id,
      // name shown to the current user = the other participant
      name: r.patient_user_id === userId ? r.therapist_name : r.patient_name,
    }));
  }

  async createOrGetConversation(userId: string, orgId: string, dto: CreateConversationDto) {
    const { participant_id } = dto;

    // Look up both participants' therapist/patient profile IDs
    const [currentUser, otherUser] = await Promise.all([
      this.db.queryOne<any>(
        `SELECT u.id, u.role,
                t.id AS therapist_profile_id,
                p.id AS patient_profile_id
         FROM users u
         LEFT JOIN therapists t ON t.user_id = u.id AND t.organization_id = $2
         LEFT JOIN patients   p ON p.user_id = u.id AND p.organization_id = $2
         WHERE u.id = $1 AND u.organization_id = $2`,
        [userId, orgId],
      ),
      this.db.queryOne<any>(
        `SELECT u.id, u.role,
                t.id AS therapist_profile_id,
                p.id AS patient_profile_id
         FROM users u
         LEFT JOIN therapists t ON t.user_id = u.id AND t.organization_id = $2
         LEFT JOIN patients   p ON p.user_id = u.id AND p.organization_id = $2
         WHERE u.id = $1 AND u.organization_id = $2`,
        [participant_id, orgId],
      ),
    ]);

    if (!currentUser || !otherUser) {
      throw new NotFoundException('One or both participants not found in this organization');
    }

    // Determine patient and therapist sides
    let patientProfileId: string;
    let therapistProfileId: string;

    if (currentUser.patient_profile_id && otherUser.therapist_profile_id) {
      patientProfileId = currentUser.patient_profile_id;
      therapistProfileId = otherUser.therapist_profile_id;
    } else if (currentUser.therapist_profile_id && otherUser.patient_profile_id) {
      therapistProfileId = currentUser.therapist_profile_id;
      patientProfileId = otherUser.patient_profile_id;
    } else {
      throw new BadRequestException('Conversations require one patient and one therapist');
    }

    // Upsert via partial unique index
    const conversation = await this.db.queryOne<any>(
      `INSERT INTO conversations
         (id, organization_id, type, patient_id, therapist_id, status)
       VALUES ($1, $2, 'patient_therapist', $3, $4, 'active')
       ON CONFLICT (organization_id, patient_id, therapist_id)
         WHERE type = 'patient_therapist' AND status = 'active'
       DO UPDATE SET status = 'active'
       RETURNING *`,
      [uuidv4(), orgId, patientProfileId, therapistProfileId],
    );

    return conversation;
  }

  async listMessages(conversationId: string, userId: string, orgId: string, query: ListMessagesQueryDto) {
    await this.assertParticipant(conversationId, userId, orgId);

    const limit = query.limit ?? 30;
    const params: any[] = [conversationId, limit];
    let beforeClause = '';
    if (query.before) {
      params.push(query.before);
      beforeClause = `AND m.created_at < $${params.length}`;
    }

    const messages = await this.db.query<any>(
      `SELECT
         m.id, m.content, m.sender_id, m.message_type, m.created_at, m.read,
         u.role AS sender_role
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 ${beforeClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params,
    );

    return messages.map((m: any) => ({
      ...m,
      is_mine: m.sender_id === userId,
    })).reverse();
  }

  async sendMessage(conversationId: string, userId: string, orgId: string, dto: SendMessageDto) {
    const conversation = await this.assertParticipant(conversationId, userId, orgId);

    const msgId = uuidv4();
    const message = await this.db.queryOne<any>(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'text')
       RETURNING *`,
      [msgId, conversationId, userId, dto.content],
    );

    await this.db.execute(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId],
    );

    // Emit event for gateway to forward to recipient
    const recipientUserId = await this.resolveRecipientUserId(conversation, userId);
    this.eventEmitter.emit('message.sent', {
      conversationId,
      messageId: msgId,
      senderUserId: userId,
      recipientUserId,
      orgId,
    });

    return message;
  }

  async markRead(conversationId: string, userId: string, orgId: string) {
    await this.assertParticipant(conversationId, userId, orgId);
    const result = await this.db.queryOne<{ count: string }>(
      `UPDATE messages SET read = true, read_at = NOW()
       WHERE conversation_id = $1 AND sender_id <> $2 AND read = false
       RETURNING count(*) OVER () AS count`,
      [conversationId, userId],
    );
    return { marked: result ? Number(result.count) : 0 };
  }

  private async assertParticipant(conversationId: string, userId: string, orgId: string) {
    const conversation = await this.db.queryOne<any>(
      `SELECT c.id, c.organization_id, c.patient_id, c.therapist_id,
              pt.user_id AS patient_user_id,
              th.user_id AS therapist_user_id
       FROM conversations c
       JOIN patients   pt ON pt.id = c.patient_id
       JOIN therapists th ON th.id = c.therapist_id
       WHERE c.id = $1 AND c.organization_id = $2`,
      [conversationId, orgId],
    );

    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.patient_user_id !== userId && conversation.therapist_user_id !== userId) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
    return conversation;
  }

  private async resolveRecipientUserId(conversation: any, senderUserId: string): Promise<string> {
    if (conversation.patient_user_id === senderUserId) return conversation.therapist_user_id;
    return conversation.patient_user_id;
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
