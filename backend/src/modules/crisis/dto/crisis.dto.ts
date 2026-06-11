import { IsOptional, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAlertsQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'delivered', 'acknowledged'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['elevated', 'high', 'critical'] })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
