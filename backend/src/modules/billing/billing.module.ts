import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BillingController],
  providers: [BillingService, DatabaseService],
  exports: [BillingService],
})
export class BillingModule {}
