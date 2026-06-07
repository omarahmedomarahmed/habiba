import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIPublicController } from './ai.public.controller';
import { AIService } from './ai.service';
import { ModelGatewayService } from './model-gateway.service';
import { ContextBuilderService } from './context-builder.service';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AIController, AIPublicController],
  providers: [AIService, ModelGatewayService, ContextBuilderService, DatabaseService],
  exports: [AIService, ModelGatewayService, ContextBuilderService],
})
export class AIModule {}
