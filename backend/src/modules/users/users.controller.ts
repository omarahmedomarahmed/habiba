import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
}

// Reviewed: 2026-06-13 — 24Therapy audit
