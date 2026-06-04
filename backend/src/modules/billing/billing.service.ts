import {
  Injectable, NotFoundException, BadRequestException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../database/database.service";
import Stripe from "stripe";

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {
    this.stripe = new Stripe(
      this.config.get("stripe.secretKey") || "sk_test_placeholder",
      { apiVersion: "2024-12-18.acacia" }
    );
  }

  // ============================================================
  // SUBSCRIPTION PLANS
  // ============================================================

  async getPlans() {
    return this.db.query(
      `SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY price_monthly_usd ASC`
    );
  }

  async getPlan(planId: string) {
    const plan = await this.db.queryOne(
      `SELECT * FROM subscription_plans WHERE id = $1`,
      [planId]
    );
    if (!plan) throw new NotFoundException("Plan not found");
    return plan;
  }

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================

  async getSubscription(organizationId: string) {
    return this.db.queryOne(
      `SELECT s.*, sp.name AS plan_name, sp.features, sp.price_monthly_usd, sp.session_limit
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing', 'past_due')
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [organizationId]
    );
  }

  async createCheckoutSession(
    organizationId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const plan = await this.getPlan(planId);
    const org = await this.db.queryOne<{ name: string; stripe_customer_id?: string; id: string }>(
      `SELECT id, name, stripe_customer_id FROM organizations WHERE id = $1`,
      [organizationId]
    );

    if (!org) throw new NotFoundException("Organization not found");

    // Create or get Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { organization_id: organizationId, organization_name: org.name },
      });
      customerId = customer.id;
      await this.db.execute(
        `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, organizationId]
      );
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: (plan as Record<string, unknown>).name as string,
              description: `24Therapy ${(plan as Record<string, unknown>).name} Plan`,
            },
            unit_amount: Math.round(Number((plan as Record<string, unknown>).price_monthly_usd) * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organization_id: organizationId, plan_id: planId },
    });

    return { checkout_url: session.url, session_id: session.id };
  }

  async cancelSubscription(organizationId: string) {
    const sub = await this.db.queryOne<{ stripe_subscription_id: string; id: string }>(
      `SELECT id, stripe_subscription_id FROM subscriptions
       WHERE organization_id = $1 AND status = 'active'`,
      [organizationId]
    );

    if (!sub?.stripe_subscription_id) throw new NotFoundException("Active subscription not found");

    // Cancel at period end in Stripe
    await this.stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await this.db.execute(
      `UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW() WHERE id = $1`,
      [sub.id]
    );

    return { success: true, message: "Subscription will cancel at period end" };
  }

  // ============================================================
  // STRIPE WEBHOOKS
  // ============================================================

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.config.get("stripe.webhookSecret");

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret || "");
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (!session.metadata?.organization_id || !session.metadata?.plan_id) return;

    const orgId = session.metadata.organization_id;
    const planId = session.metadata.plan_id;

    // Deactivate existing subscriptions
    await this.db.execute(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE organization_id = $1 AND status IN ('active', 'trialing')`,
      [orgId]
    );

    // Create new subscription record
    await this.db.execute(
      `INSERT INTO subscriptions (
        id, organization_id, plan_id, status, stripe_subscription_id,
        stripe_customer_id, current_period_start, current_period_end
       ) VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW() + INTERVAL '30 days')`,
      [
        this.db.generateId(), orgId, planId,
        session.subscription, session.customer,
      ]
    );

    // Update organization plan
    await this.db.execute(
      `UPDATE organizations SET plan_id = $1, updated_at = NOW() WHERE id = $2`,
      [planId, orgId]
    );
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    if (!invoice.customer) return;

    const org = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
      [invoice.customer as string]
    );

    if (!org) return;

    // Record payment
    await this.db.execute(
      `INSERT INTO payments (id, organization_id, stripe_payment_intent_id, amount, currency, status, description)
       VALUES ($1, $2, $3, $4, $5, 'succeeded', 'Subscription payment')`,
      [
        this.db.generateId(), org.id,
        invoice.payment_intent as string,
        (invoice.amount_paid || 0) / 100, // Convert from cents
        invoice.currency?.toUpperCase() || "USD",
      ]
    );

    // Update subscription status
    await this.db.execute(
      `UPDATE subscriptions SET status = 'active', updated_at = NOW()
       WHERE organization_id = $1 AND status = 'past_due'`,
      [org.id]
    );
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    if (!invoice.customer) return;

    const org = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
      [invoice.customer as string]
    );

    if (!org) return;

    await this.db.execute(
      `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
       WHERE organization_id = $1 AND status = 'active'`,
      [org.id]
    );
  }

  private async handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    await this.db.execute(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await this.db.execute(
      `UPDATE subscriptions SET
         status = $2,
         current_period_end = to_timestamp($3),
         updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id, subscription.status, subscription.current_period_end]
    );
  }

  // ============================================================
  // INVOICES
  // ============================================================

  async getInvoices(
    organizationId: string,
    params: { limit?: number; offset?: number; status?: string }
  ) {
    const { limit = 20, offset = 0, status } = params;
    const queryParams: unknown[] = [organizationId];
    let whereExtra = "";

    if (status) {
      queryParams.push(status);
      whereExtra += ` AND i.status = $${queryParams.length}`;
    }

    const total = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM invoices i WHERE i.organization_id = $1${whereExtra}`,
      queryParams
    );

    queryParams.push(limit, offset);
    const data = await this.db.query(
      `SELECT i.*,
              COUNT(il.id) AS line_items_count
       FROM invoices i
       LEFT JOIN invoice_line_items il ON il.invoice_id = i.id
       WHERE i.organization_id = $1${whereExtra}
       GROUP BY i.id
       ORDER BY i.created_at DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    return { data, total: parseInt(total?.count || "0"), limit, offset };
  }

  // ============================================================
  // BILLING SUMMARY
  // ============================================================

  async getBillingSummary(organizationId: string) {
    return this.db.queryOne(
      `SELECT * FROM billing_summary WHERE organization_id = $1`,
      [organizationId]
    );
  }

  // ============================================================
  // PAYOUT MANAGEMENT (Marketplace therapists)
  // ============================================================

  async getPayouts(therapistId: string) {
    return this.db.query(
      `SELECT p.*, COUNT(pli.id) AS line_items_count
       FROM payouts p
       LEFT JOIN payout_line_items pli ON pli.payout_id = p.id
       WHERE p.therapist_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [therapistId]
    );
  }

  async initiatePayouts(organizationId: string) {
    // Find all eligible unpaid session fees
    const eligibleFees = await this.db.query<{
      therapist_id: string;
      total: number;
      fee_ids: string[];
    }>(
      `SELECT
         t.id AS therapist_id,
         SUM(sf.platform_amount) AS total,
         array_agg(sf.id) AS fee_ids
       FROM session_fees sf
       JOIN sessions s ON s.id = sf.session_id
       JOIN therapists t ON t.id = s.therapist_id
       WHERE sf.status = 'pending' AND sf.organization_id = $1
         AND s.status = 'completed'
       GROUP BY t.id
       HAVING SUM(sf.platform_amount) >= 50`,  // Min $50 payout threshold
      [organizationId]
    );

    const payouts = [];
    for (const fee of eligibleFees) {
      const payoutId = this.db.generateId();
      await this.db.transaction(async (client) => {
        // Create payout record
        await client.query(
          `INSERT INTO payouts (id, organization_id, therapist_id, amount, status, period_start, period_end)
           VALUES ($1, $2, $3, $4, 'pending', NOW() - INTERVAL '30 days', NOW())`,
          [payoutId, organizationId, fee.therapist_id, fee.total]
        );

        // Create line items
        for (const feeId of fee.fee_ids) {
          await client.query(
            `INSERT INTO payout_line_items (id, payout_id, session_fee_id, amount)
             SELECT $1, $2, id, platform_amount FROM session_fees WHERE id = $3`,
            [this.db.generateId(), payoutId, feeId]
          );
        }

        // Mark fees as in payout
        await client.query(
          `UPDATE session_fees SET status = 'processing' WHERE id = ANY($1)`,
          [fee.fee_ids]
        );
      });
      payouts.push({ payout_id: payoutId, therapist_id: fee.therapist_id, amount: fee.total });
    }

    return { initiated: payouts.length, payouts };
  }

  // ============================================================
  // SESSION FEES
  // ============================================================

  async createSessionFee(
    sessionId: string,
    organizationId: string,
    therapistId: string,
    amount: number,
    currency = "USD"
  ) {
    const commissionRate = 0.15; // 15% platform fee
    const platformAmount = amount * commissionRate;
    const therapistAmount = amount * (1 - commissionRate);

    return this.db.queryOne(
      `INSERT INTO session_fees (
        id, session_id, organization_id, therapist_id, amount, currency,
        platform_fee_rate, platform_amount, therapist_amount, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [
        this.db.generateId(), sessionId, organizationId, therapistId,
        amount, currency, commissionRate, platformAmount, therapistAmount,
      ]
    );
  }
}
