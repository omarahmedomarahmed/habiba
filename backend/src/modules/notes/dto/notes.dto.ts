import { IsOptional, IsString, IsUUID, IsIn, IsObject, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListNotesQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'finalized | draft | needs_review' })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'SOAP | DAP | BIRP' })
  @IsOptional() @IsString()
  format?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  session_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  patient_id?: string;
}

export class CreateNoteDto {
  @ApiProperty() @IsUUID()
  session_id: string;

  @ApiPropertyOptional({ enum: ['soap', 'dap', 'birp', 'narrative'] })
  @IsOptional() @IsString() @IsIn(['soap', 'dap', 'birp', 'narrative', 'SOAP', 'DAP', 'BIRP'])
  note_format?: string;

  @ApiPropertyOptional({ description: '{ SOAP: { subjective, objective, assessment, plan } }' })
  @IsOptional() @IsObject()
  content?: Record<string, unknown>;
}

export class UpdateNoteDto {
  @ApiPropertyOptional({ description: '{ SOAP: { subjective, objective, assessment, plan } }' })
  @IsOptional() @IsObject()
  content?: Record<string, unknown>;
}

// Reviewed: 2026-06-13 — 24Therapy audit
