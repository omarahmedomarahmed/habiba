import { Controller, Get, Patch, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}
  r = (data: any) => ({ success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } });

  @Get('me') async getMyOrg(@Request() req: any) { return this.r({ organization: await this.orgsService.findOne(req.user.organization_id) }); }
  @Get('me/settings') async getSettings(@Request() req: any) { return this.r({ settings: await this.orgsService.getSettings(req.user.organization_id) }); }
  @Patch('me/settings') async updateSettings(@Request() req: any, @Body() dto: any) { return this.r({ settings: await this.orgsService.updateSettings(req.user.organization_id, dto) }); }
  @Get('me/stats') async getStats(@Request() req: any) { return this.r({ stats: await this.orgsService.getStats(req.user.organization_id) }); }

  @Get('me/audit-logs')
  @Roles('org_admin', 'super_admin')
  @ApiOperation({ summary: 'Get audit logs for the organization' })
  async getAuditLogs(@Query() query: any, @CurrentUser() user: any) {
    return this.orgsService.getAuditLogs(user.organization_id, query);
  }
}
