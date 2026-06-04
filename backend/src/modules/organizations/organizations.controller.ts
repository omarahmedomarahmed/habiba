import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationsService } from './organizations.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}
  r = (data: any) => ({ success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } });

  @Get('me') async getMyOrg(@Request() req: any) { return this.r({ organization: await this.orgsService.findOne(req.user.organization_id) }); }
  @Get('me/settings') async getSettings(@Request() req: any) { return this.r({ settings: await this.orgsService.getSettings(req.user.organization_id) }); }
  @Patch('me/settings') async updateSettings(@Request() req: any, @Body() dto: any) { return this.r({ settings: await this.orgsService.updateSettings(req.user.organization_id, dto) }); }
  @Get('me/stats') async getStats(@Request() req: any) { return this.r({ stats: await this.orgsService.getStats(req.user.organization_id) }); }
}
