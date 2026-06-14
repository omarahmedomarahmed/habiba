import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { CrisisModule } from '../crisis/crisis.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AuthModule, forwardRef(() => AIModule), forwardRef(() => BillingModule), CrisisModule, MailModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}

// Reviewed: 2026-06-13 — 24Therapy audit
