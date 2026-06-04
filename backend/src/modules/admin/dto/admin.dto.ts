import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsUUID, IsNotEmpty, IsObject, IsEmail, Min, Max, IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum FeatureFlagType {
  BOOLEAN = 'boolean',
  PERCENTAGE = 'percentage',
  VARIANT = 'variant',
}

export enum FeatureFlagScope {
  GLOBAL = 'global',
  ORG = 'org',
  USER = 'user',
  PLAN = 'plan',
}

export enum AdminAuditCategory {
  AUTHENTICATION = 'authentication',
  USER_MANAGEMENT = 'user_management',
  ORG_MANAGEMENT = 'org_management',
  BILLING = 'billing',
  AI_OPERATIONS = 'ai_operations',
  SYSTEM_CONFIG = 'system_config',
  FEATURE_FLAGS = 'feature_flags',
  PHI_ACCESS = 'phi_access',
  SECURITY = 'security',
  ADMIN_ACTIONS = 'admin_actions',
}

export enum SupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_CUSTOMER = 'waiting_customer',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum SupportTicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ─── Feature Flag DTOs ────────────────────────────────────────────────────────

export class CreateFeatureFlagDto {
  @ApiProperty({ description: 'Machine-readable flag key', example: 'ai_copilot_v2' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Human-readable display name', example: 'AI Copilot V2' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of what this flag controls' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FeatureFlagType })
  @IsEnum(FeatureFlagType)
  type: FeatureFlagType;

  @ApiProperty({ enum: FeatureFlagScope, default: FeatureFlagScope.GLOBAL })
  @IsEnum(FeatureFlagScope)
  scope: FeatureFlagScope;

  @ApiPropertyOptional({ description: 'Initial enabled state', default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Rollout percentage for percentage-type flags (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rollout_percentage?: number;

  @ApiPropertyOptional({
    description: 'Variant options for A/B test flags',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variants?: string[];
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rollout_percentage?: number;

  @ApiPropertyOptional({ description: 'Per-org overrides', example: { 'org_id_123': true } })
  @IsOptional()
  @IsObject()
  org_overrides?: Record<string, boolean | number | string>;

  @ApiPropertyOptional({ description: 'Per-plan overrides', example: { enterprise: true, starter: false } })
  @IsOptional()
  @IsObject()
  plan_overrides?: Record<string, boolean>;

  @ApiPropertyOptional({ description: 'Change notes for audit trail' })
  @IsOptional()
  @IsString()
  change_notes?: string;
}

// ─── Support Ticket DTOs ──────────────────────────────────────────────────────

export class ListSupportTicketsQueryDto {
  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiPropertyOptional({ description: 'Search by subject, email, or org name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Assigned agent UUID' })
  @IsOptional()
  @IsUUID()
  assigned_to?: string;

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

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;

  @ApiPropertyOptional({ description: 'Resolution notes (required when closing)' })
  @IsOptional()
  @IsString()
  resolution_notes?: string;
}

// ─── User Impersonation DTO ───────────────────────────────────────────────────

export class ImpersonateUserDto {
  @ApiProperty({ description: 'UUID of the user to impersonate' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Business reason for impersonation (audit trail)' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Support ticket reference ID' })
  @IsOptional()
  @IsString()
  ticket_ref?: string;

  @ApiPropertyOptional({
    description: 'Maximum session duration in minutes',
    minimum: 5,
    maximum: 120,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(120)
  max_duration_minutes?: number;
}

// ─── Audit Log Query DTO ──────────────────────────────────────────────────────

export class AdminAuditLogQueryDto {
  @ApiPropertyOptional({ enum: AdminAuditCategory })
  @IsOptional()
  @IsEnum(AdminAuditCategory)
  category?: AdminAuditCategory;

  @ApiPropertyOptional({ enum: ['success', 'failure', 'warning'] })
  @IsOptional()
  @IsIn(['success', 'failure', 'warning'])
  outcome?: 'success' | 'failure' | 'warning';

  @ApiPropertyOptional({ enum: ['info', 'low', 'medium', 'high', 'critical'] })
  @IsOptional()
  @IsIn(['info', 'low', 'medium', 'high', 'critical'])
  severity?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user UUID' })
  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @ApiPropertyOptional({ description: 'Filter by organization UUID' })
  @IsOptional()
  @IsUUID()
  org_id?: string;

  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Full-text search across action, details, actor' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;
}

// ─── System Config DTO ────────────────────────────────────────────────────────

export class UpdateSystemConfigDto {
  @ApiProperty({ description: 'Config key to update', example: 'session_timeout_minutes' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'New value for the config key' })
  @IsNotEmpty()
  value: string | number | boolean | Record<string, unknown>;

  @ApiProperty({ description: 'Reason for the change (audit trail)' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
