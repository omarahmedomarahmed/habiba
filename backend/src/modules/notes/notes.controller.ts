import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { ListNotesQueryDto, CreateNoteDto, UpdateNoteDto } from './dto/notes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('therapist', 'org_admin', 'super_admin')
@Controller('notes')
export class NotesController {
  constructor(private readonly service: NotesService) {}

  // Therapists see their own notes; org admins see the whole organization.
  private scopeTherapist(req: any): string | null {
    if (req.user.role === 'org_admin' || req.user.role === 'super_admin') return null;
    return req.user.therapistId || null;
  }

  @Get()
  @ApiOperation({ summary: 'List clinical notes' })
  async list(@Request() req: any, @Query() query: ListNotesQueryDto) {
    const data = await this.service.list(req.user.organization_id, this.scopeTherapist(req), query);
    return { data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a clinical note' })
  async findOne(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.findOne(id, req.user.organization_id);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a manual draft note for a session' })
  async create(@Request() req: any, @Body() dto: CreateNoteDto) {
    const data = await this.service.create(req.user.organization_id, req.user.userId, dto);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update note content (merges sections, bumps version)' })
  async update(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto) {
    const data = await this.service.update(id, req.user.organization_id, dto);
    return { data };
  }

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Finalize (approve) a note' })
  async finalize(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.finalize(id, req.user.organization_id, req.user.userId);
    return { data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a note' })
  async remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.archive(id, req.user.organization_id);
    return { data };
  }
}
