import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsUUID, IsNotEmpty, Min, Max, IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum AnalyticsGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export enum AnalyticsMetric {
  SESSION_COUNT = 'session_count',
  PATIENT_COUNT = 'patient_count',
  RETENTION_RATE = 'retention_rate',
  PHQ9_IMPROVEMENT = 'phq9_improvement',
  GOAL_COMPLETION = 'goal_completion',
  NOTE_COMPLETION_RATE = 'note_completion_rate',
  AI_USAGE = 'ai_usage',
  REVENUE = 'revenue',
  CANCELLATION_RATE = 'cancellation_rate',
  WAIT_TIME = 'wait_time',
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class AnalyticsDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Start of date range (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End of date range (ISO 8601)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    enum: AnalyticsGranularity,
    default: AnalyticsGranularity.MONTHLY,
    description: 'Time bucket granularity for time-series data',
  })
  @IsOptional()
  @IsEnum(AnalyticsGranularity)
  granularity?: AnalyticsGranularity;
}

export class OrgAnalyticsQueryDto extends AnalyticsDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by specific therapist UUID',
  })
  @IsOptional()
  @IsUUID()
  therapist_id?: string;

  @ApiPropertyOptional({
    description: 'Specific metrics to include in the response',
    type: [String],
    enum: AnalyticsMetric,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AnalyticsMetric, { each: true })
  metrics?: AnalyticsMetric[];
}

export class PatientOutcomesQueryDto {
  @ApiPropertyOptional({
    description: 'UUID of patient to get outcomes for (omit for org-level)',
  })
  @IsOptional()
  @IsUUID()
  patient_id?: string;

  @ApiPropertyOptional({
    description: 'Include PHQ-9 score trend data',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_phq9?: boolean;

  @ApiPropertyOptional({
    description: 'Include GAD-7 score trend data',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_gad7?: boolean;

  @ApiPropertyOptional({
    description: 'Number of periods to look back',
    example: 12,
    minimum: 1,
    maximum: 52,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(52)
  @Type(() => Number)
  periods?: number;
}

export class AdminAnalyticsQueryDto extends AnalyticsDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by specific organization UUID',
  })
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({
    description: 'Include cohort retention analysis',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_cohorts?: boolean;

  @ApiPropertyOptional({
    description: 'Include AI cost breakdown',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_ai_costs?: boolean;
}

export class AIUsageQueryDto extends AnalyticsDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by AI model name',
    example: 'gpt-4o',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Filter by AI feature type',
    enum: ['scribe', 'copilot', 'memory', 'radar', 'summary'],
  })
  @IsOptional()
  @IsString()
  feature?: string;
}

// Reviewed: 2026-06-13 — 24Therapy audit
