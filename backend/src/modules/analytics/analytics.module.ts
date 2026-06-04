import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DatabaseService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
