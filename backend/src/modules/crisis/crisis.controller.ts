import {
  Controller, Get, Post, Param, Query, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CrisisService } from './crisis.service';
import { ListAlertsQueryDto } from './dto/crisis.dto';

@ApiTags('crisis')
@ApiBearerAuth()
@Controller('crisis')
export class CrisisController {
  constructor(private readonly service: CrisisService) {}

  @Get('alerts')
  async listAlerts(@Request() req: any, @Query() query: ListAlertsQueryDto) {
    const data = await this.service.listAlerts(
      req.user.userId, req.user.organization_id, req.user.role, query,
    );
    return { data };
  }

  @Post('alerts/:id/acknowledge')
  async acknowledge(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const data = await this.service.acknowledgeAlert(
      id, req.user.userId, req.user.organization_id, req.user.role,
    );
    return { data };
  }

  @Get('alerts/active-count')
  async activeCount(@Request() req: any) {
    const data = await this.service.getActiveCount(req.user.organization_id);
    return { data };
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
