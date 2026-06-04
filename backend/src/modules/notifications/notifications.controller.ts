import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { v4 as uuidv4 } from 'uuid';

class UpdatePreferencesDto {
  email_enabled?: boolean;
  sms_enabled?: boolean;
  push_enabled?: boolean;
  in_app_enabled?: boolean;
  session_reminders?: boolean;
  session_reminder_minutes?: number[];
  risk_alerts?: boolean;
  note_generated_alerts?: boolean;
  assessment_reminders?: boolean;
  billing_alerts?: boolean;
  marketing_emails?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
}

class SendNotificationDto {
  userId: string;
  organizationId?: string;
  templateKey: string;
  channel: 'email' | 'sms' | 'in_app' | 'push';
  variables?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private r(data: any, meta?: any) {
    return {
      success: true,
      data,
      meta: {
        request_id: uuidv4(),
        timestamp: new Date().toISOString(),
        version: 'v1',
        ...meta,
      },
    };
  }

  // ─── Get user notifications ───────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get current user notifications with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unread_only', required: false, type: Boolean })
  @ApiQuery({ name: 'channel', required: false })
  async getMyNotifications(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('unread_only') unreadOnly?: string,
    @Query('channel') channel?: string,
  ) {
    const result = await this.service.getUserNotifications(user.userId, {
      page: Number(page),
      limit: Number(limit),
      unreadOnly: unreadOnly === 'true',
      channel,
    });
    return this.r(result.notifications, {
      total: result.total,
      unread_count: result.unreadCount,
      page: Number(page),
      limit: Number(limit),
    });
  }

  // ─── Get notification by ID ───────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification by ID' })
  async getNotification(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const notification = await this.service.getNotificationById(id, user.userId);
    return this.r(notification);
  }

  // ─── Mark single notification as read ────────────────────────────────────

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.markRead(id, user.userId);
    return this.r({ id, read: true });
  }

  // ─── Mark all notifications as read ──────────────────────────────────────

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: CurrentUserData) {
    const count = await this.service.markAllRead(user.userId);
    return this.r({ marked_read: count });
  }

  // ─── Delete notification ──────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (dismiss) a notification' })
  async deleteNotification(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteNotification(id, user.userId);
    return this.r({ id, deleted: true });
  }

  // ─── Get unread count ─────────────────────────────────────────────────────

  @Get('meta/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: CurrentUserData) {
    const count = await this.service.getUnreadCount(user.userId);
    return this.r({ unread_count: count });
  }

  // ─── Get notification preferences ────────────────────────────────────────

  @Get('preferences/me')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  async getMyPreferences(@CurrentUser() user: CurrentUserData) {
    const prefs = await this.service.getUserPreferences(user.userId);
    return this.r(prefs);
  }

  // ─── Update notification preferences ─────────────────────────────────────

  @Patch('preferences/me')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  async updateMyPreferences(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const prefs = await this.service.updatePreferences(user.userId, dto);
    return this.r(prefs);
  }

  // ─── Get push devices ────────────────────────────────────────────────────

  @Get('push-devices/me')
  @ApiOperation({ summary: 'Get registered push notification devices' })
  async getMyPushDevices(@CurrentUser() user: CurrentUserData) {
    const devices = await this.service.getUserPushDevices(user.userId);
    return this.r(devices);
  }

  // ─── Register push device ─────────────────────────────────────────────────

  @Post('push-devices')
  @ApiOperation({ summary: 'Register a device for push notifications' })
  async registerPushDevice(
    @CurrentUser() user: CurrentUserData,
    @Body()
    body: {
      device_token: string;
      platform: 'ios' | 'android' | 'web';
      device_name?: string;
    },
  ) {
    const device = await this.service.registerPushDevice(user.userId, body);
    return this.r(device);
  }

  // ─── Remove push device ──────────────────────────────────────────────────

  @Delete('push-devices/:token')
  @ApiOperation({ summary: 'Unregister a push notification device' })
  async removePushDevice(
    @CurrentUser() user: CurrentUserData,
    @Param('token') token: string,
  ) {
    await this.service.removePushDevice(user.userId, token);
    return this.r({ removed: true });
  }

  // ─── Get conversations (in-app messaging) ────────────────────────────────

  @Get('conversations/list')
  @ApiOperation({ summary: 'Get user conversations' })
  async getConversations(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.service.getConversations(
      user.userId,
      user.organizationId,
      { page: Number(page), limit: Number(limit) },
    );
    return this.r(result);
  }

  // ─── Get conversation messages ────────────────────────────────────────────

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  async getConversationMessages(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('before') before?: string,
  ) {
    const messages = await this.service.getConversationMessages(
      conversationId,
      user.userId,
      { page: Number(page), limit: Number(limit), before },
    );
    return this.r(messages);
  }

  // ─── Send message ─────────────────────────────────────────────────────────

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async sendMessage(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body()
    body: {
      content: string;
      message_type?: 'text' | 'attachment' | 'system';
      metadata?: Record<string, unknown>;
    },
  ) {
    const message = await this.service.sendMessage(
      conversationId,
      user.userId,
      body,
    );
    return this.r(message);
  }

  // ─── Admin: Send notification ─────────────────────────────────────────────

  @Post('admin/send')
  @ApiOperation({ summary: '[Admin] Send a notification to a user' })
  async adminSendNotification(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SendNotificationDto,
  ) {
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return this.r({ sent: false, error: 'Insufficient permissions' });
    }
    const id = await this.service.send({
      ...dto,
      organizationId: dto.organizationId || user.organizationId,
    });
    return this.r({ notification_id: id, sent: !!id });
  }

  // ─── Admin: Get queue status ──────────────────────────────────────────────

  @Get('admin/queue-status')
  @ApiOperation({ summary: '[Admin] Get notification queue status' })
  async getQueueStatus(@CurrentUser() user: CurrentUserData) {
    if (!['super_admin', 'admin'].includes(user.role)) {
      return this.r({ error: 'Insufficient permissions' });
    }
    const status = await this.service.getQueueStatus(user.organizationId);
    return this.r(status);
  }
}
