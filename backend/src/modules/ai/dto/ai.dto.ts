import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsObject, IsUUID, IsNotEmpty, Min, Max, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum AIModel {
  GPT4O = 'gpt-4o',
  GPT4O_MINI = 'gpt-4o-mini',
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022',
  WHISPER_1 = 'whisper-1',
  TEXT_EMBEDDING_3_LARGE = 'text-embedding-3-large',
}

export enum CopilotMode {
  REAL_TIME = 'real_time',
  PRE_SESSION = 'pre_session',
  POST_SESSION = 'post_session',
  SUPERVISION = 'supervision',
}

export enum ScribeOutputFormat {
  SOAP = 'soap',
  DAP = 'dap',
  BIRP = 'birp',
  PROGRESS_NOTE = 'progress_note',
  INTAKE = 'intake',
  DISCHARGE = 'discharge',
}

// ─── Copilot DTOs ─────────────────────────────────────────────────────────────

export class CopilotSuggestionRequestDto {
  @ApiProperty({ description: 'Patient UUID for context retrieval' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({ description: 'Active session UUID' })
  @IsUUID()
  session_id: string;

  @ApiProperty({ description: 'Recent session transcript or therapist prompt' })
  @IsString()
  @IsNotEmpty()
  context: string;

  @ApiPropertyOptional({ enum: CopilotMode, default: CopilotMode.REAL_TIME })
  @IsOptional()
  @IsEnum(CopilotMode)
  mode?: CopilotMode;

  @ApiPropertyOptional({ description: 'Include memory context in suggestion generation', default: true })
  @IsOptional()
  @IsBoolean()
  include_memory?: boolean;

  @ApiPropertyOptional({ description: 'Max tokens for suggestion response', example: 1024 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(4096)
  max_tokens?: number;
}

export class CopilotChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CopilotChatDto {
  @ApiProperty({ description: 'Patient UUID for context' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({ description: 'Active session UUID' })
  @IsUUID()
  session_id: string;

  @ApiProperty({ type: [CopilotChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CopilotChatMessageDto)
  messages: CopilotChatMessageDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}

// ─── Scribe DTOs ──────────────────────────────────────────────────────────────

export class GenerateScribeNoteDto {
  @ApiProperty({ description: 'Raw session transcript or detailed therapist notes' })
  @IsString()
  @IsNotEmpty()
  transcript: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({ description: 'Session UUID' })
  @IsUUID()
  session_id: string;

  @ApiPropertyOptional({
    enum: ScribeOutputFormat,
    default: ScribeOutputFormat.SOAP,
    description: 'Output format for the generated clinical note',
  })
  @IsOptional()
  @IsEnum(ScribeOutputFormat)
  format?: ScribeOutputFormat;

  @ApiPropertyOptional({ description: 'Include diagnostic impressions in output', default: false })
  @IsOptional()
  @IsBoolean()
  include_diagnostic_impressions?: boolean;

  @ApiPropertyOptional({ description: 'Include billing codes (CPT) suggestion', default: false })
  @IsOptional()
  @IsBoolean()
  include_billing_codes?: boolean;

  @ApiPropertyOptional({ description: 'Therapist-specific style preferences for note generation' })
  @IsOptional()
  @IsObject()
  style_preferences?: Record<string, unknown>;
}

export class TranscribeAudioDto {
  @ApiProperty({ description: 'URL of the session audio file to transcribe' })
  @IsString()
  @IsNotEmpty()
  audio_url: string;

  @ApiProperty({ description: 'Session UUID for this transcription' })
  @IsUUID()
  session_id: string;

  @ApiPropertyOptional({ description: 'Language code (ISO 639-1), defaults to auto-detect', example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Enable speaker diarization (separate therapist/patient voices)', default: true })
  @IsOptional()
  @IsBoolean()
  diarize?: boolean;
}

// ─── Summary DTOs ─────────────────────────────────────────────────────────────

export class GenerateSummaryDto {
  @ApiProperty({ description: 'Session UUID to summarize' })
  @IsUUID()
  session_id: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patient_id: string;

  @ApiPropertyOptional({
    description: 'Summary type',
    enum: ['session', 'progress', 'discharge', 'supervisor'],
    default: 'session',
  })
  @IsOptional()
  @IsString()
  summary_type?: 'session' | 'progress' | 'discharge' | 'supervisor';

  @ApiPropertyOptional({ description: 'Include medication-related observations', default: false })
  @IsOptional()
  @IsBoolean()
  include_medication_notes?: boolean;
}

// ─── Risk Assessment DTO ──────────────────────────────────────────────────────

export class RiskScreenRequestDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({ description: 'Session UUID or note content to screen' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Sensitivity level — higher means more alerts', example: 'high', enum: ['low', 'standard', 'high'] })
  @IsOptional()
  @IsString()
  sensitivity?: 'low' | 'standard' | 'high';
}
