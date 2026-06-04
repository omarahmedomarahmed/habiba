import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}
  r = (data: any) => ({ success: true, data, meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' } });
  
  @Get()
  async getAll(@Request() req: any) {
    const data = await this.service.getAll(req.user.organization_id);
    return this.r({ data });
  }
}
