import {
  Controller, Get, Post, Body, Query, Param, UseGuards, Request,
} from '@nestjs/common';
import { AnalyticsService, EventTrackingDto } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── Event Tracking ─────────────────────────────────────────────────────────

  @Post('events/track')
  async trackEvent(@Body() dto: EventTrackingDto, @CurrentUser() user: any) {
    return this.analyticsService.trackEvent({
      ...dto,
      user_id: dto.user_id || user.id,
      organization_id: dto.organization_id || user.organization_id,
    });
  }

  @Post('events/batch')
  async trackBatch(@Body() body: { events: EventTrackingDto[] }, @CurrentUser() user: any) {
    const events = (body.events || []).map((e) => ({
      ...e,
      user_id: e.user_id || user.id,
      organization_id: e.organization_id || user.organization_id,
    }));
    return this.analyticsService.trackBatch(events);
  }

  @Get('events')
  @Roles('org_admin', 'therapist', 'super_admin')
  async getEventStream(@Query() query: any, @CurrentUser() user: any) {
    return this.analyticsService.getEventStream(user.organization_id, query);
  }

  // ─── Platform Dashboard (Super Admin) ──────────────────────────────────────

  @Get('platform/dashboard')
  @Roles('super_admin')
  async getPlatformDashboard(@Query('period') period: string = '30d') {
    return this.analyticsService.getPlatformDashboard(period);
  }

  // ─── Organization Analytics ──────────────────────────────────────────────

  @Get('org/dashboard')
  @Roles('org_admin', 'super_admin')
  async getOrgAnalytics(
    @Query('period') period: string = '30d',
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getOrgAnalytics(user.organization_id, period);
  }

  @Get('org/:orgId/dashboard')
  @Roles('super_admin')
  async getOrgAnalyticsById(
    @Param('orgId') orgId: string,
    @Query('period') period: string = '30d',
  ) {
    return this.analyticsService.getOrgAnalytics(orgId, period);
  }

  // ─── Therapist Analytics ──────────────────────────────────────────────────

  @Get('therapist/dashboard')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getTherapistAnalytics(
    @Query('period') period: string = '30d',
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getTherapistAnalytics(user.therapistId, user.organization_id, period);
  }

  @Get('therapist/:therapistId/dashboard')
  @Roles('org_admin', 'super_admin')
  async getTherapistAnalyticsById(
    @Param('therapistId') therapistId: string,
    @Query('period') period: string = '30d',
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getTherapistAnalytics(therapistId, user.organization_id, period);
  }

  // ─── AI Cost Analytics ────────────────────────────────────────────────────

  @Get('ai/costs')
  @Roles('org_admin', 'super_admin')
  async getAICosts(@Query('period') period: string = '30d', @CurrentUser() user: any) {
    return this.analyticsService.getAICostAnalytics(user.organization_id, period);
  }

  // ─── Outcome Metrics ────────────────────────────────────────────────────

  @Get('outcomes')
  @Roles('org_admin', 'therapist', 'super_admin')
  async getOutcomeMetrics(
    @Query('period') period: string = '90d',
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getOutcomeMetrics(user.organization_id, period);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
