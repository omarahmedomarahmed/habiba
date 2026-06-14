import {
  Injectable, NotFoundException, BadRequestException, Logger
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DatabaseService } from "../../database/database.service";
import { MailService } from "../mail/mail.service";
import Stripe from "stripe";

const ROLLOVER_CAP = 20; // founder-adjustable constant: max banked rollover sessions
const PAID_PLAN_KEYS = new Set(['starter', 'pro', 'practice', 'enterprise']);
const PAYG_PLAN_KEYS = new Set(['pay_per_session', 'free_trial']); // free_trial is legacy

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe;
  private readonly stripeConfigured: boolean;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    const secretKey = this.config.get<string>("stripe.secretKey");
    this.stripeConfigured = !!secretKey && secretKey !== "sk_test_placeholder";
    this.stripe = new Stripe(secretKey || "sk_test_placeholder", {
      apiVersion: "2024-06-20",
    });
  }

  // ============================================================
  // SESSION BILLING ENGINE
  // ============================================================

  /**
   * Called after a session is marked completed. Never throws — billing failure
   * must not block session completion. Missed calls are recovered by reconciler.
   */
  async onSessionCompleted(session: {
    id: string;
    therapist_id: string;
    organization_id: string;
    scheduled_at?: string;
  }): Promise<void> {
    try {
      await this._chargeForSession(session);
    } catch (err) {
      this.logger.error(
        `onSessionCompleted billing error for session ${session.id}: ${err.message}`,
      );
    }
  }

  private async _chargeForSession(session: {
    id: string;
    therapist_id: string;
    organization_id: string;
    scheduled_at?: string;
  }): Promise<void> {
    // Idempotency: skip if charge already exists for this session
    const existing = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM session_charges WHERE session_id = $1`,
      [session.id],
    );
    if (existing) return;

    const therapist = await this.db.queryOne<{
      id: string; current_plan_key: string; trial_session_used: boolean;
      user_id: string; organization_id: string;
    }>(
      `SELECT t.id, t.current_plan_key, t.trial_session_used, t.user_id, t.organization_id
       FROM therapists t WHERE t.id = $1`,
      [session.therapist_id],
    );
    if (!therapist) return;

    const planKey = therapist.current_plan_key || 'pay_per_session';

    // Unlimited plans — record $0 included charge
    if (PAID_PLAN_KEYS.has(planKey) && planKey !== 'starter') {
      await this._insertCharge({
        sessionId: session.id,
        therapistId: session.therapist_id,
        orgId: session.organization_id,
        planKey,
        amountUsd: 0,
        discountUsd: 0,
        amountDueUsd: 0,
        status: 'included',
        description: `Included in ${planKey} plan`,
      });
      return;
    }

    // Starter plan — quota-based
    if (planKey === 'starter') {
      const quota = await this._getOrInitQuota(session.therapist_id, session.organization_id);
      const available = quota.included + quota.rollover_in - quota.used;
      if (available > 0) {
        await this.db.execute(
          `UPDATE therapist_session_quota SET used = used + 1 WHERE id = $1`,
          [quota.id],
        );
        await this._insertCharge({
          sessionId: session.id,
          therapistId: session.therapist_id,
          orgId: session.organization_id,
          planKey,
          amountUsd: 0,
          discountUsd: 0,
          amountDueUsd: 0,
          status: 'included',
          description: `Included in Starter (${quota.used + 1} of ${quota.included + quota.rollover_in})`,
        });
        // Quota warning at 17/20
        if (quota.used + 1 >= quota.included + quota.rollover_in - 3) {
          const remaining = quota.included + quota.rollover_in - (quota.used + 1);
          this._sendQuotaWarning(session.therapist_id, remaining).catch(() => {});
        }
        return;
      }
      // Over quota → PAYG $6 extra
    }

    // PAYG path (pay_per_session OR Starter overage)
    const isFirstEver = planKey !== 'starter' && !therapist.trial_session_used;
    const amountUsd = 6.00;
    const discountUsd = isFirstEver ? 6.00 : 0;
    const amountDueUsd = amountUsd - discountUsd;
    const status = isFirstEver ? 'waived' : 'pending';
    const description = isFirstEver
      ? 'First session — on us!'
      : planKey === 'starter'
        ? 'Extra session beyond Starter plan ($6/session)'
        : 'Pay As You Go — $6/session';

    // Mark trial used on therapist record
    if (isFirstEver) {
      await this.db.execute(
        `UPDATE therapists SET trial_session_used = true WHERE id = $1`,
        [session.therapist_id],
      );
    }

    let checkoutUrl: string | null = null;
    const chargeId = this.db.generateId();

    // Create Stripe one-time payment link for pending bills
    if (!isFirstEver && this.stripeConfigured) {
      checkoutUrl = await this._createSessionChargeCheckout(
        chargeId,
        session.therapist_id,
        session.organization_id,
        amountUsd,
      );
    }

    await this._insertCharge({
      id: chargeId,
      sessionId: session.id,
      therapistId: session.therapist_id,
      orgId: session.organization_id,
      planKey,
      amountUsd,
      discountUsd,
      amountDueUsd,
      status,
      description,
      stripeCheckoutUrl: checkoutUrl,
    });

    // Grant AI credits for PAYG (5 per completed session)
    if (PAYG_PLAN_KEYS.has(planKey)) {
      await this.db.execute(
        `INSERT INTO ai_assistant_credits (therapist_id, balance, updated_at)
         VALUES ($1, 5, NOW())
         ON CONFLICT (therapist_id)
         DO UPDATE SET balance = ai_assistant_credits.balance + 5, updated_at = NOW()`,
        [session.therapist_id],
      );
    }

    // Send email notifications (fire-and-forget)
    const userEmail = await this._getTherapistEmail(session.therapist_id);
    if (userEmail && isFirstEver) {
      this.mail.sendFirstSessionFree(userEmail).catch(() => {});
    } else if (userEmail && !isFirstEver && checkoutUrl) {
      this.mail.sendSessionBill(userEmail, amountDueUsd, checkoutUrl, description).catch(() => {});
    }
  }

  private async _insertCharge(opts: {
    id?: string;
    sessionId: string;
    therapistId: string;
    orgId: string;
    planKey: string;
    amountUsd: number;
    discountUsd: number;
    amountDueUsd: number;
    status: string;
    description: string;
    stripeCheckoutUrl?: string | null;
  }) {
    const id = opts.id || this.db.generateId();
    await this.db.execute(
      `INSERT INTO session_charges (
         id, organization_id, therapist_id, session_id,
         amount_usd, discount_usd, amount_due_usd,
         plan_key, status, description, stripe_checkout_url
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id, opts.orgId, opts.therapistId, opts.sessionId,
        opts.amountUsd, opts.discountUsd, opts.amountDueUsd,
        opts.planKey, opts.status, opts.description,
        opts.stripeCheckoutUrl || null,
      ],
    );
    return id;
  }

  private async _getOrInitQuota(therapistId: string, orgId: string) {
    const periodStart = new Date();
    periodStart.setDate(1);
    const periodStr = periodStart.toISOString().split('T')[0];

    const existing = await this.db.queryOne<{
      id: string; included: number; rollover_in: number; used: number;
    }>(
      `SELECT id, included, rollover_in, used FROM therapist_session_quota
       WHERE therapist_id = $1 AND period_start = $2`,
      [therapistId, periodStr],
    );
    if (existing) return existing;

    // Compute rollover from previous period
    const prevPeriod = new Date(periodStart);
    prevPeriod.setMonth(prevPeriod.getMonth() - 1);
    const prevStr = prevPeriod.toISOString().split('T')[0];

    const prev = await this.db.queryOne<{ included: number; rollover_in: number; used: number }>(
      `SELECT included, rollover_in, used FROM therapist_session_quota
       WHERE therapist_id = $1 AND period_start = $2`,
      [therapistId, prevStr],
    );

    let rolloverIn = 0;
    if (prev) {
      const unused = Math.max(0, prev.included + prev.rollover_in - prev.used);
      rolloverIn = Math.min(ROLLOVER_CAP, unused);
    }

    const row = await this.db.queryOne<{ id: string; included: number; rollover_in: number; used: number }>(
      `INSERT INTO therapist_session_quota
         (id, therapist_id, organization_id, period_start, included, rollover_in, used)
       VALUES ($1, $2, $3, $4, 20, $5, 0)
       ON CONFLICT (therapist_id, period_start) DO UPDATE
         SET rollover_in = EXCLUDED.rollover_in
       RETURNING id, included, rollover_in, used`,
      [this.db.generateId(), therapistId, orgId, periodStr, rolloverIn],
    );
    return row!;
  }

  async getPendingBillForTherapist(therapistId: string) {
    return this.db.queryOne<{
      id: string; amount_due_usd: number; stripe_checkout_url: string | null;
      session_id: string; charged_at: string; description: string;
    }>(
      `SELECT id, amount_due_usd, stripe_checkout_url, session_id, charged_at, description
       FROM session_charges
       WHERE therapist_id = $1 AND status = 'pending'
       ORDER BY charged_at ASC
       LIMIT 1`,
      [therapistId],
    );
  }

  async checkSessionCreationAllowed(therapistId: string): Promise<void> {
    const therapist = await this.db.queryOne<{ current_plan_key: string }>(
      `SELECT current_plan_key FROM therapists WHERE id = $1`,
      [therapistId],
    );
    const planKey = therapist?.current_plan_key || 'pay_per_session';

    if (planKey === 'pay_per_session') {
      const pending = await this.getPendingBillForTherapist(therapistId);
      if (pending) {
        throw Object.assign(
          new Error(`PAYMENT_REQUIRED:unpaid_session_bill`),
          {
            charge_id: pending.id,
            amount_due: pending.amount_due_usd,
            checkout_url: pending.stripe_checkout_url,
          },
        );
      }
    }
  }

  async getTherapistUsageSummary(therapistId: string) {
    const therapist = await this.db.queryOne<{
      current_plan_key: string; trial_session_used: boolean;
    }>(
      `SELECT current_plan_key, trial_session_used FROM therapists WHERE id = $1`,
      [therapistId],
    );
    if (!therapist) throw new NotFoundException('Therapist not found');

    const planKey = therapist.current_plan_key || 'pay_per_session';

    const plan = await this.db.queryOne<{
      name: string; monthly_price_usd: number | null; price_per_session_usd: number | null;
    }>(
      `SELECT name, monthly_price_usd, price_per_session_usd
       FROM subscription_plans WHERE plan_key = $1`,
      [planKey],
    );

    // Sessions this month
    const monthCount = await this.db.queryOne<{ sessions_this_month: string }>(
      `SELECT COUNT(*) AS sessions_this_month FROM sessions
       WHERE therapist_id = $1 AND status = 'completed'
         AND created_at >= DATE_TRUNC('month', NOW())`,
      [therapistId],
    );

    // Pending bills
    const pendingBills = await this.db.query<{
      id: string; amount_due_usd: number; stripe_checkout_url: string | null;
      charged_at: string; description: string; session_id: string;
    }>(
      `SELECT id, amount_due_usd, stripe_checkout_url, charged_at, description, session_id
       FROM session_charges WHERE therapist_id = $1 AND status = 'pending'
       ORDER BY charged_at ASC`,
      [therapistId],
    );

    // Charge history (last 50)
    const chargeHistory = await this.db.query(
      `SELECT id, session_id, amount_usd, discount_usd, amount_due_usd, status, description,
              charged_at, paid_at, plan_key
       FROM session_charges WHERE therapist_id = $1
       ORDER BY charged_at DESC LIMIT 50`,
      [therapistId],
    );

    // AI credits
    const credits = await this.db.queryOne<{ balance: number }>(
      `SELECT balance FROM ai_assistant_credits WHERE therapist_id = $1`,
      [therapistId],
    );

    // Quota (Starter)
    let quota = null;
    if (planKey === 'starter') {
      const q = await this._getOrInitQuota(therapistId, ''); // orgId not needed for read
      quota = {
        included: q.included,
        rollover_in: q.rollover_in,
        used: q.used,
        remaining: Math.max(0, q.included + q.rollover_in - q.used),
      };
    }

    return {
      plan: {
        plan_key: planKey,
        name: plan?.name || planKey,
        price_monthly_usd: plan?.monthly_price_usd ?? null,
        price_per_session_usd: plan?.price_per_session_usd ?? null,
      },
      sessions_this_month: parseInt(monthCount?.sessions_this_month || '0'),
      quota,
      trial_session_used: therapist.trial_session_used,
      pending_bills: pendingBills,
      charge_history: chargeHistory,
      ai_credits: PAID_PLAN_KEYS.has(planKey) ? 'unlimited' : (credits?.balance ?? 0),
    };
  }

  async regenerateChargeCheckout(chargeId: string, therapistId: string) {
    const charge = await this.db.queryOne<{
      id: string; therapist_id: string; organization_id: string;
      amount_due_usd: number; status: string;
    }>(
      `SELECT id, therapist_id, organization_id, amount_due_usd, status
       FROM session_charges WHERE id = $1`,
      [chargeId],
    );
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.therapist_id !== therapistId) throw new BadRequestException('Access denied');
    if (charge.status !== 'pending') throw new BadRequestException('Charge is not pending');

    let checkoutUrl: string | null = null;
    if (this.stripeConfigured) {
      checkoutUrl = await this._createSessionChargeCheckout(
        chargeId,
        charge.therapist_id,
        charge.organization_id,
        charge.amount_due_usd,
      );
      await this.db.execute(
        `UPDATE session_charges SET stripe_checkout_url = $1 WHERE id = $2`,
        [checkoutUrl, chargeId],
      );
    }

    return { charge_id: chargeId, checkout_url: checkoutUrl };
  }

  async adminMarkChargePaid(chargeId: string) {
    const charge = await this.db.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM session_charges WHERE id = $1`,
      [chargeId],
    );
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status === 'paid') throw new BadRequestException('Charge already paid');

    await this.db.execute(
      `UPDATE session_charges SET status = 'paid', paid_at = NOW() WHERE id = $1`,
      [chargeId],
    );
    return { success: true, charge_id: chargeId };
  }

  async subscribeTherapist(
    therapistId: string,
    orgId: string,
    planKey: string,
    seats: number,
    interval: 'monthly' | 'annual',
    successUrl: string,
    cancelUrl: string,
  ) {
    const plan = await this.db.queryOne<{
      id: string; name: string; monthly_price_usd: number;
      annual_price_usd: number; plan_key: string; features: Record<string, unknown>;
    }>(
      `SELECT id, name, monthly_price_usd, annual_price_usd, plan_key, features
       FROM subscription_plans WHERE plan_key = $1 AND is_active = true`,
      [planKey],
    );
    if (!plan) throw new NotFoundException(`Plan ${planKey} not found`);

    // Practice: 2–5 seats configurable; 6+ → contact sales
    if (planKey === 'practice') {
      if (seats < 2) throw new BadRequestException('Practice plan requires at least 2 seats');
      if (seats > 5) throw new BadRequestException('For 6+ seats, contact sales');
    }

    const basePrice = interval === 'annual' ? plan.annual_price_usd : plan.monthly_price_usd;
    const extraSeatPrice = 85; // per-seat per month
    const seatMultiplier = planKey === 'practice' && seats > 2 ? seats - 2 : 0;
    const totalPrice = basePrice + seatMultiplier * (interval === 'annual' ? extraSeatPrice * 10 : extraSeatPrice);

    if (!this.stripeConfigured) {
      return {
        checkout_url: null,
        message: 'Stripe not configured — subscription recorded, activate after Stripe setup',
        plan_key: planKey,
        amount: totalPrice,
      };
    }

    const org = await this.db.queryOne<{ name: string; stripe_customer_id?: string }>(
      `SELECT name, stripe_customer_id FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!org) throw new NotFoundException('Organization not found');

    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { organization_id: orgId, therapist_id: therapistId },
      });
      customerId = customer.id;
      await this.db.execute(
        `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, orgId],
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `24Therapy ${plan.name}${planKey === 'practice' ? ` (${seats} seats)` : ''}`,
            },
            unit_amount: Math.round(totalPrice * 100),
            recurring: { interval: interval === 'annual' ? 'year' : 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: orgId,
        therapist_id: therapistId,
        plan_key: planKey,
        plan_id: plan.id,
        seats: String(seats),
        interval,
      },
    });

    return { checkout_url: session.url, session_id: session.id };
  }

  /**
   * Cron: every 10 minutes, find completed sessions in last 48h without a charge record.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileMissingCharges(): Promise<void> {
    const missed = await this.db.query<{
      id: string; therapist_id: string; organization_id: string; scheduled_at: string;
    }>(
      `SELECT s.id, s.therapist_id, s.organization_id, s.scheduled_at
       FROM sessions s
       WHERE s.status = 'completed'
         AND s.ended_at >= NOW() - INTERVAL '48 hours'
         AND NOT EXISTS (
           SELECT 1 FROM session_charges sc WHERE sc.session_id = s.id
         )`,
    );

    for (const session of missed) {
      await this.onSessionCompleted(session);
    }

    if (missed.length > 0) {
      this.logger.log(`reconcileMissingCharges: processed ${missed.length} missed sessions`);
    }
  }

  private async _createSessionChargeCheckout(
    chargeId: string,
    therapistId: string,
    orgId: string,
    amountUsd: number,
  ): Promise<string | null> {
    if (!this.stripeConfigured) return null;

    const org = await this.db.queryOne<{ stripe_customer_id?: string; name: string }>(
      `SELECT stripe_customer_id, name FROM organizations WHERE id = $1`,
      [orgId],
    );

    let customerId = org?.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { organization_id: orgId, therapist_id: therapistId },
      });
      customerId = customer.id;
      await this.db.execute(
        `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, orgId],
      );
    }

    const therapistAppUrl = this.config.get<string>('THERAPIST_APP_URL') || 'https://app.24therapy.ai';
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: '24Therapy Session' },
            unit_amount: Math.round(amountUsd * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${therapistAppUrl}/settings?tab=billing&paid=1`,
      cancel_url: `${therapistAppUrl}/sessions/new`,
      metadata: { session_charge_id: chargeId, therapist_id: therapistId },
    });

    return session.url;
  }

  private async _getTherapistEmail(therapistId: string): Promise<string | null> {
    const row = await this.db.queryOne<{ email: string }>(
      `SELECT u.email FROM users u JOIN therapists t ON t.user_id = u.id WHERE t.id = $1`,
      [therapistId],
    );
    return row?.email || null;
  }

  private async _sendQuotaWarning(therapistId: string, remaining: number): Promise<void> {
    const email = await this._getTherapistEmail(therapistId);
    if (email) {
      await this.mail.sendQuotaWarning(email, remaining).catch(() => {});
    }
  }

  // ============================================================
  // SUBSCRIPTION PLANS — Public
  // ============================================================

  async getPlans() {
    try {
      return await this.db.query(
        `SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY display_order ASC, monthly_price_usd ASC NULLS LAST`
      );
    } catch {
      this.logger.warn('subscription_plans query failed — table may be missing or schema incomplete');
      return [];
    }
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
      `SELECT s.*, sp.name AS plan_name, sp.features, sp.monthly_price_usd, sp.price_monthly_usd, sp.session_limit
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
    // Payment-mode: therapist paying a session charge
    if (session.mode === 'payment' && session.metadata?.session_charge_id) {
      const chargeId = session.metadata.session_charge_id;
      await this.db.execute(
        `UPDATE session_charges SET status = 'paid', paid_at = NOW() WHERE id = $1`,
        [chargeId],
      );
      // Notify therapist
      const therapistId = session.metadata.therapist_id;
      if (therapistId) {
        const email = await this._getTherapistEmail(therapistId);
        if (email) {
          this.mail.sendPaymentConfirmed(email).catch(() => {});
        }
      }
      return;
    }

    // Subscription mode
    const orgId = session.metadata?.organization_id;
    const planId = session.metadata?.plan_id;
    const planKey = session.metadata?.plan_key;
    const therapistId = session.metadata?.therapist_id;
    const seats = parseInt(session.metadata?.seats || '1');

    if (!orgId || !planId) return;

    // Deactivate existing subscriptions
    await this.db.execute(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE organization_id = $1 AND status IN ('active', 'trialing')`,
      [orgId],
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
      ],
    );

    // Update organization plan
    await this.db.execute(
      `UPDATE organizations SET plan_id = $1, updated_at = NOW() WHERE id = $2`,
      [planId, orgId],
    );

    // Update therapist(s) plan_key
    if (planKey && therapistId) {
      if (planKey === 'practice') {
        // All therapists in org
        await this.db.execute(
          `UPDATE therapists SET current_plan_key = $1 WHERE organization_id = $2`,
          [planKey, orgId],
        );
      } else {
        await this.db.execute(
          `UPDATE therapists SET current_plan_key = $1 WHERE id = $2`,
          [planKey, therapistId],
        );
      }
    }

    // Send subscription active email
    if (therapistId) {
      const email = await this._getTherapistEmail(therapistId);
      if (email) {
        this.mail.sendSubscriptionActive(email, planKey || 'plan').catch(() => {});
      }
    }
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
    const sub = await this.db.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM subscriptions WHERE stripe_subscription_id = $1`,
      [subscription.id],
    );
    await this.db.execute(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id],
    );
    // Revert therapists in org back to PAYG
    if (sub?.organization_id) {
      await this.db.execute(
        `UPDATE therapists SET current_plan_key = 'pay_per_session'
         WHERE organization_id = $1 AND current_plan_key IN ('starter','pro','practice')`,
        [sub.organization_id],
      );
    }
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

    const payouts: Array<{ payout_id: string; therapist_id: string; amount: number }> = [];
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

// Reviewed: 2026-06-13 — 24Therapy audit
