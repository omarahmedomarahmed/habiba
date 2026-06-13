import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'sara.ahmed@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mfa_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ip_address?: string;
}

// Reviewed: 2026-06-13 — 24Therapy audit
