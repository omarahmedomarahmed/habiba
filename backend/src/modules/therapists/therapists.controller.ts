import {
  Controller, Get, Patch, Put, Body, Query, UseGuards, Request
} from "@nestjs/common";
import { TherapistsService } from "./therapists.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

@ApiTags("Therapists")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("therapists")
export class TherapistsController {
  constructor(private readonly therapistsService: TherapistsService) {}

  @Get("me")
  @ApiOperation({ summary: "Get my therapist profile" })
  getMyProfile(@Request() req: { user: { userId: string; organizationId: string } }) {
    return this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update my therapist profile" })
  updateProfile(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() body: Record<string, unknown>
  ) {
    return this.therapistsService.updateProfile(req.user.userId, req.user.organizationId, body);
  }

  @Get("me/stats")
  @ApiOperation({ summary: "Get my dashboard stats" })
  getDashboardStats(@Request() req: { user: { userId: string; organizationId: string } }) {
    return this.therapistsService.getDashboardStats(req.user.userId, req.user.organizationId);
  }

  @Get("me/availability")
  @ApiOperation({ summary: "Get my availability settings" })
  async getAvailability(@Request() req: { user: { userId: string; organizationId: string } }) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId);
    return this.therapistsService.getAvailability(therapist.id as string);
  }

  @Put("me/availability")
  @ApiOperation({ summary: "Update my availability" })
  async updateAvailability(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() body: Array<{ day_of_week: number; start_time: string; end_time: string; is_available: boolean }>
  ) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId);
    return this.therapistsService.updateAvailability(therapist.id as string, body);
  }

  @Get()
  @ApiOperation({ summary: "List therapists in organization" })
  findAll(
    @Request() req: { user: { organizationId: string } },
    @Query() query: { search?: string; status?: string; limit?: string; offset?: string }
  ) {
    return this.therapistsService.findAll(req.user.organizationId, {
      ...query,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    });
  }

  @Get("me/radar-settings")
  @ApiOperation({ summary: "Get radar settings" })
  async getRadarSettings(@Request() req: { user: { userId: string; organizationId: string } }) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId);
    return this.therapistsService.getRadarSettings(therapist.id as string);
  }

  @Patch("me/radar-settings")
  @ApiOperation({ summary: "Update radar settings" })
  async updateRadarSettings(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() body: Record<string, unknown>
  ) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId);
    return this.therapistsService.updateRadarSettings(therapist.id as string, body);
  }
}
