import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AIService } from './ai.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  private response(data: any) {
    return { success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } };
  }

  @Post('sessions/:sessionId/notes/generate')
  @ApiOperation({ summary: 'Generate AI clinical note (SOAP/DAP/BIRP)' })
  async generateNote(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { format?: string },
  ) {
    const result = await this.aiService.generateSOAPNote(
      sessionId, req.user.organization_id, req.user.id, body.format || 'soap',
    );
    return this.response(result);
  }

  @Post('sessions/:sessionId/summary')
  @ApiOperation({ summary: 'Generate AI session summary' })
  async generateSummary(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { type?: string },
  ) {
    const result = await this.aiService.generateSummary(sessionId, req.user.organization_id, body.type);
    return this.response(result);
  }

  @Get('sessions/:sessionId/copilot')
  @ApiOperation({ summary: 'Get live copilot suggestions for active session' })
  async getCopilot(@Request() req: any, @Param('sessionId') sessionId: string) {
    const result = await this.aiService.getCopilotSuggestions(
      sessionId, req.user.organization_id, req.user.id,
    );
    return this.response(result);
  }

  @Post('sessions/:sessionId/risk-check')
  @ApiOperation({ summary: 'Run AI risk assessment on session transcript' })
  async detectRisk(@Request() req: any, @Param('sessionId') sessionId: string) {
    const result = await this.aiService.detectRisk(sessionId, req.user.organization_id);
    return this.response(result);
  }

  @Patch('notes/:noteId/approve')
  @ApiOperation({ summary: 'Approve AI note (with optional edits)' })
  async approveNote(
    @Request() req: any,
    @Param('noteId') noteId: string,
    @Body() body: { edits?: any },
  ) {
    const result = await this.aiService.approveNote(
      noteId, req.user.organization_id, req.user.id, body.edits,
    );
    return this.response(result);
  }

  @Post('patients/:patientId/memory/search')
  @ApiOperation({ summary: 'Semantic memory search for patient' })
  async searchMemory(
    @Request() req: any,
    @Param('patientId') patientId: string,
    @Body() body: { query: string; limit?: number },
  ) {
    const memories = await this.aiService.semanticMemorySearch(
      patientId, req.user.organization_id, body.query, body.limit,
    );
    return this.response({ memories });
  }
}
