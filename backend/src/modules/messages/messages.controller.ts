import {
  Controller, Get, Post, Param, Body, Query, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateConversationDto, SendMessageDto, ListMessagesQueryDto } from './dto/messages.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get('conversations')
  async listConversations(@Request() req: any) {
    const data = await this.service.listConversations(req.user.userId, req.user.organization_id);
    return { data };
  }

  @Post('conversations')
  async createConversation(@Request() req: any, @Body() dto: CreateConversationDto) {
    const data = await this.service.createOrGetConversation(req.user.userId, req.user.organization_id, dto);
    return { data };
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Query() query: ListMessagesQueryDto,
  ) {
    const data = await this.service.listMessages(id, req.user.userId, req.user.organization_id, query);
    return { data };
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: SendMessageDto,
  ) {
    const data = await this.service.sendMessage(id, req.user.userId, req.user.organization_id, dto);
    return { data };
  }

  @Post('conversations/:id/read')
  async markRead(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const data = await this.service.markRead(id, req.user.userId, req.user.organization_id);
    return { data };
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
