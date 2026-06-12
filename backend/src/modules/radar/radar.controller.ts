import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request
} from "@nestjs/common";
import { RadarService } from "./radar.service";
import { CreateRadarRequestDto } from "./dto/radar.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

@ApiTags("Radar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("radar")
export class RadarController {
  constructor(private readonly radarService: RadarService) {}

  // Patient: create a new radar request
  @Post("requests")
  @ApiOperation({ summary: "Create a new radar matching request" })
  createRequest(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() dto: CreateRadarRequestDto
  ) {
    return this.radarService.createRequest(req.user.userId, req.user.organizationId, dto);
  }

  // Patient: get request status
  @Get("requests/:id/status")
  @ApiOperation({ summary: "Get radar request status" })
  async getRequestStatus(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Param("id") id: string
  ) {
    // TODO: get patient_id from user
    return this.radarService.getRequestStatus(id, req.user.userId);
  }

  // Therapist: get pending requests
  @Get("therapist/requests")
  @ApiOperation({ summary: "Get pending radar requests for therapist" })
  async getTherapistRequests(@Request() req: { user: { userId: string; organizationId: string; therapistId?: string } }) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.radarService.getTherapistRequests(therapistId);
  }

  // Therapist: accept a request
  @Post("requests/:id/accept")
  @ApiOperation({ summary: "Accept a radar request" })
  async acceptRequest(
    @Request() req: { user: { userId: string; organizationId: string; therapistId?: string } },
    @Param("id") id: string
  ) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.radarService.acceptRequest(therapistId, id, req.user.organizationId);
  }

  // Therapist: decline a request
  @Post("requests/:id/decline")
  @ApiOperation({ summary: "Decline a radar request" })
  async declineRequest(
    @Request() req: { user: { userId: string; therapistId?: string } },
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    return this.radarService.declineRequest(req.user.therapistId || req.user.userId, id, body.reason);
  }

  // Analytics
  @Get("analytics")
  @ApiOperation({ summary: "Get radar analytics" })
  getAnalytics(
    @Request() req: { user: { organizationId: string } },
    @Query("period") period?: string
  ) {
    return this.radarService.getRadarAnalytics(req.user.organizationId, period);
  }

  // Market health
  @Get("market-health")
  @ApiOperation({ summary: "Get radar market health" })
  getMarketHealth(@Request() req: { user: { organizationId: string } }) {
    return this.radarService.getMarketHealth(req.user.organizationId);
  }
}
