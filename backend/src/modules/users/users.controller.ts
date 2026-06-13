import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  r = (data: any) => ({ success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } });
  
  @Get()
  async getAll(@Request() req: any) {
    const data = await this.service.getAll(req.user.organization_id);
    return this.r({ data });
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
