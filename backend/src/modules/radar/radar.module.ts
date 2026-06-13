import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RadarController } from './radar.controller';
import { RadarService } from './radar.service';

@Module({
  imports: [AuthModule],
  controllers: [RadarController],
  providers: [RadarService],
  exports: [RadarService],
})
export class RadarModule {}

// Reviewed: 2026-06-13 — 24Therapy audit
