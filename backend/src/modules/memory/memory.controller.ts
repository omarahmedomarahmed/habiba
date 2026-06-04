import {
  Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards,
} from '@nestjs/common';
import { MemoryService } from './memory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('memory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  // ─── Patient Memory ───────────────────────────────────────────────────────

  @Get('patient/:patientId')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getPatientMemory(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.getPatientMemory(patientId, user.therapist_id, user.organization_id, {
      node_types: query.node_types?.split(','),
      status: query.status,
      limit: query.limit,
      include_timeline: query.include_timeline === 'true',
      include_graph: query.include_graph === 'true',
    });
  }

  @Post('patient/:patientId/nodes')
  @Roles('therapist', 'org_admin')
  async addMemoryNode(
    @Param('patientId') patientId: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.addMemoryNode({
      ...dto,
      patient_id: patientId,
      therapist_id: user.therapist_id,
      organization_id: user.organization_id,
      is_ai_extracted: false,
    });
  }

  @Put('nodes/:nodeId')
  @Roles('therapist', 'org_admin')
  async updateMemoryNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.updateMemoryNode(nodeId, dto);
  }

  @Put('nodes/:nodeId/validate')
  @Roles('therapist', 'org_admin')
  async validateMemoryNode(
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.validateMemoryNode(nodeId, user.therapist_id);
  }

  @Put('nodes/:nodeId/resolve')
  @Roles('therapist', 'org_admin')
  async resolveMemoryNode(
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.resolveMemoryNode(nodeId, user.therapist_id);
  }

  @Delete('nodes/:nodeId')
  @Roles('therapist', 'org_admin')
  async deleteMemoryNode(
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.deleteMemoryNode(nodeId, user.therapist_id);
  }

  // ─── Intelligence & Context ───────────────────────────────────────────────

  @Get('patient/:patientId/intelligence')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getLongitudinalIntelligence(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.getLongitudinalIntelligence(
      patientId, user.therapist_id, user.organization_id,
    );
  }

  @Get('patient/:patientId/context')
  @Roles('therapist', 'org_admin')
  async buildAIContext(
    @Param('patientId') patientId: string,
    @Query('depth') depth: 'brief' | 'standard' | 'comprehensive' = 'standard',
    @CurrentUser() user: any,
  ) {
    return this.memoryService.buildAIContext(
      patientId, user.therapist_id, user.organization_id, { depth },
    );
  }

  @Get('patient/:patientId/timeline')
  @Roles('therapist', 'org_admin', 'super_admin')
  async getMemoryTimeline(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.getMemoryTimeline(
      patientId, user.therapist_id, user.organization_id,
    );
  }

  @Get('patient/:patientId/graph')
  @Roles('therapist', 'org_admin')
  async getKnowledgeGraph(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.buildKnowledgeGraph(
      patientId, user.therapist_id, user.organization_id,
    );
  }

  @Get('patient/:patientId/search')
  @Roles('therapist', 'org_admin')
  async searchMemory(
    @Param('patientId') patientId: string,
    @Query('q') query: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.searchMemory(
      patientId, user.therapist_id, user.organization_id, query,
    );
  }

  // ─── AI Memory Extraction ─────────────────────────────────────────────────

  @Post('extract')
  @Roles('therapist', 'org_admin')
  async extractFromNote(
    @Body() dto: { note_id: string; session_id: string; patient_id: string; note_content: string },
    @CurrentUser() user: any,
  ) {
    return this.memoryService.extractMemoriesFromNote(
      dto.note_id, dto.session_id, dto.patient_id,
      user.therapist_id, user.organization_id, dto.note_content,
    );
  }
}
