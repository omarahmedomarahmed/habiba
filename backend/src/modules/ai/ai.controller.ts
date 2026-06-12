import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, HttpCode, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AIService } from './ai.service';
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
  // PROTECTED — All endpoints below require JWT
  // (anonymous chat moved to AIPublicController — POST /ai/chat/anonymous)
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('sessions/:sessionId/transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  @ApiOperation({ summary: 'Transcribe audio chunk via Whisper and add to session transcript' })
  async transcribeAudio(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.aiService.transcribeAudio(
      sessionId, req.user.organization_id, file,
    );
    return this.response(result);
  }

  // ─── Therapist AI Assistant ────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('assistant/chat')
  @ApiOperation({ summary: 'Chat with the AI practice assistant about your sessions' })
  async assistantChat(
    @Request() req: any,
    @Body() body: {
      message: string;
      range?: 'today' | 'this_week' | 'last_week';
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
  ) {
    const therapistId = req.user.therapist_id || req.user.id;
    try {
      const result = await this.aiService.assistantChat(
        therapistId,
        req.user.organization_id,
        body.message,
        body.range,
        body.history || [],
      );
      return this.response(result);
    } catch (err: any) {
      if (err.message === 'CREDITS_EXHAUSTED') {
        return {
          success: false,
          error: 'credits_exhausted',
          credits_balance: 0,
          upsell: err.upsell || 'Upgrade for unlimited messages.',
        };
      }
      throw err;
    }
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('assistant/credits')
  @ApiOperation({ summary: 'Get AI assistant credit balance' })
  async getAssistantCredits(@Request() req: any) {
    const therapistId = req.user.therapist_id || req.user.id;
    const result = await this.aiService.getAssistantCredits(therapistId);
    return this.response(result);
  }
}
