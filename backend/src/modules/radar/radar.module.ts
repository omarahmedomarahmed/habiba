import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { AuthModule } from '../auth/auth.module';
import { RadarController } from './radar.controller';
import { RadarService } from './radar.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RadarController],
  providers: [RadarService, DatabaseService],
  exports: [RadarService],
})
export class RadarModule {}
