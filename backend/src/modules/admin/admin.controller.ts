import {
  Controller, Get, Post, Put, Patch, Delete, Body, Query, Param,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Platform Dashboard ───────────────────────────────────────────────────

  @Get('dashboard')
  async getPlatformOverview() {
    return this.adminService.getPlatformOverview();
  }

  @Get('health')
  async getSystemHealth() {
    return this.adminService.getSystemHealthDetailed();
  }

  // ─── Organizations ────────────────────────────────────────────────────────

  @Get('organizations')
  async listOrganizations(@Query() query: any) {
    return this.adminService.listOrganizations(query);
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id') id: string) {
    return this.adminService.getOrganization(id);
  }

  @Put('organizations/:id')
  async updateOrganization(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateOrganization(id, dto);
  }

  @Post('organizations/:id/suspend')
  async suspendOrganization(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.suspendOrganization(id, reason, user.id);
  }

  @Post('organizations/:id/activate')
  async activateOrganization(@Param('id') id: string, @CurrentUser() user: any) {
    return this.adminService.activateOrganization(id, user.id);
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  async listUsers(@Query() query: any) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.updateUserRole(id, role, user.id);
  }

  @Post('users/:id/deactivate')
  async deactivateUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.deactivateUser(id, reason, user.id);
  }

  // ─── Compliance & Audit ───────────────────────────────────────────────────

  @Get('audit-log')
  async getAuditLog(@Query() query: any) {
    return this.adminService.getAuditLog(query);
  }

  @Get('compliance/:orgId')
  async getComplianceReport(@Param('orgId') orgId: string) {
    return this.adminService.getComplianceReport(orgId);
  }

  // ─── Feature Flags ────────────────────────────────────────────────────────

  @Get('feature-flags')
  async getFeatureFlags() {
    return this.adminService.getFeatureFlags();
  }

  @Put('feature-flags/:key')
  @Patch('feature-flags/:key')
  async setFeatureFlag(
    @Param('key') key: string,
    @Body('enabled') enabled: boolean,
    @Body('rollout_pct') rolloutPct: number | undefined,
    @CurrentUser() user: any,
  ) {
    return this.adminService.setFeatureFlag(key, enabled, null, user.id);
  }

  // ─── Marketplace ──────────────────────────────────────────────────────────

  @Get('marketplace')
  async listMarketplaceItems(@Query() query: any) {
    return this.adminService.listMarketplaceItems(query);
  }

  @Post('marketplace/:id/approve')
  async approveMarketplaceItem(@Param('id') id: string, @CurrentUser() user: any) {
    return this.adminService.approveMarketplaceItem(id, user.id);
  }

  @Post('marketplace/:id/reject')
  async rejectMarketplaceItem(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.rejectMarketplaceItem(id, reason, user.id);
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  @Post('notifications/send')
  async sendSystemNotification(@Body() dto: any, @CurrentUser() user: any) {
    return this.adminService.sendSystemNotification(dto, user.id);
  }

  // ─── Platform Config ──────────────────────────────────────────────────────

  @Get('config')
  async getPlatformConfig() {
    return this.adminService.getPlatformConfig();
  }

  @Put('config/:key')
  async updatePlatformConfig(
    @Param('key') key: string,
    @Body('value') value: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.updatePlatformConfig(key, value, user.id);
  }

  // ─── Billing ──────────────────────────────────────────────────────────────

  @Get('billing/overview')
  async getBillingOverview() {
    return this.adminService.getBillingOverview();
  }

  // ─── AI Governance ────────────────────────────────────────────────────────

  @Get('ai/governance')
  async getAIGovernanceDashboard() {
    return this.adminService.getAIGovernanceDashboard();
  }

  // ─── Emergency Access (Break-Glass) — HIPAA §164.312(a)(2)(ii) ───────────

  @Post('break-glass')
  async breakGlassAccess(
    @Body() body: { target_user_id?: string; reason: string; resources: string[] },
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.adminService.recordBreakGlassAccess({
      adminUserId: user.id,
      targetUserId: body.target_user_id,
      reason: body.reason,
      resources: body.resources,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Get('break-glass')
  async listBreakGlassEvents(@Query() query: any) {
    return this.adminService.listBreakGlassEvents(query);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
