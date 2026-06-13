import {
  Controller, Get, Post, Put, Patch, Body, Query, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateWorkflowDto,
  UpdateWorkflowStatusDto,
  CompleteWorkflowTaskDto,
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  ListWorkflowsQueryDto,
  ListWorkflowTemplatesQueryDto,
} from './dto/workflows.dto';

@ApiTags('Workflows & Treatment Plans')
@ApiBearerAuth()
@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({
    summary: 'List workflow templates',
    description:
      'Returns all available workflow templates. Templates can be filtered by category and searched. ' +
      '40+ pre-built templates covering clinical, billing, compliance, and practice operations.',
  })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  async listTemplates(@Query() query: ListWorkflowTemplatesQueryDto) {
    return this.workflowsService.listWorkflowTemplates(query);
  }

  @Get('protocols')
  @ApiOperation({
    summary: 'Get clinical care protocols',
    description:
      'Returns structured clinical care protocols (e.g., PHQ-9 escalation, crisis intervention, ' +
      'discharge planning) that can be applied as workflow blueprints.',
  })
  @ApiResponse({ status: 200, description: 'Care protocols retrieved' })
  async getCareProtocols() {
    return this.workflowsService.getCareProtocols();
  }

  // ─── Workflows ────────────────────────────────────────────────────────────

  @Get()
  @Roles('therapist', 'org_admin', 'super_admin')
  @ApiOperation({
    summary: 'List workflows for the organization',
    description:
      'Returns all active and historical workflows scoped to the current organization. ' +
      'Supports filtering by status, category, and patient.',
  })
  @ApiResponse({ status: 200, description: 'Workflows retrieved' })
  async listWorkflows(
    @Query() query: ListWorkflowsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.listWorkflows(user.organization_id, query);
  }

  @Get('pending')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Get pending workflows requiring therapist action',
    description: 'Returns workflows with tasks awaiting completion by the current therapist.',
  })
  @ApiResponse({ status: 200, description: 'Pending workflows retrieved' })
  async getPendingWorkflows(@CurrentUser() user: any) {
    return this.workflowsService.getPendingWorkflows(user.therapistId, user.organization_id);
  }

  @Get('analytics/summary')
  @Roles('org_admin', 'super_admin')
  @ApiOperation({
    summary: 'Get workflow analytics summary for the organization',
    description:
      'Returns aggregated workflow metrics: completion rates, average time to complete, ' +
      'most triggered workflows, and bottleneck analysis.',
  })
  @ApiResponse({ status: 200, description: 'Analytics summary retrieved' })
  async getAnalytics(@CurrentUser() user: any) {
    return this.workflowsService.getWorkflowAnalytics(user.organization_id);
  }

  @Get(':id')
  @Roles('therapist', 'org_admin', 'super_admin')
  @ApiOperation({ summary: 'Get a specific workflow by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow' })
  @ApiResponse({ status: 200, description: 'Workflow retrieved' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getWorkflow(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.getWorkflow(id, user.organization_id);
  }

  @Post()
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Create a new workflow',
    description:
      'Creates a new workflow with the specified trigger and action sequence. ' +
      'Can be based on a template or built from scratch. If activate_immediately is true, ' +
      'the workflow starts listening for triggers immediately.',
  })
  @ApiResponse({ status: 201, description: 'Workflow created' })
  async createWorkflow(
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.createWorkflow({
      ...dto,
      organization_id: user.organization_id,
      therapist_id: user.therapistId,
    } as any);
  }

  @Put(':id/status')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Update workflow status (activate, pause, cancel)',
    description: 'Change the lifecycle status of a workflow.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the workflow' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.updateWorkflowStatus(id, dto.status as any, user.organization_id);
  }

  // ─── Homework ─────────────────────────────────────────────────────────────

  @Post('homework')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Assign homework to a patient',
    description: 'Creates a homework workflow with a single patient-visible task (appears in the patient portal).',
  })
  @ApiResponse({ status: 201, description: 'Homework assigned' })
  async assignHomework(@Body() dto: any, @CurrentUser() user: any) {
    return this.workflowsService.createHomework(user.organization_id, user.therapistId, dto);
  }

  @Get('homework/mine')
  @Roles('patient')
  @ApiOperation({ summary: 'List my homework (patient portal)' })
  @ApiResponse({ status: 200, description: 'Homework tasks retrieved' })
  async myHomework(@CurrentUser() user: any) {
    return this.workflowsService.listPatientHomework(user.organization_id, user.patientId);
  }

  @Patch('tasks/:taskId/start')
  @Roles('patient', 'therapist', 'org_admin')
  @ApiOperation({ summary: 'Start a task by id' })
  @ApiParam({ name: 'taskId', description: 'UUID of the task' })
  @ApiResponse({ status: 200, description: 'Task started' })
  async startTaskById(
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.startTaskById(taskId, user.organization_id, user);
  }

  @Patch('tasks/:taskId/complete')
  @Roles('patient', 'therapist', 'org_admin')
  @ApiOperation({
    summary: 'Complete a task by id',
    description: 'Patient-friendly completion (no workflow id needed). Patients can only complete their own homework tasks.',
  })
  @ApiParam({ name: 'taskId', description: 'UUID of the task' })
  @ApiResponse({ status: 200, description: 'Task completed' })
  async completeTaskById(
    @Param('taskId') taskId: string,
    @Body() body: { note?: string },
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.completeTaskById(taskId, user.organization_id, user, body?.note);
  }

  @Put(':workflowId/tasks/:taskId/complete')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Mark a workflow task as completed',
    description:
      'Complete a specific task within a workflow. Triggers the next task in sequence if configured.',
  })
  @ApiParam({ name: 'workflowId', description: 'UUID of the parent workflow' })
  @ApiParam({ name: 'taskId', description: 'UUID of the task to complete' })
  @ApiResponse({ status: 200, description: 'Task completed' })
  async completeTask(
    @Param('workflowId') workflowId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CompleteWorkflowTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.completeWorkflowTask(
      taskId, workflowId, user.organization_id, dto,
    );
  }

  // ─── Treatment Plans ──────────────────────────────────────────────────────

  @Get('treatment-plans/:patientId')
  @Roles('therapist', 'org_admin', 'super_admin')
  @ApiOperation({
    summary: 'Get treatment plan for a patient',
    description: 'Returns the current active treatment plan, including goals, interventions, and progress.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'Treatment plan retrieved' })
  @ApiResponse({ status: 404, description: 'No active treatment plan found for patient' })
  async getTreatmentPlan(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.getTreatmentPlan(patientId, user.organization_id);
  }

  @Post('treatment-plans')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Create a treatment plan',
    description:
      'Creates a new evidence-based treatment plan for a patient. ' +
      'Includes primary and secondary diagnoses, therapeutic approach, ' +
      'SMART goals, clinical interventions, and target session count.',
  })
  @ApiResponse({ status: 201, description: 'Treatment plan created' })
  async createTreatmentPlan(
    @Body() dto: CreateTreatmentPlanDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.createTreatmentPlan({
      ...dto,
      therapist_id: user.therapistId,
      organization_id: user.organization_id,
    } as any);
  }

  @Put('treatment-plans/:id')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Update a treatment plan',
    description:
      'Update goals, interventions, status, or clinical notes. ' +
      'All updates are tracked for clinical audit trail.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the treatment plan' })
  @ApiResponse({ status: 200, description: 'Treatment plan updated' })
  async updateTreatmentPlan(
    @Param('id') id: string,
    @Body() dto: UpdateTreatmentPlanDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.updateTreatmentPlan(id, user.organization_id, dto);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
