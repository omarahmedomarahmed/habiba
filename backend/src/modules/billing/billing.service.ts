import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException
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
  // SUBSCRIPTION PLANS — Public
  // ============================================================

  async getPlans() {
    return this.db.query(
      `SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY display_order ASC, monthly_price_usd ASC`
    );
  }

  async getAllPlans() {
    return this.db.query(
      `SELECT * FROM subscription_plans ORDER BY display_order ASC, monthly_price_usd ASC NULLS LAST`
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
  // PLAN MANAGEMENT — Admin Only
  // ============================================================

  async createPlan(data: {
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
  }) {
    const existing = await this.db.queryOne(
      `SELECT id FROM subscription_plans WHERE plan_key = $1`,
      [data.plan_key]
    );
    if (existing) throw new BadRequestException(`Plan key "${data.plan_key}" already exists`);

    return this.db.queryOne(
      `INSERT INTO subscription_plans (
        id, plan_key, name, tagline, description,
        monthly_price_usd, annual_price_usd,
        max_therapists, max_patients, max_sessions_month, ai_notes_included,
        features, stripe_price_id_monthly, stripe_price_id_annual,
        is_active, is_featured, badge_text, cta_text,
        display_order, trial_days, add_ons, highlight_color,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        NOW(), NOW()
      ) RETURNING *`,
      [
        data.plan_key, data.name, data.tagline || null, data.description || null,
        data.monthly_price_usd ?? null, data.annual_price_usd ?? null,
        data.max_therapists ?? null, data.max_patients ?? null,
        data.max_sessions_month ?? null, data.ai_notes_included ?? null,
        JSON.stringify(data.features ?? {}),
        data.stripe_price_id_monthly || null, data.stripe_price_id_annual || null,
        data.is_active ?? true, data.is_featured ?? false,
        data.badge_text || null, data.cta_text || 'Get Started',
        data.display_order ?? 0, data.trial_days ?? 14,
        JSON.stringify(data.add_ons ?? []), data.highlight_color || null,
      ]
    );
  }

  async updatePlan(planId: string, data: {
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
  }) {
    const plan = await this.getPlan(planId);
    if (!plan) throw new NotFoundException("Plan not found");

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (data.name !== undefined) addField('name', data.name);
    if (data.tagline !== undefined) addField('tagline', data.tagline);
    if (data.description !== undefined) addField('description', data.description);
    if (data.monthly_price_usd !== undefined) addField('monthly_price_usd', data.monthly_price_usd);
    if (data.annual_price_usd !== undefined) addField('annual_price_usd', data.annual_price_usd);
    if (data.max_therapists !== undefined) addField('max_therapists', data.max_therapists);
    if (data.max_patients !== undefined) addField('max_patients', data.max_patients);
    if (data.max_sessions_month !== undefined) addField('max_sessions_month', data.max_sessions_month);
    if (data.ai_notes_included !== undefined) addField('ai_notes_included', data.ai_notes_included);
    if (data.features !== undefined) addField('features', JSON.stringify(data.features));
    if (data.stripe_price_id_monthly !== undefined) addField('stripe_price_id_monthly', data.stripe_price_id_monthly);
    if (data.stripe_price_id_annual !== undefined) addField('stripe_price_id_annual', data.stripe_price_id_annual);
    if (data.is_active !== undefined) addField('is_active', data.is_active);
    if (data.is_featured !== undefined) addField('is_featured', data.is_featured);
    if (data.badge_text !== undefined) addField('badge_text', data.badge_text);
    if (data.cta_text !== undefined) addField('cta_text', data.cta_text);
    if (data.display_order !== undefined) addField('display_order', data.display_order);
    if (data.trial_days !== undefined) addField('trial_days', data.trial_days);
    if (data.add_ons !== undefined) addField('add_ons', JSON.stringify(data.add_ons));
    if (data.highlight_color !== undefined) addField('highlight_color', data.highlight_color);

    if (fields.length === 0) return plan;

    fields.push(`updated_at = NOW()`);
    values.push(planId);

    return this.db.queryOne(
      `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
  }

  async togglePlanActive(planId: string) {
    const plan = await this.getPlan(planId);
    if (!plan) throw new NotFoundException("Plan not found");

    return this.db.queryOne(
      `UPDATE subscription_plans SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [planId]
    );
  }

  async deletePlan(planId: string) {
    // Check if any active subscriptions use this plan
    const activeCount = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = $1 AND status IN ('active', 'trialing', 'past_due')`,
      [planId]
    );
    if (parseInt(activeCount?.count || '0') > 0) {
      throw new BadRequestException('Cannot delete a plan with active subscriptions. Deactivate it instead.');
    }

    await this.db.execute(
      `DELETE FROM subscription_plans WHERE id = $1`,
      [planId]
    );
    return { deleted: true, plan_id: planId };
  }

  async reorderPlans(planIds: string[]) {
    for (let i = 0; i < planIds.length; i++) {
      await this.db.execute(
        `UPDATE subscription_plans SET display_order = $1, updated_at = NOW() WHERE id = $2`,
        [i, planIds[i]]
      );
    }
    return this.getAllPlans();
  }

  async getPlanMetrics(planId: string) {
    const metrics = await this.db.queryOne(
      `SELECT
        sp.id, sp.name, sp.plan_key,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('active', 'trialing')) AS active_subscriptions,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'cancelled') AS cancelled_subscriptions,
        SUM(sp.monthly_price_usd) FILTER (WHERE s.status = 'active') AS mrr,
        COUNT(DISTINCT s.organization_id) AS total_organizations
       FROM subscription_plans sp
       LEFT JOIN subscriptions s ON s.plan_id = sp.id
       WHERE sp.id = $1
       GROUP BY sp.id, sp.name, sp.plan_key`,
      [planId]
    );
    return metrics;
  }

  async getPlatformPricingMetrics() {
    return this.db.query(
      `SELECT
        sp.id, sp.name, sp.plan_key, sp.monthly_price_usd, sp.is_active, sp.is_featured,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('active', 'trialing')) AS active_subscriptions,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'cancelled') AS cancelled_subscriptions,
        COALESCE(SUM(sp.monthly_price_usd) FILTER (WHERE s.status = 'active'), 0) AS mrr_contribution
       FROM subscription_plans sp
       LEFT JOIN subscriptions s ON s.plan_id = sp.id
       GROUP BY sp.id, sp.name, sp.plan_key, sp.monthly_price_usd, sp.is_active, sp.is_featured
       ORDER BY sp.display_order ASC, sp.monthly_price_usd ASC NULLS LAST`
    );
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
