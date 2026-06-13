import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  Min,
  Max,
  IsUUID,
  IsNotEmpty,
  IsDateString,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum MemoryNodeType {
  SYMPTOM = 'symptom',
  MEDICATION = 'medication',
  DIAGNOSIS = 'diagnosis',
  LIFE_EVENT = 'life_event',
  RELATIONSHIP = 'relationship',
  BELIEF = 'belief',
  BEHAVIOR = 'behavior',
  TRIGGER = 'trigger',
  COPING_SKILL = 'coping_skill',
  GOAL = 'goal',
  TRAUMA = 'trauma',
  STRENGTH = 'strength',
  CONCERN = 'concern',
  PROGRESS = 'progress',
  INSIGHT = 'insight',
  TREATMENT_RESPONSE = 'treatment_response',
  FAMILY_HISTORY = 'family_history',
  SUBSTANCE = 'substance',
  SLEEP = 'sleep',
  APPETITE = 'appetite',
  SOCIAL = 'social',
}

export enum MemoryNodeStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  MONITORING = 'monitoring',
  HISTORICAL = 'historical',
}

export enum MemoryNodeSeverity {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AIContextDepth {
  BRIEF = 'brief',
  STANDARD = 'standard',
  COMPREHENSIVE = 'comprehensive',
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class GetPatientMemoryQueryDto {
  @ApiPropertyOptional({
    description: 'Comma-separated list of memory node types to filter by',
    example: 'symptom,diagnosis,medication',
  })
  @IsOptional()
  @IsString()
  node_types?: string;

  @ApiPropertyOptional({
    description: 'Filter by memory node status',
    enum: MemoryNodeStatus,
  })
  @IsOptional()
  @IsEnum(MemoryNodeStatus)
  status?: MemoryNodeStatus;

  @ApiPropertyOptional({
    description: 'Maximum number of nodes to return',
    example: 50,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Include chronological timeline of memory events',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_timeline?: boolean;

  @ApiPropertyOptional({
    description: 'Include knowledge graph relationships',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_graph?: boolean;
}

export class SearchMemoryQueryDto {
  @ApiProperty({
    description: 'Full-text search query across memory nodes',
    example: 'panic attacks anxiety workplace',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  q: string;
}

export class BuildAIContextQueryDto {
  @ApiPropertyOptional({
    description: 'Depth of AI context to build for session preparation',
    enum: AIContextDepth,
    default: AIContextDepth.STANDARD,
  })
  @IsOptional()
  @IsEnum(AIContextDepth)
  depth?: AIContextDepth = AIContextDepth.STANDARD;
}

// ─── Create/Update DTOs ───────────────────────────────────────────────────────

export class CreateMemoryNodeDto {
  @ApiProperty({
    description: 'Type of memory node being recorded',
    enum: MemoryNodeType,
    example: MemoryNodeType.SYMPTOM,
  })
  @IsEnum(MemoryNodeType)
  node_type: MemoryNodeType;

  @ApiProperty({
    description: 'Human-readable title for the memory node',
    example: 'Panic attacks at work',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed clinical description of the memory node content',
    example: 'Patient reports panic attacks occurring 2-3 times/week in workplace, triggered by high-pressure meetings',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Severity level of this memory node',
    enum: MemoryNodeSeverity,
  })
  @IsOptional()
  @IsEnum(MemoryNodeSeverity)
  severity?: MemoryNodeSeverity;

  @ApiPropertyOptional({
    description: 'Date when this event/symptom was first observed (ISO 8601)',
    example: '2024-10-15',
  })
  @IsOptional()
  @IsDateString()
  observed_date?: string;

  @ApiPropertyOptional({
    description: 'Therapist-supplied confidence score for AI-extracted nodes (0-1)',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({
    description: 'IDs of related sessions this memory was observed in',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  session_ids?: string[];

  @ApiPropertyOptional({
    description: 'IDs of related memory nodes (for graph connections)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  related_node_ids?: string[];

  @ApiPropertyOptional({
    description: 'Additional structured metadata for this node type',
    example: { frequency: '2-3x/week', duration_minutes: 20 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Tags for categorization and search',
    type: [String],
    example: ['anxiety', 'workplace', 'panic'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateMemoryNodeDto {
  @ApiPropertyOptional({
    description: 'Updated title for the memory node',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated clinical description',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated severity level',
    enum: MemoryNodeSeverity,
  })
  @IsOptional()
  @IsEnum(MemoryNodeSeverity)
  severity?: MemoryNodeSeverity;

  @ApiPropertyOptional({
    description: 'Updated status for lifecycle management',
    enum: MemoryNodeStatus,
  })
  @IsOptional()
  @IsEnum(MemoryNodeStatus)
  status?: MemoryNodeStatus;

  @ApiPropertyOptional({
    description: 'Updated therapist confidence score (0-1)',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({
    description: 'Updated metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Updated tags',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Optional resolution notes when marking as resolved',
  })
  @IsOptional()
  @IsString()
  resolution_notes?: string;
}

// ─── AI Extraction DTO ────────────────────────────────────────────────────────

export class ExtractMemoryFromNoteDto {
  @ApiProperty({
    description: 'ID of the session note to extract memories from',
  })
  @IsUUID()
  note_id: string;

  @ApiProperty({
    description: 'ID of the therapy session this note belongs to',
  })
  @IsUUID()
  session_id: string;

  @ApiProperty({
    description: 'ID of the patient this note is about',
  })
  @IsUUID()
  patient_id: string;

  @ApiProperty({
    description: 'Full text content of the session note for AI extraction',
    minLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  note_content: string;
}

// Reviewed: 2026-06-13 — 24Therapy audit
