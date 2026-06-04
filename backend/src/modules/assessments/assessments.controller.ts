import {
  Controller, Get, Post, Put, Body, Query, Param, UseGuards,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @Get('templates')
  async listTemplates(@Query() query: any) {
    return this.assessmentsService.listTemplates(query);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.assessmentsService.getTemplate(id);
  }

  // ─── Patient Assessments ──────────────────────────────────────────────────

  @Get('patient/:patientId')
  @Roles('therapist', 'org_admin', 'super_admin')
  async listPatientAssessments(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.listPatientAssessments(patientId, user.organization_id, query);
  }

  @Post('patient/:patientId')
  @Roles('therapist', 'org_admin')
  async createAssessment(
    @Param('patientId') patientId: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.createAssessment({
      ...dto,
      patient_id: patientId,
      therapist_id: user.therapist_id,
      organization_id: user.organization_id,
    });
  }

  @Get(':id')
  @Roles('therapist', 'org_admin', 'super_admin', 'patient')
  async getAssessment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.assessmentsService.getAssessment(id, user.organization_id);
  }

  @Post(':id/submit')
  async submitAssessment(
    @Param('id') id: string,
    @Body() body: { responses: Record<string, number> },
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.submitAssessment(id, body.responses, user.organization_id, user.id);
  }

  // ─── Trends & Insights ───────────────────────────────────────────────────

  @Get('patient/:patientId/trends')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getPatientTrends(
    @Param('patientId') patientId: string,
    @Query('template_code') templateCode: string,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.getPatientAssessmentTrends(patientId, user.organization_id, templateCode);
  }

  @Get('patient/:patientId/insights')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getAssessmentInsights(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.getAssessmentInsights(patientId, user.organization_id);
  }

  @Get('patient/:patientId/report')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getProgressReport(
    @Param('patientId') patientId: string,
    @Query() dateRange: any,
    @CurrentUser() user: any,
  ) {
    return this.assessmentsService.generateProgressReport(patientId, user.organization_id, dateRange);
  }

  @Get('scheduled/list')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getScheduledAssessments(@Query() filters: any, @CurrentUser() user: any) {
    return this.assessmentsService.getScheduledAssessments(user.organization_id, {
      ...filters,
      therapist_id: filters.all ? undefined : user.therapist_id,
    });
  }
}
