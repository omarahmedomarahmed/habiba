import {
  Controller, Get, Post, Put, Body, Query, Param, UseGuards,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get('templates')
  async listTemplates(@Query() query: any) {
    return this.workflowsService.listWorkflowTemplates(query);
  }

  @Get('protocols')
  async getCareProtocols() {
    return this.workflowsService.getCareProtocols();
  }

  @Get()
  @Roles('therapist', 'org_admin', 'super_admin')
  async listWorkflows(@Query() query: any, @CurrentUser() user: any) {
    return this.workflowsService.listWorkflows(user.organization_id, query);
  }

  @Get('pending')
  @Roles('therapist', 'org_admin')
  async getPendingWorkflows(@CurrentUser() user: any) {
    return this.workflowsService.getPendingWorkflows(user.therapist_id, user.organization_id);
  }

  @Get(':id')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getWorkflow(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workflowsService.getWorkflow(id, user.organization_id);
  }

  @Post()
  @Roles('therapist', 'org_admin')
  async createWorkflow(@Body() dto: any, @CurrentUser() user: any) {
    return this.workflowsService.createWorkflow({
      ...dto,
      organization_id: user.organization_id,
      therapist_id: user.therapist_id,
    });
  }

  @Put(':id/status')
  @Roles('therapist', 'org_admin')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: any,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.updateWorkflowStatus(id, status, user.organization_id);
  }

  @Put(':workflowId/tasks/:taskId/complete')
  @Roles('therapist', 'org_admin')
  async completeTask(
    @Param('workflowId') workflowId: string,
    @Param('taskId') taskId: string,
    @Body() result: any,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.completeWorkflowTask(taskId, workflowId, user.organization_id, result);
  }

  @Get('analytics/summary')
  @Roles('org_admin', 'super_admin')
  async getAnalytics(@CurrentUser() user: any) {
    return this.workflowsService.getWorkflowAnalytics(user.organization_id);
  }

  // Treatment Plans
  @Get('treatment-plans/:patientId')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getTreatmentPlan(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.workflowsService.getTreatmentPlan(patientId, user.organization_id);
  }

  @Post('treatment-plans')
  @Roles('therapist', 'org_admin')
  async createTreatmentPlan(@Body() dto: any, @CurrentUser() user: any) {
    return this.workflowsService.createTreatmentPlan({
      ...dto,
      therapist_id: user.therapist_id,
      organization_id: user.organization_id,
    });
  }

  @Put('treatment-plans/:id')
  @Roles('therapist', 'org_admin')
  async updateTreatmentPlan(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.updateTreatmentPlan(id, user.organization_id, dto);
  }
}
