import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SessionsService } from './sessions.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  private response(data: any) {
    return { success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get therapist dashboard statistics' })
  async getDashboard(@Request() req: any) {
    const stats = await this.sessionsService.getDashboardStats(req.user.organization_id, req.user.id);
    return this.response({ stats });
  }

  @Get()
  @ApiOperation({ summary: 'List sessions' })
  async findAll(@Request() req: any, @Query() query: any) {
    const sessions = await this.sessionsService.findAll(req.user.organization_id, query);
    return this.response({ sessions });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const session = await this.sessionsService.findOne(id, req.user.organization_id);
    return this.response({ session });
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get current therapist session usage and plan limits' })
  async getUsage(@Request() req: any) {
    const usage = await this.sessionsService.getTherapistUsage(req.user.id);
    return this.response({ usage });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new session' })
  async create(@Request() req: any, @Body() dto: any) {
    if (!dto.therapist_id) dto.therapist_id = req.user.id;
    try {
      const session = await this.sessionsService.create(req.user.organization_id, dto);
      return this.response({ session });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('UPGRADE_REQUIRED') || msg.startsWith('SESSION_LIMIT_REACHED')) {
        throw new HttpException({ success: false, error: 'payment_required', message: msg }, HttpStatus.PAYMENT_REQUIRED);
      }
      throw err;
    }
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update session status (start, end, cancel)' })
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const session = await this.sessionsService.updateStatus(id, req.user.organization_id, body.status, body);
    return this.response({ session });
  }

  @Get(':id/transcript')
  @ApiOperation({ summary: 'Get session transcript and segments' })
  async getTranscript(@Request() req: any, @Param('id') id: string) {
    const result = await this.sessionsService.getTranscript(id, req.user.organization_id);
    return this.response(result);
  }

  @Post(':id/transcript/segments')
  @ApiOperation({ summary: 'Add transcript segment (realtime)' })
  async addSegment(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const segment = await this.sessionsService.addTranscriptSegment(id, req.user.organization_id, dto);
    return this.response({ segment });
  }

  @Get(':id/note')
  @ApiOperation({ summary: 'Get AI-generated note for session' })
  async getNote(@Request() req: any, @Param('id') id: string) {
    const note = await this.sessionsService.getAINote(id, req.user.organization_id);
    return this.response({ note });
  }
}
