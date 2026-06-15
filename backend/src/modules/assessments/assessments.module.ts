import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { PublicAssessmentsController } from './public-assessments.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AssessmentsController, PublicAssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}

// Reviewed: 2026-06-13 — 24Therapy audit
