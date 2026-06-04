import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  r = (data: any) => ({ success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } });
  
  @Get()
  async getAll(@Request() req: any) {
    const data = await this.service.getAll(req.user.organization_id);
    return this.r({ data });
  }
}
