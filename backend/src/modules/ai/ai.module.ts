import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIPublicController } from './ai.public.controller';
import { AIService } from './ai.service';
import { ModelGatewayService } from './model-gateway.service';
import { ContextBuilderService } from './context-builder.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AIController, AIPublicController],
  providers: [AIService, ModelGatewayService, ContextBuilderService],
  exports: [AIService, ModelGatewayService, ContextBuilderService],
})
export class AIModule {}
