import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TreatmentPlansService } from './treatment-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Treatment Plans')
@ApiBearerAuth()
@Controller('treatment-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreatmentPlansController {
  constructor(private readonly svc: TreatmentPlansService) {}

  @Get('protocols')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Get clinical care protocols' })
  async getProtocols() { return this.svc.getProtocols(); }

  @Get()
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'List treatment plans' })
  async list(@Query() query: any, @CurrentUser() user: any) {
    return this.svc.list(user.organization_id, query);
  }

  @Post()
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Create treatment plan' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.svc.create(user.organization_id, user.therapistId, dto);
  }

  @Get(':id')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Get treatment plan' })
  async getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getOne(id, user.organization_id);
  }

  @Patch(':id')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Update treatment plan' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.svc.update(id, user.organization_id, dto);
  }

  @Get(':id/goals')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Get goals for treatment plan' })
  async getGoals(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getGoals(id, user.organization_id);
  }

  @Post(':id/goals')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Add goal to treatment plan' })
  async addGoal(@Param('id') id: string, @Body() goal: any, @CurrentUser() user: any) {
    return this.svc.addGoal(id, user.organization_id, goal);
  }
}
