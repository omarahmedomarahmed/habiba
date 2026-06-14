import {
  Controller, Get, Patch, Put, Body, Query, Param, UseGuards, Request
} from "@nestjs/common";
import { TherapistsService } from "./therapists.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
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

  @Patch("me/public-slug")
  @ApiOperation({ summary: "Update my booking page slug" })
  updatePublicSlug(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() body: { slug: string },
  ) {
    return this.therapistsService.updatePublicSlug(req.user.userId, req.user.organizationId, body.slug);
  }

  @Get("me/stats")
  @ApiOperation({ summary: "Get my dashboard stats" })
  getDashboardStats(@Request() req: { user: { userId: string; organizationId: string } }) {
    return this.therapistsService.getDashboardStats(req.user.userId, req.user.organizationId);
  }

  @Get("me/availability")
  @ApiOperation({ summary: "Get my availability settings" })
  async getAvailability(@Request() req: { user: { userId: string; organizationId: string } }) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId) as any;
    return this.therapistsService.getAvailability(therapist.id as string);
  }

  @Put("me/availability")
  @ApiOperation({ summary: "Update my availability" })
  async updateAvailability(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() body: Array<{ day_of_week: number; start_time: string; end_time: string; is_available: boolean }>
  ) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId) as any;
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
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId) as any;
    return this.therapistsService.getRadarSettings(therapist.id as string);
  }

  @Patch("me/radar-settings")
  @ApiOperation({ summary: "Update radar settings" })
  async updateRadarSettings(
    @Request() req: { user: { userId: string; organizationId: string } },
    @Body() body: Record<string, unknown>
  ) {
    const therapist = await this.therapistsService.getMyProfile(req.user.userId, req.user.organizationId) as any;
    return this.therapistsService.updateRadarSettings(therapist.id as string, body);
  }

  @Patch("me/submit-review")
  @ApiOperation({ summary: "Submit my profile for admin review" })
  async submitForReview(@Request() req: { user: { therapistId: string } }): Promise<{ success: boolean }> {
    await this.therapistsService.submitForReview(req.user.therapistId);
    return { success: true };
  }

  @Patch("me/bank-details")
  @ApiOperation({ summary: "Update my payout bank details" })
  async updateBankDetails(
    @Request() req: { user: { therapistId: string } },
    @Body() body: { payout_method: "ach" | "wire" | "swift"; bank_details: Record<string, unknown> },
  ): Promise<{ success: boolean }> {
    await this.therapistsService.updateBankDetails(req.user.therapistId, body.payout_method, body.bank_details);
    return { success: true };
  }

  @Patch(":id/verify")
  @UseGuards(RolesGuard)
  @Roles("super_admin", "admin", "org_admin")
  @ApiOperation({ summary: "Approve or reject a therapist (admin)" })
  async verifyTherapist(
    @Param("id") id: string,
    @Body() body: { verification_status: "approved" | "rejected"; rejection_reason?: string },
    @Request() req: { user: { userId: string } },
  ): Promise<{ success: boolean }> {
    if (body.verification_status === "approved") {
      await this.therapistsService.approveTherapist(id, req.user.userId);
    } else {
      await this.therapistsService.rejectTherapist(id, req.user.userId, body.rejection_reason ?? "");
    }
    return { success: true };
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
