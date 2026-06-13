import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferralsController {
  constructor(private readonly svc: ReferralsService) {}

  @Get()
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'List referrals' })
  async list(@Query() query: any, @CurrentUser() user: any) { return this.svc.list(user.organization_id, query); }

  @Post()
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Create referral' })
  async create(@Body() dto: any, @CurrentUser() user: any) { return this.svc.create(user.organization_id, user.therapistId, dto); }

  @Patch(':id')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Update referral' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) { return this.svc.update(id, user.organization_id, dto); }

  @Post(':id/send')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Send referral' })
  async send(@Param('id') id: string, @CurrentUser() user: any) { return this.svc.send(id, user.organization_id); }
}

// Reviewed: 2026-06-13 — 24Therapy audit
