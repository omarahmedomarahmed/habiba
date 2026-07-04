import { Controller, Get, Patch, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  async getAll(
    @Request() req: any,
    @Query() query: { search?: string; role?: string; status?: string; page?: string; limit?: string },
  ) {
    return this.service.getAll(req.user.organization_id, {
      search: query.search,
      role: query.role,
      status: query.status,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change the current user password' })
  async changePassword(
    @Request() req: any,
    @Body() body: { current_password: string; new_password: string },
  ) {
    return this.service.changePassword(req.user.id, body.current_password, body.new_password);
  }

  @Get('me/notification-preferences')
  @ApiOperation({ summary: 'Get the current user notification preferences' })
  async getNotificationPreferences(@Request() req: any) {
    return this.service.getNotificationPreferences(req.user.id);
  }

  @Patch('me/notification-preferences')
  @ApiOperation({ summary: 'Update the current user notification preferences' })
  async updateNotificationPreferences(@Request() req: any, @Body() body: Record<string, unknown>) {
    return this.service.updateNotificationPreferences(req.user.id, body);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
