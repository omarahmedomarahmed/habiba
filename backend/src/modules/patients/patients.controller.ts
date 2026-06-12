import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PatientsService } from './patients.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  private response(data: any, req?: any) {
    return {
      success: true,
      data,
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all patients in organization' })
  async findAll(@Request() req: any, @Query() query: any) {
    const result = await this.patientsService.findAll(req.user.organization_id, query);
    return this.response(result);
  }

  // /me routes MUST come before /:id to avoid "me" being parsed as a UUID
  @Get('me')
  @ApiOperation({ summary: 'Get the current patient\'s own profile' })
  async findMe(@Request() req: any) {
    const patient = await this.patientsService.findByUserId(req.user.userId, req.user.organization_id);
    return this.response({ patient });
  }

  @Get('me/mood-trend')
  @ApiOperation({ summary: 'Get mood trend for current patient' })
  async myMoodTrend(@Request() req: any, @Query('days') days?: string) {
    const patient = await this.patientsService.findByUserId(req.user.userId, req.user.organization_id);
    const data = await this.patientsService.getMoodTrend(patient.id, req.user.organization_id, days ? Number(days) : 30);
    return this.response(data);
  }

  @Post('me/mood')
  @ApiOperation({ summary: 'Log a mood entry for current patient' })
  async addMyMood(@Request() req: any, @Body() dto: any) {
    const patient = await this.patientsService.findByUserId(req.user.userId, req.user.organization_id);
    const entry = await this.patientsService.addMoodEntry(patient.id, req.user.organization_id, dto);
    return this.response({ entry });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID with full profile' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const patient = await this.patientsService.findOne(id, req.user.organization_id);
    return this.response({ patient });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new patient' })
  async create(@Request() req: any, @Body() dto: any) {
    const patient = await this.patientsService.create(
      req.user.organization_id,
      req.user.id,
      dto,
    );
    return this.response({ patient });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient details' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const patient = await this.patientsService.update(id, req.user.organization_id, dto);
    return this.response({ patient });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete patient' })
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.patientsService.softDelete(id, req.user.organization_id);
    return this.response({ message: 'Patient archived successfully' });
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get patient timeline events' })
  async getTimeline(@Request() req: any, @Param('id') id: string, @Query('limit') limit?: number) {
    const timeline = await this.patientsService.getTimeline(id, req.user.organization_id, limit);
    return this.response({ timeline });
  }

  @Get(':id/mood')
  @ApiOperation({ summary: 'Get patient mood trend data' })
  async getMoodTrend(@Request() req: any, @Param('id') id: string, @Query('days') days?: number) {
    const mood = await this.patientsService.getMoodTrend(id, req.user.organization_id, days);
    return this.response({ mood_entries: mood });
  }

  @Post(':id/mood')
  @ApiOperation({ summary: 'Add mood entry for patient' })
  async addMoodEntry(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const entry = await this.patientsService.addMoodEntry(id, req.user.organization_id, dto);
    return this.response({ mood_entry: entry });
  }

  @Get(':id/assessments')
  @ApiOperation({ summary: 'Get patient assessments' })
  async getAssessments(@Request() req: any, @Param('id') id: string) {
    const assessments = await this.patientsService.getAssessments(id, req.user.organization_id);
    return this.response({ assessments });
  }

  @Get(':id/memories')
  @ApiOperation({ summary: 'Get patient AI memories' })
  async getMemories(@Request() req: any, @Param('id') id: string) {
    const memories = await this.patientsService.getMemories(id, req.user.organization_id);
    return this.response({ memories });
  }
}
