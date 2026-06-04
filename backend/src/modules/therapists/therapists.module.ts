import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { AuthModule } from '../auth/auth.module';
import { TherapistsController } from './therapists.controller';
import { TherapistsService } from './therapists.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TherapistsController],
  providers: [TherapistsService, DatabaseService],
  exports: [TherapistsService],
})
export class TherapistsModule {}
