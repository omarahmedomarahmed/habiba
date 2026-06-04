import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsUUID, IsNotEmpty, IsObject, IsEmail, IsUrl, Min, Max,
  MinLength, MaxLength, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum OrganizationPlan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  SUSPENDED = 'suspended',
  CHURNED = 'churned',
  ONBOARDING = 'onboarding',
}

export enum OrganizationType {
  SOLO_PRACTICE = 'solo_practice',
  GROUP_PRACTICE = 'group_practice',
  CLINIC = 'clinic',
  HOSPITAL = 'hospital',
  TELEHEALTH = 'telehealth',
  COMMUNITY_MENTAL_HEALTH = 'community_mental_health',
  EMPLOYEE_ASSISTANCE = 'employee_assistance',
}

export enum MemberRole {
  OWNER = 'owner',
  SUPERVISOR = 'supervisor',
  THERAPIST = 'therapist',
  INTERN = 'intern',
  BILLER = 'biller',
  ADMIN = 'admin',
  FRONT_DESK = 'front_desk',
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiPropertyOptional({ enum: OrganizationPlan })
  @IsOptional()
  @IsEnum(OrganizationPlan)
  plan?: OrganizationPlan;

  @ApiPropertyOptional({ description: 'Search by org name, email, or domain' })
  @IsOptional()
  @IsString()
  search?: string;

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

export class ListMembersQueryDto {
  @ApiPropertyOptional({ enum: MemberRole })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @ApiPropertyOptional({ description: 'Active members only', example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active_only?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// ─── Create / Update DTOs ─────────────────────────────────────────────────────

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name', example: 'Mindful Horizons Clinic', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ enum: OrganizationType, default: OrganizationType.GROUP_PRACTICE })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @ApiPropertyOptional({ enum: OrganizationPlan, default: OrganizationPlan.STARTER })
  @IsOptional()
  @IsEnum(OrganizationPlan)
  plan?: OrganizationPlan;

  @ApiProperty({ description: 'Primary admin email address' })
  @IsEmail()
  admin_email: string;

  @ApiPropertyOptional({ description: 'Primary phone number', example: '+1-555-000-1234' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Website URL', example: 'https://mindfulhorizons.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Organization timezone', example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Number of licensed seats', example: 10, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  seats?: number;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'EHR/Telehealth integrations configuration',
  })
  @IsOptional()
  @IsObject()
  integrations?: Record<string, unknown>;
}

// ─── Invite Member DTO ────────────────────────────────────────────────────────

export class InviteMemberDto {
  @ApiProperty({ description: 'Email address to invite' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: MemberRole, description: 'Role to assign the invited user' })
  @IsEnum(MemberRole)
  role: MemberRole;

  @ApiPropertyOptional({
    description: 'UUID of supervising therapist (required for intern role)',
  })
  @IsOptional()
  @IsUUID()
  supervisor_id?: string;

  @ApiPropertyOptional({ description: 'Personalized welcome message to include in invite email' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

// ─── Update Member Role DTO ───────────────────────────────────────────────────

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: MemberRole })
  @IsEnum(MemberRole)
  role: MemberRole;

  @ApiPropertyOptional({ description: 'Updated supervisor UUID' })
  @IsOptional()
  @IsUUID()
  supervisor_id?: string;

  @ApiPropertyOptional({ description: 'Reason for role change (audit trail)' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Plan Change DTO ──────────────────────────────────────────────────────────

export class ChangePlanDto {
  @ApiProperty({ enum: OrganizationPlan, description: 'Target plan to switch to' })
  @IsEnum(OrganizationPlan)
  plan: OrganizationPlan;

  @ApiPropertyOptional({ description: 'Updated seat count', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  seats?: number;

  @ApiPropertyOptional({ description: 'Effective date for plan change (ISO 8601), defaults to now' })
  @IsOptional()
  @IsString()
  effective_date?: string;
}
