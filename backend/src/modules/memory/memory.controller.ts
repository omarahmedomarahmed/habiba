import {
  Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateMemoryNodeDto,
  UpdateMemoryNodeDto,
  ExtractMemoryFromNoteDto,
  GetPatientMemoryQueryDto,
  SearchMemoryQueryDto,
  BuildAIContextQueryDto,
} from './dto/memory.dto';

@ApiTags('Memory Layer')
@ApiBearerAuth()
@Controller('memory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  // ─── Patient Memory ───────────────────────────────────────────────────────

  @Get('patient/:patientId')
  @Roles('therapist', 'org_admin', 'super_admin')
  @ApiOperation({
    summary: 'Get all memory nodes for a patient',
    description:
      'Returns the full structured memory graph for a patient, optionally filtered by node type, status, and depth.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'Patient memory nodes retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not treating therapist or insufficient role' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async getPatientMemory(
    @Param('patientId') patientId: string,
    @Query() query: GetPatientMemoryQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.getPatientMemory(patientId, user.therapist_id, user.organization_id, {
      node_types: query.node_types?.split(',') as any[],
      status: query.status,
      limit: query.limit,
      include_timeline: query.include_timeline,
      include_graph: query.include_graph,
    });
  }

  @Post('patient/:patientId/nodes')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Add a memory node for a patient',
    description: 'Manually create a structured memory node. Use the extract endpoint for AI-assisted extraction.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 201, description: 'Memory node created successfully' })
  async addMemoryNode(
    @Param('patientId') patientId: string,
    @Body() dto: CreateMemoryNodeDto,
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
  @ApiOperation({ summary: 'Update a memory node' })
  @ApiParam({ name: 'nodeId', description: 'UUID of the memory node' })
  @ApiResponse({ status: 200, description: 'Memory node updated successfully' })
  @ApiResponse({ status: 404, description: 'Memory node not found' })
  async updateMemoryNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateMemoryNodeDto,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.updateMemoryNode(nodeId, dto);
  }

  @Put('nodes/:nodeId/validate')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Validate an AI-extracted memory node',
    description: 'Therapist confirms that an AI-extracted memory node is clinically accurate.',
  })
  @ApiParam({ name: 'nodeId', description: 'UUID of the memory node to validate' })
  @ApiResponse({ status: 200, description: 'Memory node validated' })
  async validateMemoryNode(
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.validateMemoryNode(nodeId, user.therapist_id);
  }

  @Put('nodes/:nodeId/resolve')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'Mark a memory node as resolved',
    description: 'Marks a clinical issue (symptom, goal, etc.) as resolved. Moves to HISTORICAL status.',
  })
  @ApiParam({ name: 'nodeId', description: 'UUID of the memory node to resolve' })
  @ApiResponse({ status: 200, description: 'Memory node resolved' })
  async resolveMemoryNode(
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.resolveMemoryNode(nodeId, user.therapist_id);
  }

  @Delete('nodes/:nodeId')
  @Roles('therapist', 'org_admin')
  @ApiOperation({ summary: 'Delete a memory node' })
  @ApiParam({ name: 'nodeId', description: 'UUID of the memory node to delete' })
  @ApiResponse({ status: 200, description: 'Memory node deleted' })
  async deleteMemoryNode(
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.deleteMemoryNode(nodeId, user.therapist_id);
  }

  // ─── Intelligence & Context ───────────────────────────────────────────────

  @Get('patient/:patientId/intelligence')
  @Roles('therapist', 'org_admin', 'super_admin')
  @ApiOperation({
    summary: 'Get longitudinal intelligence for a patient',
    description:
      'Returns a high-level AI-generated intelligence summary synthesizing all memory nodes, ' +
      'trends, risks, strengths, and treatment trajectory across the full clinical history.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'Longitudinal intelligence retrieved' })
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
  @ApiOperation({
    summary: 'Build AI context for session preparation',
    description:
      'Builds a structured AI context package used by the Copilot to prepare for a therapy session. ' +
      'Depth controls how much historical data is included.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'AI context built successfully' })
  async buildAIContext(
    @Param('patientId') patientId: string,
    @Query() query: BuildAIContextQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.buildAIContext(
      patientId, user.therapist_id, user.organization_id,
      { depth: query.depth ?? 'standard' },
    );
  }

  @Get('patient/:patientId/timeline')
  @Roles('therapist', 'org_admin', 'super_admin')
  @ApiOperation({
    summary: 'Get chronological memory timeline',
    description:
      'Returns all memory events ordered chronologically, showing the clinical journey over time.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'Timeline retrieved' })
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
  @ApiOperation({
    summary: 'Get the knowledge graph for a patient',
    description:
      'Returns structured nodes and edges representing the clinical knowledge graph — ' +
      'showing connections between symptoms, triggers, beliefs, and coping strategies.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'Knowledge graph built' })
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
  @ApiOperation({
    summary: 'Full-text search across patient memory nodes',
    description: 'Search all memory nodes for a patient using semantic or keyword search.',
  })
  @ApiParam({ name: 'patientId', description: 'UUID of the patient' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async searchMemory(
    @Param('patientId') patientId: string,
    @Query() query: SearchMemoryQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.searchMemory(
      patientId, user.therapist_id, user.organization_id, query.q,
    );
  }

  // ─── AI Memory Extraction ─────────────────────────────────────────────────

  @Post('extract')
  @Roles('therapist', 'org_admin')
  @ApiOperation({
    summary: 'AI-extract memory nodes from a session note',
    description:
      'Runs GPT-4o over a session note to automatically identify and extract clinical memory nodes. ' +
      'Extracted nodes are created with is_ai_extracted=true and pending therapist validation.',
  })
  @ApiResponse({ status: 201, description: 'Memory extraction initiated' })
  async extractFromNote(
    @Body() dto: ExtractMemoryFromNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.memoryService.extractMemoriesFromNote(
      dto.note_id, dto.session_id, dto.patient_id,
      user.therapist_id, user.organization_id, dto.note_content,
    );
  }
}
