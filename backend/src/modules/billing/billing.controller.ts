import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  Headers, RawBodyRequest, UseGuards, Request, Req, HttpCode
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Public } from "../auth/decorators/public.decorator";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from "@nestjs/swagger";

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ============================================================
  // PUBLIC — Subscription Plans
  // ============================================================

  @Public()
  @Get("plans")
  @ApiOperation({ summary: "Get all active subscription plans (public)" })
  getPlans() {
    return this.billingService.getPlans();
  }

  @Public()
  @Get("plans/:id")
  @ApiOperation({ summary: "Get a single plan by ID (public)" })
  @ApiParam({ name: "id", description: "Plan UUID" })
  getPlan(@Param("id") id: string) {
    return this.billingService.getPlan(id);
  }

  // ============================================================
  // ADMIN — Plan Management
  // ============================================================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Get("admin/plans")
  @ApiOperation({ summary: "Get ALL plans (admin — includes inactive)" })
  adminGetAllPlans() {
    return this.billingService.getAllPlans();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Get("admin/plans/metrics")
  @ApiOperation({ summary: "Get pricing metrics across all plans" })
  getPlatformPricingMetrics() {
    return this.billingService.getPlatformPricingMetrics();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Get("admin/plans/:id/metrics")
  @ApiOperation({ summary: "Get metrics for a specific plan" })
  @ApiParam({ name: "id", description: "Plan UUID" })
  getPlanMetrics(@Param("id") id: string) {
    return this.billingService.getPlanMetrics(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Post("admin/plans")
  @ApiOperation({ summary: "Create a new subscription plan" })
  createPlan(
    @Body() body: {
      plan_key: string;
      name: string;
      tagline?: string;
      description?: string;
      monthly_price_usd?: number;
      annual_price_usd?: number;
      max_therapists?: number;
      max_patients?: number;
      max_sessions_month?: number;
      ai_notes_included?: number;
      features?: Record<string, unknown>;
      stripe_price_id_monthly?: string;
      stripe_price_id_annual?: string;
      is_active?: boolean;
      is_featured?: boolean;
      badge_text?: string;
      cta_text?: string;
      display_order?: number;
      trial_days?: number;
      add_ons?: Array<{ name: string; price: string; description: string }>;
      highlight_color?: string;
    }
  ) {
    return this.billingService.createPlan(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Put("admin/plans/:id")
  @ApiOperation({ summary: "Update a subscription plan" })
  @ApiParam({ name: "id", description: "Plan UUID" })
  updatePlan(
    @Param("id") id: string,
    @Body() body: {
      name?: string;
      tagline?: string;
      description?: string;
      monthly_price_usd?: number | null;
      annual_price_usd?: number | null;
      max_therapists?: number | null;
      max_patients?: number | null;
      max_sessions_month?: number | null;
      ai_notes_included?: number | null;
      features?: Record<string, unknown>;
      stripe_price_id_monthly?: string | null;
      stripe_price_id_annual?: string | null;
      is_active?: boolean;
      is_featured?: boolean;
      badge_text?: string | null;
      cta_text?: string;
      display_order?: number;
      trial_days?: number;
      add_ons?: Array<{ name: string; price: string; description: string }>;
      highlight_color?: string | null;
    }
  ) {
    return this.billingService.updatePlan(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Patch("admin/plans/:id/toggle")
  @ApiOperation({ summary: "Toggle plan active/inactive" })
  @ApiParam({ name: "id", description: "Plan UUID" })
  togglePlanActive(@Param("id") id: string) {
    return this.billingService.togglePlanActive(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Delete("admin/plans/:id")
  @ApiOperation({ summary: "Delete a plan (only if no active subscriptions)" })
  @ApiParam({ name: "id", description: "Plan UUID" })
  deletePlan(@Param("id") id: string) {
    return this.billingService.deletePlan(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Post("admin/plans/reorder")
  @ApiOperation({ summary: "Reorder plans by providing ordered array of plan IDs" })
  reorderPlans(@Body() body: { plan_ids: string[] }) {
    return this.billingService.reorderPlans(body.plan_ids);
  }

  // ============================================================
  // AUTHENTICATED — Subscription Management
  // ============================================================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("subscription")
  @ApiOperation({ summary: "Get current subscription" })
  getSubscription(@Request() req: { user: { organizationId: string } }) {
    return this.billingService.getSubscription(req.user.organizationId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("checkout")
  @ApiOperation({ summary: "Create a Stripe checkout session" })
  createCheckout(
    @Request() req: { user: { organizationId: string } },
    @Body() body: { plan_id: string; success_url: string; cancel_url: string }
  ) {
    return this.billingService.createCheckoutSession(
      req.user.organizationId,
      body.plan_id,
      body.success_url,
      body.cancel_url
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("cancel")
  @ApiOperation({ summary: "Cancel subscription" })
  cancelSubscription(@Request() req: { user: { organizationId: string } }) {
    return this.billingService.cancelSubscription(req.user.organizationId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("invoices")
  @ApiOperation({ summary: "Get invoices" })
  getInvoices(
    @Request() req: { user: { organizationId: string } },
    @Query() query: { limit?: string; offset?: string; status?: string }
  ) {
    return this.billingService.getInvoices(req.user.organizationId, {
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      status: query.status,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("summary")
  @ApiOperation({ summary: "Get billing summary" })
  getSummary(@Request() req: { user: { organizationId: string } }) {
    return this.billingService.getBillingSummary(req.user.organizationId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("payouts")
  @ApiOperation({ summary: "Get payout history" })
  getPayouts(@Request() req: { user: { userId: string } }) {
    return this.billingService.getPayouts(req.user.userId);
  }

  // ============================================================
  // THERAPIST — Session Charges & Usage
  // ============================================================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("therapist", "org_admin")
  @Get("usage/me")
  @ApiOperation({ summary: "Get therapist usage summary (plan, quota, pending bills, AI credits)" })
  getUsageMe(@Request() req: { user: { therapistId?: string; userId: string; role: string } }) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.billingService.getTherapistUsageSummary(therapistId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("therapist", "org_admin")
  @Post("charges/:id/checkout")
  @ApiOperation({ summary: "Regenerate Stripe checkout URL for a pending session charge" })
  @ApiParam({ name: "id", description: "Charge UUID" })
  getChargeCheckout(
    @Param("id") id: string,
    @Request() req: { user: { therapistId?: string; userId: string } },
  ) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.billingService.regenerateChargeCheckout(id, therapistId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("therapist", "org_admin")
  @Post("subscribe")
  @ApiOperation({ summary: "Create Stripe checkout for a subscription plan" })
  subscribeTherapist(
    @Request() req: { user: { therapistId?: string; userId: string; organizationId: string } },
    @Body() body: {
      plan_key: string;
      seats?: number;
      interval?: 'monthly' | 'annual';
      success_url: string;
      cancel_url: string;
    },
  ) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.billingService.subscribeTherapist(
      therapistId,
      req.user.organizationId,
      body.plan_key,
      body.seats ?? 1,
      body.interval ?? 'monthly',
      body.success_url,
      body.cancel_url,
    );
  }

  // ============================================================
  // ADMIN — Manual charge management
  // ============================================================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Post("admin/charges/:id/mark-paid")
  @ApiOperation({ summary: "Admin: manually mark a session charge as paid" })
  @ApiParam({ name: "id", description: "Charge UUID" })
  adminMarkPaid(@Param("id") id: string) {
    return this.billingService.adminMarkChargePaid(id);
  }

  // ============================================================
  // PUBLIC — Patient session checkout (called from join page)
  // ============================================================

  @Public()
  @Post("patient-session/checkout")
  @ApiOperation({ summary: "Create Stripe checkout for patient to pay for a priced session" })
  createPatientSessionCheckout(
    @Body() body: { session_id: string; join_token: string; patient_email: string; price_cents: number; therapist_id: string }
  ) {
    return this.billingService.createPatientSessionCheckout(
      body.session_id, body.therapist_id, body.price_cents, body.patient_email, body.join_token,
    ).then(url => ({ checkout_url: url }));
  }

  // ============================================================
  // THERAPIST — Wallet
  // ============================================================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("therapist", "org_admin")
  @Get("wallet")
  @ApiOperation({ summary: "Get therapist wallet balance and transaction history" })
  getWallet(@Request() req: { user: { therapistId?: string; userId: string } }) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.billingService.getWalletSummary(therapistId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("therapist", "org_admin")
  @Post("wallet/payout-request")
  @ApiOperation({ summary: "Request a manual payout from wallet balance" })
  requestPayout(
    @Request() req: { user: { therapistId?: string; userId: string } },
    @Body() body: { amount_cents: number; bank_details: Record<string, string>; method?: string },
  ) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.billingService.requestPayout(therapistId, body.amount_cents, body.bank_details, body.method);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Get("admin/payout-requests")
  @ApiOperation({ summary: "List all therapist payout requests (admin)" })
  getPayoutRequests(@Query("status") status?: string) {
    return this.billingService.getPayoutRequests(status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "admin")
  @Patch("admin/payout-requests/:id/process")
  @ApiOperation({ summary: "Mark a payout request as processed (admin)" })
  processPayoutRequest(
    @Param("id") id: string,
    @Request() req: { user: { userId: string } },
    @Body() body: { note?: string },
  ) {
    return this.billingService.processPayoutRequest(id, req.user.userId, body?.note);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("therapist", "org_admin")
  @Post("wallet/pay-subscription")
  @ApiOperation({ summary: "Use wallet balance to pay for a subscription" })
  paySubscriptionFromWallet(
    @Request() req: { user: { therapistId?: string; userId: string; organizationId: string } },
    @Body() body: { plan_key: string; amount_cents: number },
  ) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.billingService.useWalletForSubscription(
      therapistId, req.user.organizationId, body.plan_key, body.amount_cents,
    );
  }

  // Stripe webhook — no auth guard, uses signature verification
  @Public()
  @Post("webhook")
  @HttpCode(200)
  @ApiOperation({ summary: "Stripe webhook handler" })
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    return this.billingService.handleWebhook(req.rawBody!, signature);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
