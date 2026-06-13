import { IsString, IsOptional, IsNumber, IsArray, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRadarRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() specialization?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) presenting_issues?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() preferred_language?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['immediate', 'today', 'this_week']) urgency_level?: 'immediate' | 'today' | 'this_week';
  @ApiPropertyOptional() @IsOptional() @IsEnum(['video', 'audio', 'chat']) session_type?: 'video' | 'audio' | 'chat';
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) budget_min?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) budget_max?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() therapist_gender_preference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() patient_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class RespondToRadarDto {
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proposed_time?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) proposed_rate?: number;
}

// Reviewed: 2026-06-13 — 24Therapy audit
