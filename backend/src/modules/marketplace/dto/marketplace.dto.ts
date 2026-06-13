import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class SearchMarketplaceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() specializations?: string | string[];
  @ApiPropertyOptional() @IsOptional() languages?: string | string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() min_price?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() max_price?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) min_rating?: number;
  @ApiPropertyOptional() @IsOptional() accepts_insurance?: string;
  @ApiPropertyOptional() @IsOptional() available_now?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['rating', 'price', 'experience', 'sessions']) sort_by?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number = 20;
}

export class CreateListingDto {
  @ApiProperty() @IsString() therapist_id: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) specializations?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) session_rate?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() accepts_insurance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) insurance_providers?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() availability_timezone?: string;
}

export class UpdateListingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) specializations?: string[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) session_rate?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_visible?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() accepts_insurance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) insurance_providers?: string[];
}

// Reviewed: 2026-06-13 — 24Therapy audit
