import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';
import { CrisisModule } from '../crisis/crisis.module';

@Module({
  imports: [AuthModule, forwardRef(() => AIModule), CrisisModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
