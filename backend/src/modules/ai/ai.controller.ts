import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AIService } from './ai.service';
import { Public } from '../auth/decorators/public.decorator';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  private response(data: any) {
    return {
      success: true,
      data,
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC — Anonymous AI chat (marketing site free trial, no auth required)
  // Rate-limited by IP at the API gateway / NestJS throttler level.
  // ──────────────────────────────────────────────────────────────────────────

  @Public()
  @Post('chat/anonymous')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 }, long: { ttl: 3600000, limit: 30 } })
  @ApiOperation({
    summary: 'Anonymous AI chat for marketing free trial (no auth required)',
    description: 'Public endpoint used by /chat and homepage widget. No PHI stored. Limited to basic support conversations.',
  })
  @ApiBody({ schema: { properties: { message: { type: 'string' }, anonymous: { type: 'boolean' } } } })
  async anonymousChat(@Body() body: { message: string; anonymous?: boolean }) {
    const reply = await this.aiService.anonymousChat(body.message);
    return this.response({ message: reply });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROTECTED — All endpoints below require JWT
  // ──────────────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('sessions/:sessionId/copilot')
  @ApiOperation({ summary: 'Get live copilot suggestions for active session' })
  async getCopilot(@Request() req: any, @Param('sessionId') sessionId: string) {
    const result = await this.aiService.getCopilotSuggestions(
      sessionId, req.user.organization_id, req.user.id,
    );
    return this.response(result);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('sessions/:sessionId/risk-check')
  @ApiOperation({ summary: 'Run AI risk assessment on session transcript' })
  async detectRisk(@Request() req: any, @Param('sessionId') sessionId: string) {
    const result = await this.aiService.detectRisk(sessionId, req.user.organization_id);
    return this.response(result);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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
