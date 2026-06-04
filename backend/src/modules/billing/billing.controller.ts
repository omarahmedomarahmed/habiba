import {
  Controller, Get, Post, Body, Query, Headers, RawBodyRequest,
  UseGuards, Request, Req, HttpCode
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("plans")
  @ApiOperation({ summary: "Get all subscription plans" })
  getPlans() {
    return this.billingService.getPlans();
  }

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

  // Stripe webhook — no auth guard, uses signature verification
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
