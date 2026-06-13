import { IsString, IsUUID, IsOptional, MaxLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'user_id of the other participant' })
  @IsUUID()
  participant_id!: string;
}

export class SendMessageDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  content!: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 30;

  @ApiPropertyOptional({ description: 'ISO timestamp — fetch messages before this cursor' })
  @IsOptional()
  @IsString()
  before?: string;
}

// Reviewed: 2026-06-13 — 24Therapy audit
