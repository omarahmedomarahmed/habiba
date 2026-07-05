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

  @Post('users/:id/impersonate')
  async impersonateUser(
    @Param('id') id: string,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.impersonateUser(id, actor.id);
  }

  // ─── Therapist Profile (Admin) ────────────────────────────────────────────

  @Get('therapists/:id/profile')
  async getTherapistProfile(@Param('id') id: string) {
    return this.adminService.getTherapistProfile(id);
  }

  @Get('therapists/:id/overview')
  async getTherapistOverview(@Param('id') id: string) {
    return this.adminService.getTherapistOverview(id);
  }

  @Get('ai-usage')
  async getAIUsage(@Query() query: any) {
    return this.adminService.getAIUsage(query);
  }

  @Patch('therapists/:id/profile')
  async updateTherapistProfile(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateTherapistProfile(id, dto);
  }

  // ─── Compliance & Audit ───────────────────────────────────────────────────

  @Get('audit-log')
  async getAuditLog(@Query() query: any) {
    return this.adminService.getAuditLog(query);
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

  // ─── Subscriptions ────────────────────────────────────────────────────────

  @Get('subscriptions')
  async listAllSubscriptions(@Query() query: any) {
    return this.adminService.listAllSubscriptions(query);
  }

  @Patch('subscriptions/:id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.adminService.updateSubscription(id, dto, user.id);
  }

  // ─── Therapist Credentials ────────────────────────────────────────────────

  @Get('therapist-credentials')
  async listTherapistCredentials(@Query() query: any) {
    return this.adminService.listTherapistCredentials(query);
  }

  @Patch('therapist-credentials/:id')
  async updateTherapistCredential(
    @Param('id') id: string,
    @Body() dto: { status: string; rejection_reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.adminService.updateTherapistCredential(id, dto, user.id);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
