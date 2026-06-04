import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, DatabaseService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
