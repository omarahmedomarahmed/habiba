import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'sara.ahmed@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sara' })
  @IsString()
  first_name: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  last_name: string;

  @ApiPropertyOptional({ enum: ['therapist', 'patient', 'admin'] })
  @IsOptional()
  @IsEnum(['therapist', 'patient', 'admin', 'assistant'])
  role?: string;

  @ApiPropertyOptional({ example: "Sara's Practice" })
  @IsOptional()
  @IsString()
  organization_name?: string;

  @ApiPropertyOptional({ example: 'my-practice' })
  @IsOptional()
  @IsString()
  organization_slug?: string;
}

// Reviewed: 2026-06-13 — 24Therapy audit
