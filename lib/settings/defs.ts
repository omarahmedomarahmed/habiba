/**
 * Every figure that used to be a constant.
 *
 * This module is deliberately pure — no database import, no `server-only` — so
 * that the same definitions can be read by the server, shipped to the browser
 * as a snapshot, and asserted in a test that has no `DATABASE_URL`. The
 * database is the authority; what lives here is the *shape* of a setting and
 * the value we fall back to when the row is missing or corrupt.
 *
 * ## Why a fallback exists at all
 *
 * Sprint 1 says no pricing constant may remain in code, and this file looks
 * like a violation of that. It is not, and the distinction matters: nothing
 * here is *read* while a row exists. These values exist so that a settings
 * table that has not been seeded yet, or a jsonb value someone has hand-edited
 * into nonsense, degrades to a known price rather than to `undefined` — which
 * in a billing path is a charge of `NaN` cents, and in a cap is no cap at all.
 *
 * Each group is stored as one jsonb row rather than a column per figure, so
 * adding a setting in a later sprint is a seed, not a migration. Parsing is
 * field-by-field: one bad field falls back on its own and the rest of the group
 * survives, because a typo in the copilot allowance must not silently reset the
 * platform fee.
 */

import { CURRENCY_BY_ENTITY } from "@/lib/billing/money";


/**
 * 🔴 46.3 / C223 — a tier is a price threshold and an AI rate, never a count.
 *
 * It used to be `{ rateCents, minimumSessions }`, which encodes "ten sessions
 * at three dollars". That is a session bundle, and the offer is not a bundle:
 * **$30 buys $30 of credit and unlocks the $2 AI rate.** Those are different
 * objects and the second cannot be written in the first, because the money
 * buys credit spendable on any line and the rate is what the threshold bought.
 *
 * The consequence somebody will trip over: **the rate does not expire when the
 * credit does.** A therapist who spent their $60 still has the $1 AI rate. The
 * threshold was a purchase, not a subscription.
 *
 * The word "sessions" leaves the offer entirely, which is also why the public
 * pricing page is rewritten in the same sprint rather than later: $30 does not
 * buy ten of anything and a page that says it does is the false sentence
 * `lib/content/honesty.ts` exists to reject.
 */
/**
 * 🔴 62.1 / C323 — ONE BAND OF THE SEAT LADDER.
 *
 * `from` is the seat count at which this band starts and is inclusive. The band
 * that applies is the highest one whose `from` the count has reached, and it
 * then prices EVERY seat, which is what "retroactive rather than marginal"
 * means.
 *
 * `flatCents` and `perSeatCents` are exclusive: the first band is a flat price
 * with seats included, and the ones above it are per seat. A band carrying both
 * is a configuration nobody can explain on a pricing page, and `settingsProblem`
 * refuses it.
 */
export type SeatBand = {
  /** Seats at or above this count fall in this band. */
  from: number;
  /** A flat monthly price for the whole band. Zero when the band is per seat. */
  flatCents: number;
  /** A price per seat, applied to EVERY seat. Zero when the band is flat. */
  perSeatCents: number;
};

export type PricingTier = {
  key: string;
  name: string;
  /** What a therapist must spend, once, to hold this rate. 0 is pay as you go. */
  unlockCents: number;
  /** What one AI-assisted session costs them at this tier. */
  aiRateCents: number;
  /*
   * 🔴 Sprint 57 — the monthly price, and the reason the shape changed twice.
   *
   * C223 turned a session BUNDLE into a rate LOCK, because "$30 buys ten
   * sessions" is not what we sell. This turns a rate lock into a SUBSCRIPTION,
   * because a therapist cannot compare "$1 plus $2 a session" to anything, and
   * every competitor they will weigh us against quotes a month.
   *
   * The arithmetic was never the problem. At 25 sessions a week we take about
   * $3,000 a year, which is 1.7 to 2.5 times what the best-funded scribe in the
   * category charges. We were priced as a premium product and positioned as a
   * cheap one.
   *
   * `monthlyCents > 0` means UNLIMITED: the subscription is the whole price and
   * a session raises both lines at zero. It also removes a defect nobody had
   * named — the AI fee is incurred by the therapist and switched on by the
   * PATIENT, so a therapist carried a variable monthly bill decided session by
   * session by other people. An unlimited tier has no meter for a patient's
   * decision to move.
   */
  monthlyCents: number;
};

export type PlatformSettings = {
  pricing: {
    tiers: PricingTier[];
    /** How long bought credits last. */
    creditExpiryMonths: number;
    /**
     * 🔴 62.1 / C323 — SEATS, AND THE RATE IS RETROACTIVE RATHER THAN MARGINAL.
     *
     * The shipped ladder, repriced for Egypt in sprint 75:
     *
     *     1 seat        the solo price      $80
     *     2 or more     $72 each            $144 · $216 · $288 · …
     *
     * Reaching a band reprices EVERY seat, not just the ones above the
     * threshold. So the step from one seat to two is **$64 and not $72**: the
     * first seat drops from the solo rate to the clinic rate the moment there
     * are two of them. A marginal reading would give $80 + $72 = $152 where the
     * table says $144, and the gap compounds with every seat, so a clinic
     * reading the public table would be billed a number that never appears on
     * it.
     *
     * 🔴 THE FIRST BAND STARTS AT ONE SEAT ON PURPOSE. A ladder beginning at two
     * would bill a clinic that has dropped to a single clinician nothing at all,
     * and `settingsProblem` refuses exactly that shape. Pricing it at the solo
     * rate closes the gap without inventing a third number.
     *
     * ⚠️ It replaced a three-rung US ladder of $179 flat for two seats, then $90
     * each, then $80 each. Those were dollars nobody in Cairo was going to pay,
     * and a two-person practice was being asked $179 where two solo therapists
     * would have paid $160.
     */
    seatBands: SeatBand[];
    /**
     * 🔴 68.14 — WHAT ONE PARTNER SESSION COSTS, AND WHY IT IS PER SESSION.
     *
     * *Priced per session, not per call. They do the work; we transcribe, write and
     * assist.*
     *
     * A call-based price makes an integrator optimise against the product: fewer
     * copilot questions, a shorter transcript, a summary skipped. Per session the
     * incentive is to use what they already paid for, which is what we want a
     * therapist on their platform to do.
     *
     * A setting, like every other price here, so a reprice is a settings write and
     * the usage page, the bill and any published figure read the same row.
     */
    partnerSessionCents: number;
  };
  session: {
    /** Our cut of a patient payment, in basis points. */
    platformFeeBps: number;
    /**
     * 🔴 46.1 / 46.2 / C209 — charged on EVERY session, without exception.
     *
     * Free ones, in-person ones, and the ones where the patient declined
     * recording. This is the number that makes the AI fee safe to make
     * conditional: if the whole bill vanished on a refusal, a therapist would
     * have a financial reason to lean on the most vulnerable person in the
     * room.
     */
    platformFeeCents: number;
    /** Below this, the card processing fee eats the whole charge. */
    minPriceCents: number;
    maxPriceCents: number;
  };
  clock: {
    /** Nothing on screen for this long. */
    runningMinutes: number;
    /** Counted down on both screens, then a hard stop. */
    countdownMinutes: number;
    /** A gap this long past the running time means everyone has left. */
    silenceSeconds: number;
  };
  /**
   * 🔴 49.14b / C221 — what a model call costs us, per million tokens.
   *
   * These were constants in `lib/ai/client.ts`, so correcting a price a
   * provider had changed meant a deploy. They are settings now, for the reason
   * every other figure is: an operator should be able to fix a number that has
   * gone wrong in the world without waiting for a release.
   *
   * 🔴 `cost_microcents` stays FROZEN on the row at write time, so a rate
   * change prices the NEXT call and never rewrites history. That is the same
   * rule `session_credits.rate_cents` follows and the same reason: an admin
   * lowering a rate next March must not change what last week cost.
   *
   * Rates are in **hundredths of a cent per million tokens** so they stay
   * integers. Money in floating point is the bug family `cost_microcents`
   * exists to avoid, reintroduced one layer up.
   */
  aiRates: {
    /** By model id, per million tokens. */
    tokens: { model: string; inPerMTok: number; outPerMTok: number }[];
    /** By model id, per minute of audio. */
    audio: { model: string; perAudioMinute: number }[];
  };
  copilot: {
    /** Per patient, per session, rolling over on that patient. */
    messagesPerPatientPerSession: number;
    /** An unclaimed patient, unlocked by documenting them. */
    unclaimedPatientCredits: number;
    /** The general chat, per calendar month, across every thread. */
    generalMessagesPerMonth: number;
  };
  /**
   * The two rails. PLAN.md 16.1 — *"adding an Egyptian collection provider is
   * configuration, not code"*, which is only true if the configuration is
   * here rather than in a constant somebody has to deploy.
   */
  payouts: {
    /** Who collects EGP from patients. A key, resolved to an adapter. */
    egyptCollectionProvider: string;
    /** What a therapist may be paid by, in Egypt. */
    egyptPayoutMethods: string[];
    /**
     * 🔴 16.3d / C74 — above this, a payout needs a second person. Set it to
     * 0 and *every* payout needs two, which is the safe direction to be
     * wrong in; there is deliberately no way to switch the rule off.
     */
    twoPersonThresholdCents: number;
    /** 16.3b — a manual request older than this is overdue and alerts. */
    alertAfterHours: number;
    /**
     * 🔴 C69 / 17.1 — netting, behind a setting because it is a business
     * decision and not a technical one.
     *
     * On (the default): when we are already holding a clinician's money, the
     * session fee is taken out of it rather than billed separately, and 17's
     * "the session pays for itself out of your earnings" describes something
     * that actually happens. Off: the fee is invoiced as it always was and
     * that sentence must not be published.
     */
    netFeeFromHeldEarnings: boolean;
    /**
     * 🔴 C76 — the spread added to the mid-market rate when a therapist
     * chooses to settle in EGP, in basis points.
     *
     * Zero by default: we take no margin on the convenience. The number
     * exists so that a real settlement cost can be recovered *visibly* — it
     * is shown on the screen with the button (16.6b), never discovered on a
     * statement afterwards.
     */
    egpSpreadBps: number;
    /**
     * 🔴 73.1 — THE FALLBACK RAIL, AND IT IS A HUMAN BEING.
     *
     * `egyptCollectionProvider` above names a gateway we do not have yet, and
     * `topUpPot` refuses an Egyptian entity outright because of it. The cost
     * nobody had counted is that the entire Egyptian market then has no way to
     * pay us: three call centres, six clinics, nine therapists and every patient
     * behind them.
     *
     * So until there is a gateway, the rail is a bank transfer, and these are
     * the details a payer is shown. They sit beside the provider key rather than
     * in their own screen because they are the same decision: **how money
     * reaches us from Egypt.** The day the gateway arrives, one of these two is
     * switched off and the other is not.
     *
     * 🔴 The LABEL is data, not code. An operator adds "InstaPay handle" or
     * "Mobile wallet number" themselves, in their own words, in the order they
     * want it read, because which rails an Egyptian bank offers this quarter is
     * not something a deploy should be needed to keep up with.
     */
    transferFields: {
      /** Stable key, generated once, so reordering never re-points a value. */
      key: string;
      /** What the payer reads. The operator's words. */
      label: string;
      /** The account number, handle or name itself. */
      value: string;
      /** Greyed subtext under the value. An example, or where to find it. */
      hint: string;
      /** Lower sorts first. */
      position: number;
      /**
       * 🔴 Who sees this line. A patient does not need the corporate account and
       * a company does not need the wallet number, and showing everybody
       * everything is how somebody pays into the wrong one.
       */
      audiences: ("patient" | "therapist" | "clinic" | "company")[];
    }[];
    /**
     * Shown under the details, verbatim. Switched off the day cards work.
     *
     * Not a translated key because an operator has to be able to change the
     * sentence the same afternoon the gateway goes live.
     */
    cardsComingSoon: boolean;
    /**
     * 🔴 POUNDS PER DOLLAR, AND IT IS A DECISION RATHER THAN A QUOTE.
     *
     * `quoteFor` exists and would be the obvious source, and it is the wrong one
     * twice over. It refuses a `static` rate in production (C37, correctly: a
     * guessed rate must never settle a card payment), so in production it would
     * return nothing at all and the Egyptian rail would have no price to show.
     * And a market rate that moves hourly is not what this rail runs on anyway:
     * we are not hedging anything, an operator is reading a bank statement and
     * matching the number we asked for.
     *
     * So it is a rate an operator sets and can change the afternoon the pound
     * moves, stored on every payment it prices (`settles_cents`) so a row can
     * always be read back against the rate that made it.
     *
     * Pounds per dollar times a million, which is the unit `fx.ts` already
     * quotes in (`rateMicro`). One convention for rates, so nobody has to
     * remember which of two files means what by "rate".
     */
    egpRateMicro: number;
  };
  /**
   * 🔴 53.3 / 53.11 / 53.19b — the three corporate numbers, as settings.
   *
   * Every one of them is a number the plan explicitly says is a setting rather
   * than a constant, and each for its own reason:
   *
   * `minTopUpCents` because $5,000 is a commercial floor that a first customer
   * will argue about, and arguing about it should not need a deploy (53.11).
   *
   * `activityFloor` because it is the number that decides when a sponsor sees
   * nothing but a balance, and C229's differencing attack means the safe
   * direction is *up*. An operator who reads a leak report must be able to
   * raise it the same afternoon.
   *
   * `verifyCycleMonths` because C247's re-verification is the only thing that
   * can notice somebody left an organisation without a roster, and six months
   * is a guess about human patience, not a fact.
   */
  /**
   * 🔴 53.15 / C241 — WHAT MAKES AN INVOICE AN INVOICE.
   *
   * *"Receipt, VAT invoice and proof of payment that look like they came from a
   * company."* A company's invoice carries a legal name, an address and a tax
   * registration number, and until this group existed the product held none of
   * the three anywhere. A document without them is a screenshot of a number, and a
   * corporate customer's finance department will not accept one.
   *
   * Per entity, because there are two and they are different legal persons. The
   * Egyptian half is here and unreachable: `topUpPot` refuses an `eg` sponsor
   * until counsel has confirmed e-invoicing, which is C241's precondition. The
   * fields exist so that confirming it is a settings change rather than a deploy.
   */
  invoice: {
    /** By entity. Two rows, `us` and `eg`. */
    entities: {
      entity: string;
      legalName: string;
      address: string;
      /** VAT or tax registration number, printed on the document. */
      taxId: string;
      /** Prefixed to the sequence, so two entities never collide on a number. */
      numberPrefix: string;
      /**
       * 🔴 0147: what the Egyptian Tax Authority needs of the issuer, for the
       * Egyptian entity. The activity code is the one on its tax card, the
       * address is structured the way ETA reads it, and the item code is the
       * EGS code we register for "wellbeing credit".
       */
      eta?: {
        activityCode: string;
        branchId: string;
        governate: string;
        regionCity: string;
        street: string;
        buildingNumber: string;
        itemCode: string;
      };
    }[];
  };
  sponsor: {
    /** 53.11 — the smallest top-up we will take, in cents of the entity's currency. */
    minTopUpCents: number;
    /**
     * 🔴 76.1 — WHAT THE PLUS AND MINUS BUTTONS MOVE BY, on the pot screen.
     *
     * A company choosing a number is the one place in this product where the
     * payer types the amount, and a free text box in dollars is how somebody
     * sends us $5 or $50,000 by slipping on a zero. The stepper removes the
     * keyboard from the decision, so the step size IS the set of amounts we
     * accept, which makes it a commercial number rather than a style choice.
     */
    topUpStepCents: number;
    /**
     * 🔴 76.1 — THE TOP OF THE STEPPER, because a ladder has to end somewhere.
     *
     * The client renders labels it was handed rather than formatting numbers
     * itself (C84), so the set of amounts we can show is finite and this is its
     * ceiling. A company that wants more than this is a conversation with a
     * person, not a button, and at that size they were always going to want one.
     */
    maxTopUpCents: number;
    /**
     * 🔴 76.1 — THE CEILING ON A FREE CREDIT, WHICH USED TO BE THE TOP-UP FLOOR.
     *
     * `openPot` refused any welcome credit at or above `minTopUpCents`, on the
     * reasoning that anything that size is a purchase and belongs in the queue
     * where somebody actually sends money. That worked only while the floor was
     * $5,000 and the credit was $100, and it was a coincidence rather than a
     * relationship: dropping the floor to $100 would have made the $100 credit
     * the plan promises every company refuse itself.
     *
     * So the two numbers are separated. This one answers "how much may an
     * operator give away without anybody paying", and it is the one that should
     * be argued about in a pricing meeting.
     */
    maxWelcomeCreditCents: number;
    /**
     * 🔴 73.10 — WHAT A SESSION COSTS ON AVERAGE, for the sponsor's own arithmetic.
     *
     * "10% coverage" is abstract. "Your $100 covers 50 sessions" is a decision a
     * finance team can actually take, and it is the sum they would do on paper
     * before agreeing to anything. That sum needs an average session price.
     *
     * 🔴 It is an ESTIMATE and the screen says so. A real session is priced by
     * the therapist within `session.minPriceCents` and `session.maxPriceCents`,
     * so no single number is true of all of them. Showing a projection built on
     * an average without labelling it as one is how a company budgets for a
     * hundred sessions and gets sixty.
     *
     * A setting rather than a constant because it is a market fact that changes,
     * and the Egyptian benchmark the founders set is 1,000 EGP, or $20.
     */
    averageSessionCents: number;
    /** 53.3 / C229 — below this headcount a sponsor sees the balance and nothing else. */
    activityFloor: number;
    /** 53.19b / C247 — how often an identifier is re-checked. */
    verifyCycleMonths: number;
    /**
     * 🔴 60.3 / C311 — how much warning a REDUCTION gets, in days.
     *
     * Only a reduction. C344's asymmetry: being asked for less than you agreed
     * to needs no notice, being asked for more does. Thirty days by default,
     * which is a billing cycle and is long enough that somebody who books
     * monthly sees it before it reaches them.
     */
    coverageNoticeDays: number;
    /**
     * 🔴 61.9 / C350 — how many sessions a PROVISIONAL enrolment may fund.
     *
     * An HR match starts funding before the person confirms their mailbox,
     * because making them wait for an email means they pay for the first
     * session themselves and never come back. One is enough to attend while
     * the confirmation sits unread, and not enough for an unconfirmed match to
     * spend a term's budget.
     */
    provisionalSessions: number;
    /**
     * 🔴 W2-S10 / D1: WHEN A COMPANY SEES EACH SESSION'S MONEY ENTRY.
     *
     * `weekly` (the default) publishes a week's entries once the week is over,
     * shuffled, dated by the week: a live entry at a small company is a person
     * seen booking, and enrolled employees were told "not a date". `live`
     * shows each entry as soon as it is paid, still dated by its week. An
     * operator's decision, per the founder's; the safe direction is weekly.
     */
    ledgerPublishing: "weekly" | "live";
  };
  /**
   * 🔴 44.1 / C97 — THE CHECK-IN CADENCE IS A SETTING BECAUSE THE FOUNDER SAID TO PROVE IT.
   *
   * The requirement was six-hourly, and the ruling attached to it in the same breath:
   * *that cadence is the thing to prove rather than assume. Four unprompted messages a day is a
   * lot for somebody in distress, and a person who mutes it is worse off than one who was messaged
   * less. Ship it with a rate the admin controls, an opt-out, and a quiet window overnight.*
   *
   * So every number here is a number an operator can change the same afternoon they read a mute
   * report, without a deploy. That is the only way "measure the mute rate" leads anywhere: a
   * measurement nobody can act on within a day is a chart.
   *
   * 🔴 THE DEFAULT IS NOT SIX-HOURLY, and that is a decision rather than a slip.
   *
   * Six-hourly is the ceiling the founder named, not a floor to start at, and the safe direction
   * for an unproven cadence is the one that sends fewer. So the seed is once a day and the setting
   * goes down to six-hourly for an operator who has evidence. A product that starts at four
   * messages a day and tunes downward has already sent them.
   */
  checkins: {
    /** Whether the channel exists at all. Off until somebody turns it on deliberately. */
    enabled: boolean;
    /**
     * Hours between check-ins to one person. The founder's six-hourly is `6`; the seed is `24`.
     * Bounded below at 6 by `lib/checkins/policy.ts` so nobody can set it to minutes by accident.
     */
    everyHours: number;
    /**
     * 🔴 The quiet window, in the PATIENT's own timezone. Start and end hour, 0 to 23.
     *
     * In their zone rather than ours, because a quiet window on server time is a 3am message to
     * somebody three timezones away, which is the exact harm the window exists to prevent.
     */
    quietFromHour: number;
    quietToHour: number;
    /**
     * 🔴 The mute-rate ceiling, as a proportion. Above it the channel stops sending to ANYBODY.
     *
     * This is the part that makes "measure the mute rate" a mechanism rather than a chart. A
     * measurement that only produces a number is a measurement somebody reads next quarter; this
     * one halts the thing it measures. If more than this share of reachable patients have muted,
     * the cadence is wrong and continuing to send is choosing to be wrong at everybody.
     */
    muteRateHalt: number;
    /**
     * 🔴 W2-A08: where the mute rate is measured from. Null is "every mute
     * still standing", which is how the channel was built. An operator who has
     * changed the cadence resumes a halted channel by measuring from that
     * moment: the people who muted the old cadence stay muted, and the new one
     * is judged on its own mutes rather than halted forever by the last one's.
     */
    measuredSince: string | null;
  };
  /**
   * 🔴 0161 — THE RULES, AS SETTINGS (docs/DECISIONS.md, rounds one and two).
   *
   * Every tax, document, provider, timing and approval rule the founder ruled
   * on, and every one counsel or the accountant may still change. Each field
   * says whether the code applies it today or only stores it until the ruling
   * that gives it effect (docs/LONG-TERM.md). A stored-only field is shown as
   * such on the settings screen, so nobody reads a switch as a working rule.
   *
   * History: every save lands in `settings_history` with the whole value
   * before and after, and a change only ever prices what happens next.
   */
  rules: RulesSettings;
};

export type SellerModel = "agent" | "principal";
export type SessionVatRule = "exempt" | "standard";
export type TopUpVatRule = "standard" | "exempt";
export type TopUpDocumentRule = "receipt_and_eta_invoice" | "deposit_and_monthly_invoice";
export type RefundTo = "wallet" | "card";

export type RulesSettings = {
  tax: {
    /** Ruling 1. Stored; decides document wording once counsel answers Q1. */
    sellerModel: SellerModel;
    /**
     * Ruling 2, APPLIED. `exempt` puts no VAT on the session price a patient
     * pays (VAT Law 67/2016, exempt list item 39). `standard` charges the
     * country's rate on it, as the product did before 25 September.
     */
    sessionVat: SessionVatRule;
    /**
     * APPLIED to company top-ups and returns. `standard` is the country rate on
     * the whole top-up, as today; `exempt` is none. Waiting on counsel Q2 and Q7.
     */
    topUpVat: TopUpVatRule;
    /** Ruling 3, stored only, 0 until counsel answers Q5. Basis points. */
    payoutWithholdingBps: number;
    /** Stored only until counsel answers Q6: may a company deduct tax from a top-up. */
    topUpWithholding: boolean;
  };
  documents: {
    /** Ruling 4. B now; C built behind this switch, waiting on counsel Q7. */
    topUpDocument: TopUpDocumentRule;
  };
  /**
   * Ruling 13 and 13c, APPLIED. True means that act needs a second person.
   * Nobody ever approves their own payout, whatever these say.
   */
  approvals: {
    payouts: boolean;
    refunds: boolean;
    potReturns: boolean;
    verifications: boolean;
    transferWithoutProof: boolean;
    ledgerAdjustments: boolean;
    /** Hours a changed payout destination waits before the next payout. APPLIED. */
    payoutDetailsCooldownHours: number;
  };
  /** Ruling 12 and 13b. Names only; keys stay in the environment. */
  providers: {
    cardGateway: string;
    payouts: string;
    etaSigner: string;
  };
  /** How long a link works, APPLIED. */
  links: {
    sessionLinkHours: number;
    radarLinkHours: number;
    bookingLinkHoursAfterStart: number;
  };
  refunds: {
    /** Ruling 16: a paid booking cancelled this long before its start is refunded in full. */
    patientCancelWindowHours: number;
  };
  /** Rulings 5b to 5e. Applied by the in-person paid flow. */
  inPerson: {
    payThroughUs: boolean;
    potCover: boolean;
    potSessionsPerWeek: number;
    priceAboveList: boolean;
    refundIfNotStarted: boolean;
    refundTo: RefundTo;
  };
  /** Ruling 7. Applied by the wallet. 0 months means credit never expires. */
  wallet: {
    enabled: boolean;
    expiryMonths: number;
  };
  /** Ruling 15. APPLIED: days a person dropped from a staff list keeps the benefit. */
  enrolment: {
    listRemovalGraceDays: number;
  };
};

export const RULES_DEFAULTS: RulesSettings = {
  tax: {
    sellerModel: "agent",
    sessionVat: "exempt",
    topUpVat: "standard",
    payoutWithholdingBps: 0,
    topUpWithholding: false,
  },
  documents: { topUpDocument: "receipt_and_eta_invoice" },
  approvals: {
    payouts: false,
    refunds: true,
    potReturns: false,
    verifications: false,
    transferWithoutProof: true,
    ledgerAdjustments: true,
    payoutDetailsCooldownHours: 24,
  },
  providers: { cardGateway: "paymob", payouts: "paymob", etaSigner: "external" },
  links: { sessionLinkHours: 12, radarLinkHours: 3, bookingLinkHoursAfterStart: 4 },
  refunds: { patientCancelWindowHours: 24 },
  inPerson: {
    payThroughUs: true,
    potCover: true,
    potSessionsPerWeek: 2,
    priceAboveList: false,
    refundIfNotStarted: true,
    refundTo: "wallet",
  },
  wallet: { enabled: true, expiryMonths: 0 },
  enrolment: { listRemovalGraceDays: 14 },
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseRules(value: unknown): RulesSettings {
  const d = RULES_DEFAULTS;
  const v = record(value);
  const tax = record(v.tax);
  const documents = record(v.documents);
  const approvals = record(v.approvals);
  const providers = record(v.providers);
  const links = record(v.links);
  const refunds = record(v.refunds);
  const inPerson = record(v.inPerson);
  const wallet = record(v.wallet);
  const enrolment = record(v.enrolment);
  return {
    tax: {
      sellerModel: oneOf(tax.sellerModel, ["agent", "principal"] as const, d.tax.sellerModel),
      sessionVat: oneOf(tax.sessionVat, ["exempt", "standard"] as const, d.tax.sessionVat),
      topUpVat: oneOf(tax.topUpVat, ["standard", "exempt"] as const, d.tax.topUpVat),
      payoutWithholdingBps: int(tax.payoutWithholdingBps, d.tax.payoutWithholdingBps, {
        min: 0,
        max: 5_000,
      }),
      topUpWithholding: bool(tax.topUpWithholding, d.tax.topUpWithholding),
    },
    documents: {
      topUpDocument: oneOf(
        documents.topUpDocument,
        ["receipt_and_eta_invoice", "deposit_and_monthly_invoice"] as const,
        d.documents.topUpDocument,
      ),
    },
    approvals: {
      payouts: bool(approvals.payouts, d.approvals.payouts),
      refunds: bool(approvals.refunds, d.approvals.refunds),
      potReturns: bool(approvals.potReturns, d.approvals.potReturns),
      verifications: bool(approvals.verifications, d.approvals.verifications),
      transferWithoutProof: bool(approvals.transferWithoutProof, d.approvals.transferWithoutProof),
      ledgerAdjustments: bool(approvals.ledgerAdjustments, d.approvals.ledgerAdjustments),
      payoutDetailsCooldownHours: int(
        approvals.payoutDetailsCooldownHours,
        d.approvals.payoutDetailsCooldownHours,
        { min: 0, max: 24 * 14 },
      ),
    },
    providers: {
      cardGateway: str(providers.cardGateway, d.providers.cardGateway),
      payouts: str(providers.payouts, d.providers.payouts),
      etaSigner: str(providers.etaSigner, d.providers.etaSigner),
    },
    links: {
      sessionLinkHours: int(links.sessionLinkHours, d.links.sessionLinkHours, { min: 1, max: 24 * 7 }),
      radarLinkHours: int(links.radarLinkHours, d.links.radarLinkHours, { min: 1, max: 48 }),
      bookingLinkHoursAfterStart: int(
        links.bookingLinkHoursAfterStart,
        d.links.bookingLinkHoursAfterStart,
        { min: 1, max: 48 },
      ),
    },
    refunds: {
      patientCancelWindowHours: int(
        refunds.patientCancelWindowHours,
        d.refunds.patientCancelWindowHours,
        { min: 0, max: 24 * 14 },
      ),
    },
    inPerson: {
      payThroughUs: bool(inPerson.payThroughUs, d.inPerson.payThroughUs),
      potCover: bool(inPerson.potCover, d.inPerson.potCover),
      potSessionsPerWeek: int(inPerson.potSessionsPerWeek, d.inPerson.potSessionsPerWeek, {
        min: 0,
        max: 14,
      }),
      priceAboveList: bool(inPerson.priceAboveList, d.inPerson.priceAboveList),
      refundIfNotStarted: bool(inPerson.refundIfNotStarted, d.inPerson.refundIfNotStarted),
      refundTo: oneOf(inPerson.refundTo, ["wallet", "card"] as const, d.inPerson.refundTo),
    },
    wallet: {
      enabled: bool(wallet.enabled, d.wallet.enabled),
      expiryMonths: int(wallet.expiryMonths, d.wallet.expiryMonths, { min: 0, max: 120 }),
    },
    enrolment: {
      listRemovalGraceDays: int(enrolment.listRemovalGraceDays, d.enrolment.listRemovalGraceDays, {
        min: 0,
        max: 120,
      }),
    },
  };
}

/**
 * 🔴 Ruling 2 — the VAT on a session price, from the rule and the country.
 *
 * One function, so the pay page, the transfer quote, the card checkout and the
 * new-session preview can never disagree about whether a patient pays VAT.
 */
export function sessionVatBpsFor(rules: RulesSettings, countryVatBps: number): number {
  return rules.tax.sessionVat === "exempt" ? 0 : Math.max(0, countryVatBps);
}

/** The VAT on a company top-up or its return, from the rule and the country. */
export function topUpVatBpsFor(rules: RulesSettings, countryVatBps: number): number {
  return rules.tax.topUpVat === "exempt" ? 0 : Math.max(0, countryVatBps);
}

/**
 * The seed, and the fallback.
 *
 * These are the numbers in §3 of PLAN.md. Changing one here changes what a
 * fresh database is seeded with; it does not change a database that has
 * already been seeded, which is the whole point of the table.
 */
export const SETTINGS_DEFAULTS: PlatformSettings = {
  pricing: {
    /*
     * 46.2 / 46.3 — the figures, and the arithmetic that keeps them honest.
     *
     * The all-in cost of an AI session is unchanged at every tier: $1 platform
     * plus $3, $2 or $1 of AI is the $4, $3 and $2 that shipped. What changed
     * is that a session with no AI now costs $1 instead of $4, and a session
     * with AI is two visible lines instead of one opaque one.
     */
    tiers: [
      /*
       * 🔴 THE METERED DOOR: $1 for the room and $3 more for the note, and the
       * $3 is the one that rides on the patient's consent (C209).
       *
       * $4 a session is what makes $80 defensible, because it is exactly twenty
       * sessions and a therapist can do that division themselves. Below twenty
       * a month they are better off metered and the product must not push them;
       * above it the plan wins and the note writing comes free.
       *
       * ⚠️ The margin argument that used to sit here was written against a $99
       * plan and a US rate table, and it is superseded. The current floor is set
       * from the other end: a fifty-minute session costs us about $0.62 all in,
       * so a flat plan stops paying for itself past `price / 0.62` sessions,
       * which is 130 at $80 against roughly 120 for a heavy full-time load.
       * `verify:plan` holds both ends of that argument.
       */
      { key: "payg", name: "Pay as you go", unlockCents: 0, aiRateCents: 300, monthlyCents: 0 },
      /*
       * 🔴 $80 solo, and $144 for the smallest clinic, which is two seats at
       * $72. Both were US numbers until sprint 75: $99 and $179.
       *
       * `aiRateCents: 0` on both is the whole of what a plan buys. A subscriber
       * pays no base rate and no AI rate on any session, ever; a metered
       * account pays $1 for the room and $3 more when the patient consented.
       */
      { key: "practice", name: "Practice", unlockCents: 0, aiRateCents: 0, monthlyCents: 8000 },
      { key: "clinic", name: "Clinic", unlockCents: 0, aiRateCents: 0, monthlyCents: 14400 },
    ],
    creditExpiryMonths: 12,
    /*
     * 🔴 $72 A SEAT FROM TWO SEATS UP, AND NO LADDER.
     *
     * The clinic plan starts at two clinicians by definition: one clinician is
     * a solo practice on the $80 plan. $72 is ten per cent off that, which is a
     * rule rather than a number to remember, and it moves when the solo price
     * moves.
     *
     * ⚠️ It replaces a three-rung ladder starting at a $179 flat fee, which was
     * a US price nobody had re-pointed at Egypt. A two-clinician Cairo practice
     * was being asked for $179 where two solo therapists would have paid $160.
     *
     * The ladder is gone because it was solving a problem this plan does not
     * have: per-seat is already the discount, and a second discount at five
     * seats prices a small clinic above a large one per head for no reason
     * anybody could explain on a call.
     *
     * 🔴 AND THE FIRST BAND IS ONE SEAT AT THE SOLO PRICE, which is not a
     * rounding of the rule but a hole being closed. `settingsProblem` refuses a
     * ladder starting at two, and it is right to: a clinic that loses a
     * clinician and drops to one seat would otherwise be billed NOTHING, having
     * fallen between the solo plan it is not on and a band it no longer
     * reaches. One seat costs exactly what one therapist costs.
     */
    seatBands: [
      { from: 1, flatCents: 8_000, perSeatCents: 0 },
      { from: 2, flatCents: 0, perSeatCents: 7_200 },
    ],
    /*
     * 🔴 $3 a session. Set against what a session costs us to serve — the
     * transcription, the note, the copilot's calls — rather than against what a
     * therapist pays us, because a partner brings volume and brings none of the
     * support, the radar, the payouts or the patient relationship that our own
     * per-session fee covers.
     */
    partnerSessionCents: 300,
  },
  session: {
    platformFeeBps: 1500,
    platformFeeCents: 100,
    minPriceCents: 500,
    maxPriceCents: 50_000,
  },
  /*
   * 🔴 Ruling 6b: one session is 50 minutes IN TOTAL, the countdown included.
   * So the clock runs 40 quietly, counts the last 10 on both screens, and stops.
   */
  clock: {
    runningMinutes: 40,
    countdownMinutes: 10,
    silenceSeconds: 90,
  },
  /*
   * 49.14b — the same figures `lib/ai/client.ts` held, moved rather than
   * changed. Verified against the shipped constants by `verify:sprint49`, so a
   * transcription that cost 0.3c a minute yesterday costs 0.3c a minute today.
   */
  aiRates: {
    tokens: [
      { model: "gpt-4o", inPerMTok: 250, outPerMTok: 1000 },
      { model: "gpt-4o-mini", inPerMTok: 15, outPerMTok: 60 },
    ],
    audio: [
      { model: "gpt-4o-mini-transcribe", perAudioMinute: 0.3 },
      // Whisper is not wired up, but its rate is public and being here is what
      // makes switching to it a configuration change rather than a silent
      // mispricing.
      { model: "whisper-1", perAudioMinute: 0.6 },
    ],
  },
  copilot: {
    messagesPerPatientPerSession: 10,
    unclaimedPatientCredits: 5,
    generalMessagesPerMonth: 50,
  },
  payouts: {
    egyptCollectionProvider: "paymob",
    egyptPayoutMethods: ["instapay", "wallet"],
    twoPersonThresholdCents: 50_000,
    alertAfterHours: 12,
    netFeeFromHeldEarnings: true,
    egpSpreadBps: 0,
    /*
     * 🔴 EMPTY BY DEFAULT, and the screens say "not configured yet" rather than
     * inventing a plausible Egyptian bank account.
     *
     * A seeded example here would be an account number in a repository, and the
     * one thing worse than no payment details is wrong payment details that look
     * right. The operator types the real ones once.
     */
    transferFields: [],
    cardsComingSoon: true,
    /*
     * 50, which is the rate the operating plan is written against
     * (`EGP_PER_USD` in lib/finance/plans.ts) and a round number an operator can
     * hold in their head while checking a statement. Indicative, like every
     * other default here, and meant to be changed on the settings screen.
     */
    egpRateMicro: 50_000_000,
  },
  /*
   * 53.11 / 53.3 / 53.19b — $5,000, five people, six months.
   *
   * Six rather than the three the `sponsors` table still defaults to. The column
   * default was wrong against 53.19b and this is the number the product reads:
   * `verifyCycleMonths` here wins on every screen and in the pause job, and the
   * column default is corrected in the next migration rather than left as a
   * second opinion.
   */
  /*
   * 🔴 53.15 — EMPTY ON PURPOSE, and an invoice will not render without them.
   *
   * A seeded placeholder legal name would print on a real document handed to a
   * real finance department, and "24Therapy Inc." is not a company that exists
   * until somebody registers it. So these are blank and the invoice page refuses
   * to render until an operator fills them in, which is a screen that says what is
   * missing rather than a document that is quietly wrong.
   */
  invoice: {
    entities: [
      { entity: "us", legalName: "", address: "", taxId: "", numberPrefix: "US" },
      { entity: "eg", legalName: "", address: "", taxId: "", numberPrefix: "EG" },
    ],
  },
  sponsor: {
    /*
     * 🔴 76.1 — $100, down from $5,000.
     *
     * $5,000 was a floor written for a company signing an annual deal. It is the
     * wrong number for a launch market where the first customers are a foundry
     * and a textile mill trying us with one department, and at 10% coverage of a
     * $20 session it priced the smallest possible experiment at 2,500 sessions.
     * $100 is 50 sessions, which is a department for a month.
     */
    minTopUpCents: 10_000,
    topUpStepCents: 5_000,
    maxTopUpCents: 500_000,
    maxWelcomeCreditCents: 10_000,
    averageSessionCents: 2_000,
    activityFloor: 5,
    verifyCycleMonths: 6,
    coverageNoticeDays: 30,
    provisionalSessions: 1,
    ledgerPublishing: "weekly",
  },
  checkins: {
    /* 🔴 Off. A channel that messages every patient turns on deliberately or not at all. */
    enabled: false,
    /* 🔴 Once a day, not the six-hourly the requirement named. See the type above: the safe
       direction for an unproven cadence is fewer, and six-hourly is where an operator with
       evidence can go rather than where this starts. */
    everyHours: 24,
    /* 21:00 to 09:00 in the PATIENT's zone. */
    quietFromHour: 21,
    quietToHour: 9,
    /* One in five. Past that the channel halts rather than reporting. */
    muteRateHalt: 0.2,
    measuredSince: null,
  },
  rules: RULES_DEFAULTS,
};

export type SettingsGroup = keyof PlatformSettings;

export const SETTINGS_GROUPS = Object.keys(SETTINGS_DEFAULTS) as SettingsGroup[];

/* --------------------------------------------------------------- parsing -- */

/**
 * A whole number of the given unit, or the fallback.
 *
 * `Number.isSafeInteger` rather than `isFinite`: a float here is a fraction of
 * a cent that rounds differently in two places, and `1e21` is a cap that
 * overflows into a price nobody can pay.
 */
function int(value: unknown, fallback: number, opts: { min?: number; max?: number } = {}): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return fallback;
  if (opts.min !== undefined && value < opts.min) return fallback;
  if (opts.max !== undefined && value > opts.max) return fallback;
  return value;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function strings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return out.length > 0 ? out.map((v) => v.trim()) : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 🔴 62.1 — the seat ladder, parsed, sorted, and never trusted.
 *
 * Sorted by `from` ascending here rather than at every read, because
 * `seatMonthlyCents` walks the list looking for the highest band a count has
 * reached and a list in the wrong order gives the wrong answer silently. The
 * same reasoning `parseTiers` records about its own sort.
 *
 * A malformed list falls back to the shipped bands rather than to an empty one:
 * no bands means every clinic is billed zero, which is the failure direction
 * that looks fine on every screen until a month closes.
 */
function parseSeatBands(value: unknown, fallback: SeatBand[]): SeatBand[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;

  const bands = value
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      from: int(row.from, 1, { min: 1, max: 10_000 }),
      flatCents: int(row.flatCents, 0, { min: 0, max: 100_000_000 }),
      perSeatCents: int(row.perSeatCents, 0, { min: 0, max: 10_000_000 }),
    }))
    .sort((a, b) => a.from - b.from);

  return bands.length > 0 ? bands : fallback;
}

/**
 * 🔴 62.1 / C323 — WHAT A CLINIC PAYS A MONTH FOR `seats` SEATS.
 *
 * The band that applies is the highest one the count has REACHED, and it then
 * prices every seat. Retroactive, not marginal.
 *
 * The difference is not a rounding argument. On the shipped ladder, marginal at
 * four seats gives $80 + 3×$72 = $296 against the retroactive $288, and the gap
 * grows with every seat: a clinic reading the public table would be billed a
 * number that never appears on it.
 *
 * Pure, and here rather than in a query, for the reason `lib/billing/money.ts`
 * gives about all of this: money bugs are found by reading arithmetic.
 */
export function seatMonthlyCents(seats: number, bands: SeatBand[]): number {
  const count = Math.max(0, Math.floor(seats));
  if (count === 0) return 0;

  /*
   * Highest band reached. The list is sorted ascending by `parseSeatBands`, and
   * this walks it rather than trusting an index, so a hand-built array in a
   * test cannot be off by one.
   */
  let band: SeatBand | null = null;
  for (const candidate of bands) {
    if (candidate.from <= count) band = candidate;
  }

  /*
   * 🔴 No band reached means the count is below the first one, which for the
   * shipped ladder cannot happen (`from: 1`). An operator who sets the first
   * band to start at 3 has made a configuration where one and two seats cost
   * nothing, and the honest answer is zero rather than a guess at what they
   * meant. `settingsProblem` refuses that configuration separately.
   */
  if (!band) return 0;

  return band.perSeatCents > 0 ? band.perSeatCents * count : band.flatCents;
}

/**
 * 🔴 62.3 / 62.4 / C333 / C351 — WHAT CHANGING THE SEAT COUNT COSTS TODAY.
 *
 * Sprint 57 deferred proration and named the absence. This is it, and the shape
 * matters more than the arithmetic: **one figure, stated before the click.**
 *
 * ## 🔴 RETROACTIVE WITHIN THE PERIOD (C351)
 *
 * Going from one seat to two does not add one seat at $72. It reprices the
 * whole account from $80 to $144 for the remainder of the month, so the step is
 * $64 rather than $72. The difference is computed on the WHOLE monthly figure at
 * each count, not on the seats being added, and the remaining days decide how
 * much of that difference is owed now.
 *
 * ## 🔴 TO THE DAY, AND THE DAY THE CHANGE HAPPENS IS CHARGED
 *
 * A change made at 23:50 on the last day of a period costs one day, not zero:
 * the seat was available that day. Counting it as zero would let a clinic add
 * seats on the last evening of every month for nothing.
 *
 * ## 🔴 A REDUCTION IS A CREDIT, AND IT IS NEGATIVE HERE
 *
 * Returned rather than clamped, because the caller has to be able to say
 * "£41 back" on the screen. What happens to a credit is a billing decision
 * (62.5 says a released seat is never refunded, so the caller does not apply
 * this one) and not something this arithmetic gets to make.
 */
export type SeatChange = {
  fromSeats: number;
  toSeats: number;
  /** What the account costs a month at the old count and at the new one. */
  fromMonthlyCents: number;
  toMonthlyCents: number;
  /** Days left in the period, counting today. */
  daysRemaining: number;
  daysInPeriod: number;
  /** 🔴 The one figure. Positive is owed now, negative is a credit. */
  proratedCents: number;
};

export function seatChange(input: {
  fromSeats: number;
  toSeats: number;
  bands: SeatBand[];
  now: Date;
  periodStart: Date;
  periodEnd: Date;
}): SeatChange {
  const fromMonthlyCents = seatMonthlyCents(input.fromSeats, input.bands);
  const toMonthlyCents = seatMonthlyCents(input.toSeats, input.bands);

  const DAY = 24 * 60 * 60 * 1000;
  const daysInPeriod = Math.max(
    1,
    Math.round((input.periodEnd.getTime() - input.periodStart.getTime()) / DAY),
  );

  /*
   * 🔴 `ceil`, so the day the change is made is charged. A change at 23:50 on
   * the last day costs one day rather than zero, because the seat was available
   * that day and the alternative is free seats every last evening of the month.
   */
  const daysRemaining = Math.min(
    daysInPeriod,
    Math.max(0, Math.ceil((input.periodEnd.getTime() - input.now.getTime()) / DAY)),
  );

  const difference = toMonthlyCents - fromMonthlyCents;

  return {
    fromSeats: Math.max(0, Math.floor(input.fromSeats)),
    toSeats: Math.max(0, Math.floor(input.toSeats)),
    fromMonthlyCents,
    toMonthlyCents,
    daysRemaining,
    daysInPeriod,
    /*
     * Rounded once, at the end. Rounding the daily rate first and multiplying
     * is how a month of prorations drifts from the monthly figure by a few
     * cents that nobody can explain.
     */
    proratedCents: Math.round((difference * daysRemaining) / daysInPeriod),
  };
}

function parseTiers(value: unknown): PricingTier[] {
  if (!Array.isArray(value) || value.length === 0) return SETTINGS_DEFAULTS.pricing.tiers;

  const tiers: PricingTier[] = [];
  for (const raw of value) {
    const t = record(raw);
    const key = str(t.key, "");
    if (key === "") continue;
    tiers.push({
      key,
      name: str(t.name, key),
      /*
       * 🔴 46.3 — read the new shape, and CONVERT the old one rather than
       * reinterpreting its numbers.
       *
       * A database seeded before this sprint holds `{ rateCents,
       * minimumSessions }`, and settings are parsed on every read, so without
       * this the first read after deploy gives every therapist a free tier
       * until somebody re-saves the group.
       *
       * The first version of this fallback read `minimumSessions` as if it
       * were `unlockCents`, which turned "10 sessions" into ten cents. The
       * sprint 46 verifier printed `starter: $0.1` and that is how it was
       * caught. A field's number does not carry its unit; two fields that mean
       * different things need arithmetic between them, not an `??`.
       *
       * The honest conversion is the money the old bundle actually cost:
       *
       *   unlockCents = minimumSessions × rateCents   10 × $3 = $30
       *   aiRateCents = rateCents − platformFeeCents  $3 − $1 = $2
       *
       * Which reproduces the founder's $30 and $60 thresholds exactly, and
       * keeps the all-in price of an AI session unchanged at every tier. That
       * is not a coincidence: the old rate WAS the all-in price, and the split
       * only says which part of it is conditional.
       */
      unlockCents: int(
        t.unlockCents ?? Number(t.minimumSessions ?? 0) * Number(t.rateCents ?? 0),
        0,
        { min: 0, max: 10_000_000 },
      ),
      // A rate of zero is a real answer — a promotional tier — so the floor is
      // 0 rather than 1. There is no sensible ceiling below the price cap.
      // A tier stored before sprint 57 has no monthly price, which is what a
      // credit tier is: zero. Nothing is backfilled and nothing is re-derived.
      monthlyCents: int(t.monthlyCents ?? 0, 0, { min: 0, max: 1_000_000 }),
      aiRateCents: int(
        t.aiRateCents ?? Number(t.rateCents ?? 0) - SETTINGS_DEFAULTS.session.platformFeeCents,
        0,
        { min: 0, max: 1_000_000 },
      ),
    });
  }

  // An array that parsed to nothing usable is worse than no array: it would
  // leave a therapist with no rate to be billed at.
  if (tiers.length === 0) return SETTINGS_DEFAULTS.pricing.tiers;

  /*
   * Cheapest last is how they are shown and how `tierForSpend` walks them.
   *
   * 🔴 Sprint 57 — the tie-break is not cosmetic. Every tier this product now
   * ships has an `unlockCents` of zero, so a sort on that key alone leaves the
   * order entirely to whatever the admin last saved: the clinic tier could sort
   * ahead of the free one and become the headline rate on the public page. The
   * monthly price is the second axis, so free sorts first whatever order the
   * rows arrive in.
   */
  return tiers.sort((a, b) => a.unlockCents - b.unlockCents || a.monthlyCents - b.monthlyCents);
}

/** Merge one stored group over its defaults, field by field. */
export function parseGroup<G extends SettingsGroup>(
  group: G,
  value: unknown,
): PlatformSettings[G] {
  const d = SETTINGS_DEFAULTS;
  const v = record(value);

  switch (group) {
    case "pricing":
      return {
        tiers: parseTiers(v.tiers),
        seatBands: parseSeatBands(v.seatBands, d.pricing.seatBands),
        partnerSessionCents: int(v.partnerSessionCents, d.pricing.partnerSessionCents, {
          min: 0,
          max: 100_000,
        }),
        creditExpiryMonths: int(v.creditExpiryMonths, d.pricing.creditExpiryMonths, {
          min: 1,
          max: 120,
        }),
      } as PlatformSettings[G];

    case "session":
      return {
        // 10_000 bps is the entire payment. A fee of 100% is not a
        // configuration, it is a therapist who gets nothing.
        platformFeeBps: int(v.platformFeeBps, d.session.platformFeeBps, { min: 0, max: 9_000 }),
        /*
         * 🔴 46.2 — the floor is 1 cent, not 0, and the default answers for
         * every row seeded before this sprint.
         *
         * A stored `session` blob written before 46 has no such key, so
         * without this it parsed to `undefined` and every fee arithmetic
         * downstream produced NaN. The sprint 46 verifier caught exactly that
         * on its first run, which is what the pure check at the top of it is
         * there for: a NaN platform fee would have made every invoice in the
         * product NaN cents, and it would have shipped looking like nothing.
         */
        platformFeeCents: int(v.platformFeeCents, d.session.platformFeeCents, {
          min: 1,
          max: 100_000,
        }),
        minPriceCents: int(v.minPriceCents, d.session.minPriceCents, { min: 0, max: 1_000_000 }),
        maxPriceCents: int(v.maxPriceCents, d.session.maxPriceCents, { min: 1, max: 10_000_000 }),
      } as PlatformSettings[G];

    case "aiRates": {
      /*
       * 🔴 A rate that cannot be parsed falls back to the SHIPPED table, never
       * to an empty one.
       *
       * An empty table sends every model to `dearestRate()`, which overstates
       * rather than understates and is the safe direction (H12) — but it also
       * silently reprices the whole product because somebody mistyped a model
       * id. The shipped defaults are the honest floor.
       */
      const tokens = Array.isArray(v.tokens)
        ? v.tokens
            .map((raw) => {
              const t = record(raw);
              const model = str(t.model, "");
              if (!model) return null;
              return {
                model,
                inPerMTok: int(t.inPerMTok, 0, { min: 0, max: 1_000_000 }),
                outPerMTok: int(t.outPerMTok, 0, { min: 0, max: 1_000_000 }),
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
        : [];

      const audio = Array.isArray(v.audio)
        ? v.audio
            .map((raw) => {
              const a = record(raw);
              const model = str(a.model, "");
              if (!model) return null;
              const per = Number(a.perAudioMinute);
              return {
                model,
                perAudioMinute: Number.isFinite(per) && per >= 0 ? per : 0,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
        : [];

      return {
        tokens: tokens.length > 0 ? tokens : d.aiRates.tokens,
        audio: audio.length > 0 ? audio : d.aiRates.audio,
      } as PlatformSettings[G];
    }

    case "clock":
      return {
        runningMinutes: int(v.runningMinutes, d.clock.runningMinutes, { min: 1, max: 600 }),
        countdownMinutes: int(v.countdownMinutes, d.clock.countdownMinutes, { min: 0, max: 600 }),
        silenceSeconds: int(v.silenceSeconds, d.clock.silenceSeconds, { min: 10, max: 3_600 }),
      } as PlatformSettings[G];

    case "copilot":
      return {
        messagesPerPatientPerSession: int(
          v.messagesPerPatientPerSession,
          d.copilot.messagesPerPatientPerSession,
          { min: 0, max: 10_000 },
        ),
        unclaimedPatientCredits: int(
          v.unclaimedPatientCredits,
          d.copilot.unclaimedPatientCredits,
          { min: 0, max: 10_000 },
        ),
        generalMessagesPerMonth: int(
          v.generalMessagesPerMonth,
          d.copilot.generalMessagesPerMonth,
          { min: 0, max: 100_000 },
        ),
      } as PlatformSettings[G];

    case "payouts":
      return {
        egyptCollectionProvider: str(
          v.egyptCollectionProvider,
          d.payouts.egyptCollectionProvider,
        ),
        egyptPayoutMethods: strings(v.egyptPayoutMethods, d.payouts.egyptPayoutMethods),
        // No ceiling below the price cap, and a floor of zero, because zero
        // means "two people on everything" and that must stay reachable.
        twoPersonThresholdCents: int(
          v.twoPersonThresholdCents,
          d.payouts.twoPersonThresholdCents,
          { min: 0, max: 100_000_000 },
        ),
        alertAfterHours: int(v.alertAfterHours, d.payouts.alertAfterHours, {
          min: 1,
          max: 720,
        }),
        netFeeFromHeldEarnings:
          typeof v.netFeeFromHeldEarnings === "boolean"
            ? v.netFeeFromHeldEarnings
            : d.payouts.netFeeFromHeldEarnings,
        // 1000bps is 10% on top of the market rate. Anything beyond that is a
        // margin being hidden in a rate, which is the thing C76 forbids.
        egpSpreadBps: int(v.egpSpreadBps, d.payouts.egpSpreadBps, { min: 0, max: 1_000 }),
        /*
         * 🔴 73.1 — A FIELD WITHOUT A LABEL OR A VALUE IS DROPPED, not defaulted.
         *
         * A half-filled row on a payment-details screen reads as "we forgot to
         * put the number in", and a payer who cannot tell that from "there is no
         * number" transfers to the wrong place. Same ruling as the invoice
         * entities below: an unusable row is no row.
         *
         * `position` is renumbered from the array order rather than trusted, so
         * two rows can never claim the same slot and the list cannot be made
         * unstable by an edit that skipped a number.
         */
        transferFields: (Array.isArray(v.transferFields) ? v.transferFields : [])
          .map((raw) => {
            const row = record(raw);
            const label = str(row.label, "").trim();
            const value = str(row.value, "").trim();
            if (!label || !value) return null;
            const audiences = strings(row.audiences, []).filter((a) =>
              ["patient", "therapist", "clinic", "company"].includes(a),
            ) as ("patient" | "therapist" | "clinic" | "company")[];
            return {
              key: str(row.key, "").trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              label: label.slice(0, 80),
              value: value.slice(0, 200),
              hint: str(row.hint, "").trim().slice(0, 160),
              position: 0,
              /* No audience means nobody sees it, which is a mistake. Default to everyone. */
              audiences: audiences.length > 0 ? audiences : ["patient", "therapist", "clinic", "company"],
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .slice(0, 12)
          .map((row, i) => ({ ...row, position: i })),
        cardsComingSoon:
          typeof v.cardsComingSoon === "boolean" ? v.cardsComingSoon : d.payouts.cardsComingSoon,
        /*
         * 🔴 A FLOOR OF ONE POUND TO THE DOLLAR, not of zero.
         *
         * Zero would pass a `min: 0` check and then quote every Egyptian payer
         * "send 0 EGP", which is a rail that silently stops asking for money.
         * The ceiling is equally arbitrary and equally deliberate: a fat finger
         * that turns 50 into 50,000 must not reach a patient's screen.
         */
        egpRateMicro: int(v.egpRateMicro, d.payouts.egpRateMicro, {
          min: 1_000_000,
          max: 1_000_000_000,
        }),
      } as PlatformSettings[G];

    case "invoice": {
      /*
       * 🔴 The SHIPPED rows are the floor, so an unparseable blob leaves two empty
       * entities rather than none. An empty list would make `invoiceFor` find no
       * entity at all and the failure would read as "no such entity" rather than
       * "nobody has filled in the legal name", which is a different bug to chase.
       */
      const rows = Array.isArray(v.entities)
        ? v.entities
            .map((raw) => {
              const row = record(raw);
              const entity = str(row.entity, "");
              if (!entity) return null;
              return {
                entity,
                legalName: str(row.legalName, "").slice(0, 200),
                address: str(row.address, "").slice(0, 500),
                taxId: str(row.taxId, "").slice(0, 80),
                numberPrefix: str(row.numberPrefix, entity.toUpperCase()).slice(0, 8),
                ...(row.eta && typeof row.eta === "object"
                  ? {
                      eta: (() => {
                        const e = record(row.eta);
                        return {
                          activityCode: str(e.activityCode, "").slice(0, 10),
                          branchId: str(e.branchId, "0").slice(0, 10),
                          governate: str(e.governate, "").slice(0, 100),
                          regionCity: str(e.regionCity, "").slice(0, 100),
                          street: str(e.street, "").slice(0, 200),
                          buildingNumber: str(e.buildingNumber, "").slice(0, 100),
                          itemCode: str(e.itemCode, "").slice(0, 100),
                        };
                      })(),
                    }
                  : {}),
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
        : [];

      return {
        entities: rows.length > 0 ? rows : d.invoice.entities,
      } as PlatformSettings[G];
    }

    case "sponsor":
      return {
        /*
         * A floor of zero is deliberately unreachable. $0 minimum is not a
         * commercial decision, it is a pot that can be opened with nothing in
         * it and then reported on, and C229's differencing attack is easiest
         * against a pot with one person and one dollar in it.
         */
        minTopUpCents: int(v.minTopUpCents, d.sponsor.minTopUpCents, {
          min: 1_000,
          max: 1_000_000_000,
        }),
        /*
         * 🔴 The step has a floor of $1 and a ceiling of the smallest top-up.
         *
         * A step larger than the minimum would mean the first press of Plus
         * jumps past the floor, so the cheapest thing a company could buy would
         * not be the cheapest thing we advertise. A step of zero would make the
         * buttons do nothing, which is worse than not rendering them.
         */
        topUpStepCents: int(v.topUpStepCents, d.sponsor.topUpStepCents, {
          min: 100,
          max: 1_000_000_000,
        }),
        /*
         * 🔴 The ceiling of the ladder. Not bounded against the floor here,
         * because `potTopUpLadder` starts at the floor and stops at or before
         * this: a ceiling below the floor yields one rung rather than an error,
         * and one rung is a screen that offers the minimum and nothing else,
         * which is a coherent thing for an operator to have configured.
         */
        maxTopUpCents: int(v.maxTopUpCents, d.sponsor.maxTopUpCents, {
          min: 1_000,
          max: 1_000_000_000,
        }),
        /*
         * 🔴 Zero is a real answer and it means "we do not give credit away".
         * There is no upper bound tied to the top-up floor any more, on purpose:
         * see the note on the field. What stops an operator granting a fortune
         * is this number, and it is theirs to set.
         */
        maxWelcomeCreditCents: int(v.maxWelcomeCreditCents, d.sponsor.maxWelcomeCreditCents, {
          min: 0,
          max: 1_000_000_000,
        }),
        /*
         * 🔴 Bounded by the same floor and ceiling a real session is priced
         * between, so an average can never sit outside the range of the thing it
         * is an average of. Zero would make the sponsor's estimate divide by it.
         */
        averageSessionCents: int(v.averageSessionCents, d.sponsor.averageSessionCents, {
          min: 100,
          max: 100_000,
        }),
        /*
         * 🔴 THE FLOOR CANNOT BE SET BELOW TWO, and there is no way to switch
         * it off — the same construction as `twoPersonThresholdCents`, for the
         * same reason. A floor of 1 means a sponsor with one enrolled person
         * reads that person's weekly therapy spend, by name, from a chart.
         */
        activityFloor: int(v.activityFloor, d.sponsor.activityFloor, { min: 2, max: 1_000 }),
        verifyCycleMonths: int(v.verifyCycleMonths, d.sponsor.verifyCycleMonths, {
          min: 1,
          max: 60,
        }),
        /*
         * 🔴 A FLOOR OF SEVEN DAYS, and no way to set it to zero.
         *
         * The same construction as `activityFloor` above and for the same kind
         * of reason: the setting exists so an operator can be more generous
         * than the default, not so a reduction can be made to bite the same
         * afternoon it is typed. A patient who books weekly needs to see the
         * change before it reaches them.
         */
        coverageNoticeDays: int(v.coverageNoticeDays, d.sponsor.coverageNoticeDays, {
          min: 7,
          max: 365,
        }),
        /*
         * 🔴 A CEILING as well as a floor. Zero is legal — an operator who
         * wants no provisional funding at all is making a real choice — but the
         * upper bound stops "unlimited until they confirm" being typed into a
         * box by somebody who has not thought about what an unconfirmed HR
         * feed can spend.
         */
        provisionalSessions: int(v.provisionalSessions, d.sponsor.provisionalSessions, {
          min: 0,
          max: 10,
        }),
        /* W2-S10: anything but the one word `live` is the safe default. */
        ledgerPublishing: v.ledgerPublishing === "live" ? "live" : "weekly",
      } as PlatformSettings[G];

    /*
     * 🔴 W2-A08: THIS GROUP HAD NO CASE, SO EVERY STORED VALUE WAS IGNORED.
     *
     * It fell through to `default`, which returns the shipped defaults, so
     * even a row somebody wrote by hand could not turn the channel on, change
     * its cadence or move the halt. The page said "every number is yours to
     * change" over numbers nothing read. Bounded like the rest: never more
     * often than six-hourly (the ceiling the founder named, and the same floor
     * `lib/checkins/policy.ts` keeps), hours inside a day, and a halt between
     * one per cent and all of them.
     */
    case "checkins": {
      const halt = typeof v.muteRateHalt === "number" && Number.isFinite(v.muteRateHalt) ? v.muteRateHalt : NaN;
      const since = typeof v.measuredSince === "string" ? new Date(v.measuredSince) : null;
      return {
        enabled: typeof v.enabled === "boolean" ? v.enabled : d.checkins.enabled,
        everyHours: int(v.everyHours, d.checkins.everyHours, { min: 6, max: 24 * 14 }),
        quietFromHour: int(v.quietFromHour, d.checkins.quietFromHour, { min: 0, max: 23 }),
        quietToHour: int(v.quietToHour, d.checkins.quietToHour, { min: 0, max: 23 }),
        muteRateHalt: halt >= 0.01 && halt <= 1 ? halt : d.checkins.muteRateHalt,
        measuredSince: since && !Number.isNaN(since.getTime()) ? since.toISOString() : null,
      } as PlatformSettings[G];
    }

    case "rules":
      return parseRules(value) as PlatformSettings[G];

    default:
      return d[group];
  }
}

/**
 * A price cap below the floor makes every price invalid and no error explains
 * why. Caught here rather than in the form, because the two figures are edited
 * on different rows and neither edit is wrong on its own.
 */
export function settingsProblem(settings: PlatformSettings): string | null {
  if (settings.session.maxPriceCents < settings.session.minPriceCents) {
    return "The price cap is below the minimum chargeable price.";
  }

  /*
   * 🔴 62.1 / C323 — THE SEAT LADDER MUST NOT REWARD BUYING A SEAT.
   *
   * A retroactive ladder can go backwards: three seats at $72 each is $216, and
   * if somebody set the five-seat band to $50 then five seats would cost $250.
   * A clinic with four clinicians would then pay less by buying a fifth they do
   * not have, and every one of them would, because it is arithmetic rather than
   * a loophole.
   *
   * This is 59.11's floor rail in a second place, and it is here rather than in
   * the editor for the same reason: a rule enforced in a form holds for one
   * button. Checked over the real bands and a margin above the top one, because
   * the failure is at a band edge and nowhere else.
   */
  const bands = settings.pricing.seatBands;
  if (bands.length === 0) return "There has to be at least one seat band.";
  if (bands[0]!.from > 1) {
    return "The first seat band has to start at one seat, or a clinic with one seat is billed nothing.";
  }

  const ceiling = Math.max(...bands.map((b) => b.from)) + 2;
  for (let seats = 1; seats < ceiling; seats += 1) {
    if (seatMonthlyCents(seats + 1, bands) < seatMonthlyCents(seats, bands)) {
      return `Seat pricing goes backwards: ${seats + 1} seats would cost less than ${seats}. A clinic would buy a seat it does not need, and every one of them would.`;
    }
  }

  for (const band of bands) {
    if (band.flatCents > 0 && band.perSeatCents > 0) {
      return "A seat band is either a flat price or a price per seat, never both. Nobody can explain the other one on a pricing page.";
    }
    if (band.flatCents === 0 && band.perSeatCents === 0) {
      return "A seat band with no price bills nothing for every clinic that reaches it.";
    }
  }
  /*
   * 🔴 Sprint 57 / C289 — the free door is a tier with NO threshold AND NO
   * monthly price, and the old rail only asked about the threshold.
   *
   * That is this repository's §6 family arriving in the rails themselves: after
   * sprint 57 every tier has a zero threshold, including the clinic one, so the
   * check went on passing while describing a condition that no longer held. An
   * admin could delete pay-as-you-go outright and the only rail meant to stop
   * them would raise nothing, leaving a therapist who has bought nothing billed
   * at whatever tier happened to sort first.
   */
  if (!settings.pricing.tiers.some((t) => t.unlockCents === 0 && t.monthlyCents === 0)) {
    return "No tier is free to be on, so a therapist who has bought nothing has no rate at all.";
  }
  /*
   * 🔴 A subscription is bought, never earned. A tier carrying both a monthly
   * price and a credit threshold reads as "spend $60 and the clinic plan is
   * yours", which `tierForSpend` will not honour: it walks credit tiers only.
   * A control that promises something the billing code refuses is worse than no
   * control, so the configuration is refused instead of quietly ignored.
   */
  const bothAxes = settings.pricing.tiers.find((t) => t.monthlyCents > 0 && t.unlockCents > 0);
  if (bothAxes) {
    return `"${bothAxes.name}" has both a monthly price and a credit threshold. A subscription is bought, not unlocked by spending.`;
  }
  /*
   * 🔴 46.2 — a platform fee of zero is a configuration, not a typo, and it is
   * the one C209 forbids. Zero means a therapist who never seeks consent gets
   * unlimited hosted video for nothing, which is half the defect this sprint
   * exists to fix. An admin who wants a promotion lowers the AI rate.
   */
  if (settings.session.platformFeeCents <= 0) {
    return "The platform fee is what makes the AI fee safe to make conditional. It cannot be zero.";
  }
  return null;
}

/* ------------------------------------------------------------- countries -- */

export type CountrySettings = {
  code: string;
  name: string;
  /** VAT the patient pays on top, in basis points. Egypt is 1400. */
  vatBps: number;
  /** ISO 4217, lowercase, as Stripe wants it. */
  currency: string;
  /** Payment method keys offered in this country. */
  paymentMethods: string[];

  /**
   * 20.3 — the two rails, per country.
   *
   * `collectionProvider` is how a patient here pays us; `payoutMethods` is how
   * a clinician here is paid. **Both empty is the interesting case**: a
   * country we can name and cannot transact in, which the admin screen lists
   * by itself, because a clinician who signed up somewhere with no rail is a
   * person we cannot pay rather than a row in a spreadsheet.
   */
  collectionProvider: string | null;
  payoutMethods: string[];
  /** Which entity collects here (§3c). */
  entity: "us" | "eg";

  /**
   * 🔴 21R.8 / C98 — the crisis line for this country, entered by a person.
   *
   * Null is the honest default and renders "call your local emergency number",
   * which is always true and always actionable. A wrong number is worse than
   * none, so nothing here is ever seeded or guessed.
   */
  crisisLineLabel: string | null;
  crisisLineTel: string | null;

  /** 20.4 / 20.5 — what we ask for here, and who licenses it. */
  regulators: string[];
  idLabelFront: string | null;
  idLabelBack: string | null;
  licenceLabel: string | null;
  sampleImageUrl: string | null;

  enabled: boolean;
};

/** 20.3 — a country nobody can pay into or out of. */
export function hasNoRail(country: CountrySettings): boolean {
  return !country.collectionProvider && country.payoutMethods.length === 0;
}

/**
 * 🔴 59.6 / C357 — WHY THIS CLINICIAN CANNOT BE PUT IN FRONT OF A PATIENT, or null.
 *
 * ## The defect this closes, which is C218's shape a third time
 *
 * `hasNoRail` has existed since sprint 20 and was read by exactly one thing:
 * an amber card on the admin settings screen. So an operator could see, in
 * writing, that a country had no way to take money in and no way to send money
 * out, while a clinician there went on the radar, was booked by a patient, held
 * a session, and discovered the problem at payout.
 *
 * 59.7 states the rule this is the first instance of: **an operator FACT that
 * nothing acts on is as dead as an operator switch nothing reads.** C218 ruled
 * that about `enabled`; C381 found it again on `collection_provider`; this is
 * the same sentence about `payout_methods`.
 *
 * ## 🔴 WHY A CLINICIAN WITH NO COUNTRY IS NOT REFUSED
 *
 * Same reasoning `listRadar` already gives about its own country filter: a
 * clinician who has not filed a verification has no country, and refusing them
 * would close the radar on everybody mid-onboarding. An unknown country is not
 * a known-bad one, and the honest failure here is to let them work and to catch
 * the payout question where it is actually asked.
 *
 * ## The message is for the CLINICIAN, not for a patient
 *
 * Unlike `collectionProblem`, which a patient reads on a pay page. This one is
 * shown on the clinician's own dashboard, so it names the thing they can act
 * on: talk to us, because the answer is a commercial arrangement rather than a
 * setting they can change.
 */
export function radarProblem(country: CountrySettings | null): string | null {
  if (!country) return null;

  if (!country.enabled) {
    return "We have not opened in your country yet, so you cannot appear on the radar. Your existing patients and sessions are unaffected. Talk to us and we will tell you where we are.";
  }
  if (hasNoRail(country)) {
    return "There is no way to take a payment or send a payout in your country yet, so you cannot appear on the radar. Everything else works: you can still hold sessions, write notes and invite your own patients. Talk to us before you rely on being paid through us.";
  }
  if (country.payoutMethods.length === 0) {
    return "We have no way to pay you in your country yet, so you cannot appear on the radar. You can still hold sessions and write notes. Talk to us and we will arrange it.";
  }
  return null;
}

/**
 * 🔴 C381 — the collection providers this code can actually USE.
 *
 * `collection_provider` is written by the seed, edited on an admin screen,
 * asserted by `verify:sprint20`, and **read by no payment code at all**. Egypt
 * is seeded `paymob`; there is no paymob integration anywhere in this
 * repository; and every enabled country was routed through Stripe regardless.
 *
 * That is C218's ruling word for word, on a second column: *a switch an
 * operator can set is read by the code, or it does not exist. A dead control is
 * worse than a missing feature, because a missing feature does not tell
 * somebody they have acted.*
 *
 * Sprint 64 adds the Egyptian adapter and this list gains a second entry. Until
 * then an Egyptian checkout is REFUSED with a sentence a patient can act on,
 * rather than silently charged through a rail their card cannot use and their
 * money cannot legally arrive on.
 */
export const IMPLEMENTED_COLLECTION_PROVIDERS = ["stripe"] as const;

/**
 * Why we cannot take a payment in this country, or null.
 *
 * 🔴 C357's sibling. `hasNoRail` answers the same question for the ADMIN screen
 * and is read by nothing else, so a clinician in a railless country could be
 * booked and paid and only discover it at payout. This is the version the
 * payment path calls, and the message is written to be shown to a patient.
 */
export function collectionProblem(country: CountrySettings): string | null {
  if (!country.enabled) {
    return "We are not taking payments in that country yet. Ask your therapist for a free link: the session itself works exactly the same.";
  }
  if (!country.collectionProvider) {
    return "We have no way to take a card payment in that country yet. Ask your therapist for a free link: the session itself works exactly the same.";
  }
  if (
    !(IMPLEMENTED_COLLECTION_PROVIDERS as readonly string[]).includes(country.collectionProvider)
  ) {
    /*
     * The operator has named a provider we have not built. Say so plainly
     * rather than falling back to another one: a silent fallback collects the
     * money into the wrong entity, in the wrong currency, under the wrong
     * licence, and looks like success from every screen.
     */
    return "Card payments in that country are not switched on yet. Ask your therapist for a free link: the session itself works exactly the same.";
  }
  return null;
}

/**
 * Seeded countries.
 *
 * Only the two we can state a rate for. A VAT rate is a legal fact about a
 * jurisdiction, and seeding a guess is worse than seeding nothing: a guessed
 * 0% is an under-collection somebody eventually owes, and a guessed 20% is
 * money taken from a patient for a tax that does not exist. Every other
 * country is added by an admin in sprint 15, and until then
 * `requireCountrySettings` refuses to price a session there.
 */
export const COUNTRY_SEED: CountrySettings[] = [
  {
    code: "EG",
    name: "Egypt",
    vatBps: 1400,
    currency: "egp",
    paymentMethods: ["card"],
    /*
     * 20.3 — Egypt is the local rail: an Egyptian collector takes the money
     * in, the Egyptian entity holds it, and a clinician here is paid by
     * InstaPay or a wallet. §3c, made data.
     */
    collectionProvider: "paymob",
    payoutMethods: ["instapay", "wallet"],
    entity: "eg",
    /*
     * 🔴 NULL, IN THE FIRST MARKET, AND DELIBERATELY.
     *
     * Egypt publishes a national mental health and addiction hotline, and this
     * file is not where somebody's recollection of it becomes a `tel:` href. A
     * wrong crisis number is worse than none: it looks like help, presses like
     * help, and does nothing, which is the exact defect `lib/crisis/line.ts`
     * was written to fix.
     *
     * An operator enters it on the admin country screen, with a phone in their
     * hand, and the screen carries their name and the date. Until then the
     * product says "call your local emergency number", which is true.
     */
    crisisLineLabel: null,
    crisisLineTel: null,
    /* 20.4 / 20.5 — seeded from `lib/regulators.ts`, editable from admin. */
    regulators: ["Egyptian Ministry of Health and Population"],
    idLabelFront: "National ID (البطاقة), front",
    idLabelBack: "National ID (البطاقة), back",
    licenceLabel: "Practising licence or syndicate card",
    sampleImageUrl: null,
    enabled: true,
  },
  {
    code: "US",
    name: "United States",
    vatBps: 0,
    currency: "usd",
    paymentMethods: ["card"],
    collectionProvider: "stripe",
    payoutMethods: ["stripe"],
    entity: "us",
    /*
     * 🔴 Null here too, even though 988 is in `CRISIS_LINES` and correct.
     *
     * The seed is what a fresh database gets, and the reader falls back to the
     * verified table when the column is empty, so 988 still renders. Writing it
     * here as well would create a second place the United States lifeline is
     * stated, and two places is how they come to disagree.
     */
    crisisLineLabel: null,
    crisisLineTel: null,
    regulators: [],
    idLabelFront: "Driver's licence or passport, front",
    idLabelBack: "Driver's licence or passport, back",
    licenceLabel: "State licence",
    sampleImageUrl: null,
    enabled: true,
  },
];

export function parseCountry(row: {
  code: string;
  name: string;
  vatBps: number;
  currency: string;
  paymentMethods: unknown;
  collectionProvider?: string | null;
  payoutMethods?: unknown;
  entity?: string | null;
  crisisLineLabel?: string | null;
  crisisLineTel?: string | null;
  regulators?: unknown;
  idLabelFront?: string | null;
  idLabelBack?: string | null;
  licenceLabel?: string | null;
  sampleImageUrl?: string | null;
  enabled: boolean;
}): CountrySettings {
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  return {
    code: row.code.toUpperCase(),
    name: row.name,
    vatBps: int(row.vatBps, 0, { min: 0, max: 9_000 }),
    /*
     * 🔴 TWO CURRENCIES, AND THE ENTITY DECIDES WHICH. Founder, 2026-09-14.
     *
     * > *Only 2 currencies for now, EGP in Egypt and USD for the rest of the
     * > world. We will add GBP and EUR soon, but in those countries price with
     * > USD and pay with USD and payouts in USD.*
     *
     * So this column is not a free choice, it is a restatement of the entity,
     * and it is derived rather than trusted. An operator adding the United
     * Kingdom types a country, a regulator and a document list; if they also
     * type `gbp` they have created a Stripe checkout in a currency with no
     * acquirer, no VAT rate, no payout rail and no ledger account behind it,
     * and every screen downstream would have shown it working.
     *
     * C218's rule, applied to the column next door to the one it was written
     * about: a switch an operator can set is read by the code, or it does not
     * exist. Nothing in this product can collect a pound, so nothing may store
     * one.
     */
    currency: CURRENCY_BY_ENTITY[row.entity === "eg" ? "eg" : "us"],
    paymentMethods: list(row.paymentMethods),
    collectionProvider: row.collectionProvider?.trim() || null,
    payoutMethods: list(row.payoutMethods),
    entity: row.entity === "eg" ? "eg" : "us",
    /*
     * 🔴 BOTH OR NEITHER, in the parser as well as in the CHECK.
     *
     * A label with no tel renders a number nobody can press; a tel with no
     * label renders a button with no name. Either half alone is a worse state
     * than the honest empty one, and this is the half of the rule that applies
     * to a row already in memory.
     */
    crisisLineLabel:
      row.crisisLineLabel?.trim() && row.crisisLineTel?.trim()
        ? row.crisisLineLabel.trim()
        : null,
    crisisLineTel:
      row.crisisLineLabel?.trim() && row.crisisLineTel?.trim()
        ? row.crisisLineTel.trim()
        : null,
    regulators: list(row.regulators),
    /*
     * Empty means "not configured", which the accessor turns into the shipped
     * fallback in `lib/regulators.ts` — an empty string here would instead
     * mean "we ask for a document with no name", and a clinician staring at a
     * blank label is exactly the support ticket 20.4 is trying to remove.
     */
    idLabelFront: row.idLabelFront?.trim() || null,
    idLabelBack: row.idLabelBack?.trim() || null,
    licenceLabel: row.licenceLabel?.trim() || null,
    sampleImageUrl: row.sampleImageUrl?.trim() || null,
    enabled: row.enabled,
  };
}

/* ----------------------------------------------------------------- money -- */

/**
 * VAT, and the reason it is its own function.
 *
 * §3: the patient pays VAT on top of everything. Rounding is half-up on the
 * patient's side of the line, which is the direction a tax authority expects.
 *
 * ## 🔴 THIS COMMENT USED TO STATE A REFUND POLICY THE CODE DOES NOT HAVE
 *
 * It read: *"a refund returns our cut but never the VAT, because the VAT was
 * remitted to a government that is not refunding it because a session was
 * cancelled."* `refundSession` calls `refunds.create` with no `amount`, which
 * refunds the WHOLE charge including the tax line, and has always done so.
 *
 * So the sentence was a policy nobody implemented, sitting where somebody
 * reading the arithmetic would take it for a description of the arithmetic.
 * The same shape as C246's index comment and C377's floor: a rule written in
 * one place and absent from the one that would perform it.
 *
 * 🔴 THE BEHAVIOUR IS KEPT AND THE SENTENCE IS DROPPED, deliberately. Refunding
 * a tax on a service that never happened is the right answer to a patient, and
 * the mechanism for reclaiming it exists: a credit note. Keeping a patient's tax
 * on a cancelled session because reclaiming it is paperwork is not a position
 * this product should take in a comment nobody argued about.
 *
 * 🔴 It is also moot until Egypt opens. VAT here is Egypt only, Egypt collects
 * through its own gateway, and `refunds.create` is the Stripe path where the
 * rate is zero. The Egyptian refund path does not exist yet, and when it is
 * built it has to issue an ETA credit note rather than a bare reversal.
 */
/**
 * 🔴 60.1 / C311 / C312 — HOW A COVERED SESSION SPLITS, AS ARITHMETIC.
 *
 * Pure, and in this file rather than in `pot.ts`, for the reason the whole of
 * `lib/billing/money.ts` gives: money bugs are found by reading arithmetic, and
 * arithmetic buried in a query is arithmetic nobody reads.
 *
 * ## 🔴 ONE SHARE IS COMPUTED AND THE OTHER IS THE REMAINDER
 *
 * 60% of $70 is $42 and 40% of $70 is $28, and those happen to sum. 60% of
 * $69.99 is $41.994 and 40% is $27.996, and rounding each gives $41.99 and
 * $28.00, which is $69.99 — this time. Change the price and it is not. Two
 * numbers that are each individually defensible and do not sum is how a cent
 * falls out of the books in a direction nobody chose, and the database now
 * refuses to store the result.
 *
 * So the sponsor's share is computed, rounded once, and the patient's share is
 * whatever is left. The remainder always lands on the patient's side, which
 * costs at most one cent and is the side that can actually see the arithmetic
 * on their own bill.
 *
 * ## 🔴 C312 — VAT IS ON THE PATIENT'S SHARE ONLY
 *
 * The sponsor's share was taxed when the pot was funded, in the jurisdiction of
 * the entity that holds it, which `lib/billing/pot.ts` already reasons at
 * length. Charging VAT again on the spend would tax the same money twice, and
 * charging it in the PATIENT's country would invent a tax relationship between
 * an employee and their employer's purchase.
 *
 * ## 🔴 C313 — THE THERAPIST IS PAID ON THE FULL PRICE, ALWAYS
 *
 * And our cut is on the full price. Nothing about the split reaches an earnings
 * screen, because who paid for a session is not a fact about the clinician's
 * work and putting it there is C243's leak arriving through a new column.
 */
export type CoverageSplit = {
  /** What the employer pays, in cents. Computed and rounded once. */
  sponsorCents: number;
  /** What the patient pays before tax. The remainder, so the two always sum. */
  patientCents: number;
  /** 🔴 C312 — on the patient's share alone. */
  vatCents: number;
  /** What the patient is actually charged. */
  patientTotalCents: number;
};

export function coverageSplit(input: {
  grossCents: number;
  coverageBps: number;
  vatBps: number;
}): CoverageSplit {
  const gross = Math.max(0, Math.round(input.grossCents));
  /*
   * Clamped rather than trusted. The database refuses anything outside the
   * range and off the 5% step, and this function is called with numbers from a
   * row that predates the constraint as well as with ones that do not.
   */
  const bps = Math.min(10_000, Math.max(0, Math.round(input.coverageBps)));

  const sponsorCents = Math.round((gross * bps) / 10_000);
  const patientCents = gross - sponsorCents;
  const vatCents = vatOn(patientCents, input.vatBps);

  return {
    sponsorCents,
    patientCents,
    vatCents,
    patientTotalCents: patientCents + vatCents,
  };
}

/**
 * 🔴 C311 / C344 — THE PERCENTAGE THAT APPLIES RIGHT NOW, live or pending.
 *
 * A pending change applies itself by being in the past. That is why there is no
 * scheduled job here: a task that flips the live number on a timer is a task
 * whose failure leaves an employer paying a percentage they changed three weeks
 * ago, and nothing on any screen would say so.
 *
 * 🔴 An INCREASE is allowed to apply immediately and a DECREASE is not, which
 * is C344 and is the asymmetry the whole notice window exists for. Being asked
 * for less than you agreed to needs no protection; being asked for more does.
 * The caller decides the window when it writes the pending pair; this only
 * reads.
 */
export function coverageNow(
  pot: {
    coverageBps: number;
    pendingCoverageBps: number | null;
    pendingCoverageFrom: Date | null;
  },
  now: Date,
): number {
  if (
    pot.pendingCoverageBps !== null &&
    pot.pendingCoverageFrom !== null &&
    pot.pendingCoverageFrom.getTime() <= now.getTime()
  ) {
    return pot.pendingCoverageBps;
  }
  return pot.coverageBps;
}

export function vatOn(amountCents: number, vatBps: number): number {
  if (amountCents <= 0 || vatBps <= 0) return 0;
  return Math.round((amountCents * vatBps) / 10_000);
}

/**
 * The platform cut. Rounded **down** so the therapist is never short a cent.
 *
 * The two roundings deliberately go opposite ways: VAT rounds up toward the
 * authority, our fee rounds down toward the clinician. Both errors are at most
 * a cent and both land on us.
 */
export function platformFeeOn(grossCents: number, feeBps: number): number {
  if (grossCents <= 0 || feeBps <= 0) return 0;
  return Math.floor((grossCents * feeBps) / 10_000);
}

/**
 * Every line of a paid session, named.
 *
 * §3 is explicit that the patient and the therapist each see these as separate
 * lines with reasons, never one number, so the breakdown is computed once here
 * and rendered in several places rather than re-derived by each of them.
 */
export type SessionMoney = {
  /** The therapist's asking price. */
  grossCents: number;
  vatCents: number;
  /** What the patient is actually charged. */
  patientTotalCents: number;
  platformCutCents: number;
  /** What reaches the therapist, before their own session bill. */
  therapistNetCents: number;
};

export function sessionMoney(input: {
  grossCents: number;
  feeBps: number;
  vatBps: number;
}): SessionMoney {
  const gross = Math.max(0, Math.round(input.grossCents));
  const vat = vatOn(gross, input.vatBps);
  const cut = platformFeeOn(gross, input.feeBps);
  return {
    grossCents: gross,
    vatCents: vat,
    patientTotalCents: gross + vat,
    platformCutCents: cut,
    therapistNetCents: gross - cut,
  };
}

/**
 * Convert an amount at a quoted rate.
 *
 * Pure, and separate from `lib/billing/fx.ts` so the arithmetic can be tested
 * without a database. Rounds half-up to a whole minor unit: the patient's
 * currency has no fractional piastres either.
 */
export function convertAtRate(amountCents: number, rateMicro: number): number {
  if (amountCents <= 0 || rateMicro <= 0) return 0;
  return Math.round((amountCents * rateMicro) / 1_000_000);
}

/**
 * What the patient sees, in their own currency, from what the therapist charges.
 *
 * The order of operations is the part worth pinning down, and it follows §3:
 * VAT is computed on the settlement amount and *then* the total is converted —
 * not converted and then taxed. Both give nearly the same number and only one
 * of them is defensible to a tax authority, which cares about the amount in the
 * currency the invoice is denominated in.
 */
export function presentedTotal(input: {
  grossCents: number;
  vatBps: number;
  rateMicro: number;
}): { settlementTotalCents: number; presentedTotalCents: number; vatCents: number } {
  const vat = vatOn(input.grossCents, input.vatBps);
  const settlementTotal = Math.max(0, input.grossCents) + vat;
  return {
    settlementTotalCents: settlementTotal,
    presentedTotalCents: convertAtRate(settlementTotal, input.rateMicro),
    vatCents: vat,
  };
}
