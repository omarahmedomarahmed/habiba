import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventsGateway } from "./events.gateway";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("jwt.secret"),
      }),
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewaysModule {}

// Reviewed: 2026-06-13 — 24Therapy audit
