import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsUUID, IsNotEmpty, Min, Max, IsObject, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum AssessmentType {
  PHQ9 = 'phq9',
  GAD7 = 'gad7',
  PCL5 = 'pcl5',
  AUDIT = 'audit',
  DAST10 = 'dast10',
  MDQ = 'mdq',
  CSS = 'css',
  SAS = 'sas',
  DASS21 = 'dass21',
  WHODAS = 'whodas',
  INTAKE = 'intake',
  CUSTOM = 'custom',
}

export enum AssessmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum AssessmentFrequency {
  ONCE = 'once',
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  AS_NEEDED = 'as_needed',
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class ListAssessmentsQueryDto {
  @ApiPropertyOptional({ enum: AssessmentStatus })
  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @ApiPropertyOptional({ enum: AssessmentType })
  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsOptional()
  @IsUUID()
  patient_id?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ─── Assign Assessment DTO ────────────────────────────────────────────────────

export class AssignAssessmentDto {
  @ApiProperty({ description: 'Patient UUID to assign the assessment to' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({
    description: 'Assessment type to assign',
    enum: AssessmentType,
  })
  @IsEnum(AssessmentType)
  type: AssessmentType;

  @ApiPropertyOptional({
    description: 'Custom assessment template ID (only for type=custom)',
  })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({
    description: 'Date the assessment should be completed by (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({
    description: 'Recurring frequency for automatic re-assignment',
    enum: AssessmentFrequency,
    default: AssessmentFrequency.ONCE,
  })
  @IsOptional()
  @IsEnum(AssessmentFrequency)
  frequency?: AssessmentFrequency;

  @ApiPropertyOptional({
    description: 'Optional message to patient explaining why they are being asked to complete this',
  })
  @IsOptional()
  @IsString()
  patient_message?: string;

  @ApiPropertyOptional({
    description: 'Session UUID to link this assessment to (for session-specific assessments)',
  })
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

// ─── Submit Assessment DTO ────────────────────────────────────────────────────

export class SubmitAssessmentDto {
  @ApiProperty({
    description: 'Assessment responses — key is question ID, value is response',
    example: { q1: 2, q2: 1, q3: 3 },
  })
  @IsObject()
  responses: Record<string, number | string | boolean>;

  @ApiPropertyOptional({
    description: 'Patient free-text notes about how they are feeling',
  })
  @IsOptional()
  @IsString()
  patient_notes?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp of when the patient completed the assessment',
  })
  @IsOptional()
  @IsDateString()
  completed_at?: string;
}

// ─── Score Override DTO ───────────────────────────────────────────────────────

export class OverrideAssessmentScoreDto {
  @ApiProperty({
    description: 'Clinician-reviewed score (overrides AI-calculated score)',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiProperty({
    description: 'Clinician rationale for the override',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  rationale: string;
}

// ─── Trend Analysis DTO ───────────────────────────────────────────────────────

export class AssessmentTrendQueryDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patient_id: string;

  @ApiPropertyOptional({
    description: 'Assessment type to get trend for',
    enum: AssessmentType,
    default: AssessmentType.PHQ9,
  })
  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @ApiPropertyOptional({
    description: 'Number of past assessments to include in trend',
    example: 12,
    minimum: 2,
    maximum: 52,
  })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(52)
  @Type(() => Number)
  count?: number;
}

// Reviewed: 2026-06-13 — 24Therapy audit
