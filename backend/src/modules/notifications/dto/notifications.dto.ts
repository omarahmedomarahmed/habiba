import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsUUID, IsNotEmpty, IsObject, IsDateString, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationType {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  SESSION_NOTE_DUE = 'session_note_due',
  ASSESSMENT_ASSIGNED = 'assessment_assigned',
  HOMEWORK_DUE = 'homework_due',
  MESSAGE_RECEIVED = 'message_received',
  CRISIS_ALERT = 'crisis_alert',
  BILLING_REMINDER = 'billing_reminder',
  SYSTEM_ALERT = 'system_alert',
  WORKFLOW_TASK = 'workflow_task',
  SUPERVISION_REQUEST = 'supervision_request',
  TEAM_ANNOUNCEMENT = 'team_announcement',
  COMPLIANCE_ALERT = 'compliance_alert',
}

// ─── Query DTO ────────────────────────────────────────────────────────────────

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter unread notifications only', example: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unread_only?: boolean;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ─── Create Notification DTO ──────────────────────────────────────────────────

export class CreateNotificationDto {
  @ApiProperty({ description: 'Recipient user UUID' })
  @IsUUID()
  recipient_id: string;

  @ApiProperty({
    enum: NotificationType,
    description: 'Type/category of notification',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Short notification title (shown in notification list)',
    example: 'Session note overdue — Jordan P.',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Full notification message body',
    example: 'The session note for Jordan P. (session on Jan 14) is now 2 days overdue.',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Delivery channels to use',
    type: [String],
    enum: NotificationChannel,
    example: ['in_app', 'email'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'Deep-link URL to navigate to when notification is tapped',
    example: '/sessions/sess_abc123',
  })
  @IsOptional()
  @IsString()
  action_url?: string;

  @ApiPropertyOptional({
    description: 'Additional payload metadata attached to this notification',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Schedule delivery for a future time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiPropertyOptional({
    description: 'Notification expiry — auto-dismisses after this time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

// ─── Mark Read DTO ────────────────────────────────────────────────────────────

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({
    description: 'Specific notification UUIDs to mark as read. If empty, marks ALL as read.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  notification_ids?: string[];
}

// ─── Preferences DTO ─────────────────────────────────────────────────────────

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Enable in-app notifications', default: true })
  @IsOptional()
  @IsBoolean()
  in_app_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable email notifications', default: true })
  @IsOptional()
  @IsBoolean()
  email_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable SMS notifications', default: false })
  @IsOptional()
  @IsBoolean()
  sms_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable push notifications', default: true })
  @IsOptional()
  @IsBoolean()
  push_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Per-type preferences overrides',
    example: { crisis_alert: { sms: true, email: true }, system_alert: { email: false } },
  })
  @IsOptional()
  @IsObject()
  type_overrides?: Record<string, Record<string, boolean>>;

  @ApiPropertyOptional({ description: 'Quiet hours start (24h format, e.g., "22:00")', example: '22:00' })
  @IsOptional()
  @IsString()
  quiet_hours_start?: string;

  @ApiPropertyOptional({ description: 'Quiet hours end (24h format, e.g., "08:00")', example: '08:00' })
  @IsOptional()
  @IsString()
  quiet_hours_end?: string;
}
