import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get()
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'List reports' })
  async list(@Query() query: any, @CurrentUser() user: any) { return this.svc.list(user.organization_id, query); }

  @Post()
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Generate report' })
  async generate(@Body() dto: any, @CurrentUser() user: any) { return this.svc.generate(user.organization_id, user.therapistId, dto); }

  @Post(':id/sign')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Sign report' })
  async sign(@Param('id') id: string, @CurrentUser() user: any) { return this.svc.sign(id, user.organization_id); }

  @Post(':id/send')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Send report' })
  async send(@Param('id') id: string, @CurrentUser() user: any) { return this.svc.send(id, user.organization_id); }
}

// Reviewed: 2026-06-13 — 24Therapy audit
