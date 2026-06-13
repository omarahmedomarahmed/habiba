import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsUUID,
  IsNotEmpty,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum WorkflowCategory {
  CLINICAL = 'clinical',
  PRACTICE_OPERATIONS = 'practice_operations',
  BILLING = 'billing',
  COMPLIANCE = 'compliance',
  INTAKE = 'intake',
  CRISIS = 'crisis',
  DISCHARGE = 'discharge',
}

export enum WorkflowTriggerType {
  SESSION_COMPLETED = 'session_completed',
  ASSESSMENT_SUBMITTED = 'assessment_submitted',
  PATIENT_REGISTERED = 'patient_registered',
  PHQ9_THRESHOLD = 'phq9_threshold',
  CRISIS_FLAG = 'crisis_flag',
  APPOINTMENT_SCHEDULED = 'appointment_scheduled',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  NOTE_CREATED = 'note_created',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  GOAL_ACHIEVED = 'goal_achieved',
  DISCHARGE_DATE_APPROACHING = 'discharge_date_approaching',
}

export enum WorkflowActionType {
  SEND_EMAIL = 'send_email',
  SEND_SMS = 'send_sms',
  CREATE_TASK = 'create_task',
  ASSIGN_ASSESSMENT = 'assign_assessment',
  CREATE_NOTE = 'create_note',
  NOTIFY_THERAPIST = 'notify_therapist',
  NOTIFY_SUPERVISOR = 'notify_supervisor',
  CREATE_BILLING_ITEM = 'create_billing_item',
  UPDATE_PATIENT_STATUS = 'update_patient_status',
  SCHEDULE_APPOINTMENT = 'schedule_appointment',
  FLAG_FOR_REVIEW = 'flag_for_review',
  GENERATE_REPORT = 'generate_report',
  WEBHOOK = 'webhook',
  DELAY = 'delay',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

export enum TreatmentPlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  UNDER_REVIEW = 'under_review',
  COMPLETED = 'completed',
}

export enum TreatmentPlanApproach {
  CBT = 'cbt',
  DBT = 'dbt',
  ACT = 'act',
  EMDR = 'emdr',
  TRAUMA_FOCUSED = 'trauma_focused',
  PSYCHODYNAMIC = 'psychodynamic',
  MOTIVATIONAL = 'motivational_interviewing',
  FAMILY_SYSTEMS = 'family_systems',
  INTEGRATIVE = 'integrative',
}

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class WorkflowTriggerDto {
  @ApiProperty({
    description: 'Event type that activates this workflow',
    enum: WorkflowTriggerType,
  })
  @IsEnum(WorkflowTriggerType)
  type: WorkflowTriggerType;

  @ApiPropertyOptional({
    description: 'Optional conditions that must be true for the trigger to fire',
    example: { phq9_score_gte: 10, session_count_gte: 3 },
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Cron expression for scheduled triggers (e.g., "0 9 * * MON")',
    example: '0 9 * * MON',
  })
  @IsOptional()
  @IsString()
  cron_expression?: string;
}

export class WorkflowActionDto {
  @ApiProperty({
    description: 'Type of action to execute',
    enum: WorkflowActionType,
  })
  @IsEnum(WorkflowActionType)
  type: WorkflowActionType;

  @ApiPropertyOptional({
    description: 'Execution order within the workflow (0-indexed)',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description: 'Action-specific configuration parameters',
    example: {
      template_id: 'session_followup',
      subject: 'Session Follow-Up',
      delay_hours: 24,
    },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Delay in minutes before executing this action',
    example: 60,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delay_minutes?: number;

  @ApiPropertyOptional({
    description: 'Only execute this action if these conditions are met',
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;
}

export class TreatmentGoalDto {
  @ApiProperty({
    description: 'Goal title / objective statement',
    example: 'Reduce frequency of panic attacks to less than 1 per week',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the goal and success criteria',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Target completion date (ISO 8601)',
    example: '2025-06-30',
  })
  @IsOptional()
  @IsDateString()
  target_date?: string;

  @ApiPropertyOptional({
    description: 'Measurable milestones toward this goal',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  milestones?: string[];

  @ApiPropertyOptional({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress_pct?: number;
}

export class TreatmentInterventionDto {
  @ApiProperty({
    description: 'Name of the therapeutic intervention',
    example: 'Cognitive Restructuring',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Frequency of use (e.g., weekly, per-session)',
    example: 'per_session',
  })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Rationale for this intervention',
  })
  @IsOptional()
  @IsString()
  rationale?: string;
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class ListWorkflowsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by workflow status',
    enum: WorkflowStatus,
  })
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @ApiPropertyOptional({
    description: 'Filter by workflow category',
    enum: WorkflowCategory,
  })
  @IsOptional()
  @IsEnum(WorkflowCategory)
  category?: WorkflowCategory;

  @ApiPropertyOptional({
    description: 'Filter to workflows affecting a specific patient',
  })
  @IsOptional()
  @IsUUID()
  patient_id?: string;

  @ApiPropertyOptional({
    description: 'Search by workflow name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

export class ListWorkflowTemplatesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter templates by category',
    enum: WorkflowCategory,
  })
  @IsOptional()
  @IsEnum(WorkflowCategory)
  category?: WorkflowCategory;

  @ApiPropertyOptional({
    description: 'Search templates by name or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include only active/published templates',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  published_only?: boolean;
}

// ─── Create / Update DTOs ─────────────────────────────────────────────────────

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'Workflow name',
    example: 'Post-Session Follow-Up',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Workflow description',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Workflow category',
    enum: WorkflowCategory,
    default: WorkflowCategory.CLINICAL,
  })
  @IsOptional()
  @IsEnum(WorkflowCategory)
  category?: WorkflowCategory = WorkflowCategory.CLINICAL;

  @ApiProperty({
    description: 'Trigger configuration — what event starts this workflow',
    type: WorkflowTriggerDto,
  })
  @ValidateNested()
  @Type(() => WorkflowTriggerDto)
  trigger: WorkflowTriggerDto;

  @ApiProperty({
    description: 'Ordered list of actions to execute when triggered',
    type: [WorkflowActionDto],
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowActionDto)
  actions: WorkflowActionDto[];

  @ApiPropertyOptional({
    description: 'ID of a template to base this workflow on',
  })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({
    description: 'Patient this workflow is scoped to (if patient-specific)',
  })
  @IsOptional()
  @IsUUID()
  patient_id?: string;

  @ApiPropertyOptional({
    description: 'Whether to activate immediately or save as draft',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  activate_immediately?: boolean = false;
}

export class UpdateWorkflowStatusDto {
  @ApiProperty({
    description: 'New status for the workflow',
    enum: WorkflowStatus,
  })
  @IsEnum(WorkflowStatus)
  status: WorkflowStatus;

  @ApiPropertyOptional({
    description: 'Reason for the status change (required for cancellation)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteWorkflowTaskDto {
  @ApiPropertyOptional({
    description: 'Result data from completing this task',
  })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Notes about task completion',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether to skip remaining optional tasks in sequence',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skip_remaining?: boolean;
}

// ─── Treatment Plan DTOs ──────────────────────────────────────────────────────

export class CreateTreatmentPlanDto {
  @ApiProperty({
    description: 'Patient this treatment plan is for',
  })
  @IsUUID()
  patient_id: string;

  @ApiProperty({
    description: 'Primary clinical diagnosis (DSM-5)',
    example: 'F41.1 - Generalized Anxiety Disorder',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  primary_diagnosis: string;

  @ApiPropertyOptional({
    description: 'Secondary diagnoses (comorbidities)',
    type: [String],
    example: ['F32.1 - Major Depressive Disorder, Moderate'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondary_diagnoses?: string[];

  @ApiProperty({
    description: 'Primary therapeutic approach',
    enum: TreatmentPlanApproach,
  })
  @IsEnum(TreatmentPlanApproach)
  primary_approach: TreatmentPlanApproach;

  @ApiPropertyOptional({
    description: 'Additional therapeutic modalities',
    type: [String],
    enum: TreatmentPlanApproach,
  })
  @IsOptional()
  @IsArray()
  secondary_approaches?: TreatmentPlanApproach[];

  @ApiProperty({
    description: 'Treatment goals for this plan',
    type: [TreatmentGoalDto],
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentGoalDto)
  goals: TreatmentGoalDto[];

  @ApiPropertyOptional({
    description: 'Clinical interventions to be used',
    type: [TreatmentInterventionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentInterventionDto)
  interventions?: TreatmentInterventionDto[];

  @ApiPropertyOptional({
    description: 'Target number of sessions for this treatment plan',
    example: 24,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  target_sessions?: number;

  @ApiPropertyOptional({
    description: 'Session frequency (e.g., weekly, bi-weekly)',
    example: 'weekly',
  })
  @IsOptional()
  @IsString()
  @IsIn(['twice_weekly', 'weekly', 'bi_weekly', 'monthly', 'as_needed'])
  session_frequency?: string;

  @ApiPropertyOptional({
    description: 'Planned discharge date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  planned_discharge_date?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes and additional context for this plan',
  })
  @IsOptional()
  @IsString()
  clinical_notes?: string;
}

export class UpdateTreatmentPlanDto {
  @ApiPropertyOptional({
    description: 'Updated primary diagnosis',
  })
  @IsOptional()
  @IsString()
  primary_diagnosis?: string;

  @ApiPropertyOptional({
    description: 'Updated treatment plan status',
    enum: TreatmentPlanStatus,
  })
  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @ApiPropertyOptional({
    description: 'Updated goals list',
    type: [TreatmentGoalDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentGoalDto)
  goals?: TreatmentGoalDto[];

  @ApiPropertyOptional({
    description: 'Updated interventions',
    type: [TreatmentInterventionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentInterventionDto)
  interventions?: TreatmentInterventionDto[];

  @ApiPropertyOptional({
    description: 'Updated clinical notes',
  })
  @IsOptional()
  @IsString()
  clinical_notes?: string;

  @ApiPropertyOptional({
    description: 'Review notes for treatment plan review cycle',
  })
  @IsOptional()
  @IsString()
  review_notes?: string;

  @ApiPropertyOptional({
    description: 'Updated planned discharge date',
  })
  @IsOptional()
  @IsDateString()
  planned_discharge_date?: string;
}

// Reviewed: 2026-06-13 — 24Therapy audit
