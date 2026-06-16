import { Controller, Get, Post, Patch, Param, Body, Request, Query } from '@nestjs/common';
import { CrmService } from './crm.service';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('leads')
  listLeads(@Request() req: any, @Query() query: any) {
    return this.crmService.listLeads(req.user.organizationId, query);
  }

  @Get('leads/:id')
  getLead(@Request() req: any, @Param('id') id: string) {
    return this.crmService.getLead(id, req.user.organizationId);
  }

  @Post('leads')
  createLead(@Request() req: any, @Body() body: any) {
    return this.crmService.createLead(req.user.organizationId, body);
  }

  @Patch('leads/:id')
  updateLead(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.crmService.updateLead(id, req.user.organizationId, body);
  }

  @Get('pipeline/stats')
  pipelineStats(@Request() req: any) {
    return this.crmService.getPipelineStats(req.user.organizationId);
  }

  @Get('analytics')
  analytics(@Request() req: any, @Query('period') period: string) {
    return this.crmService.getAnalytics(req.user.organizationId, period);
  }
}
