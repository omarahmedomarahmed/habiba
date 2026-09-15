/**
 * The Egypt beta, and the thirty-three months after it. A cohort model.
 *
 * ## 🔴 WHY THIS IS A SECOND ENGINE AND NOT A SETTING ON THE FIRST
 *
 * `model.ts` carries one aggregate number of therapists and multiplies it by a
 * price. That is the right shape for "we charge everybody the same thing" and it
 * is the WRONG shape for the offer this business is actually launching with:
 *
 *   month 1 free · months 2 and 3 at half price · full price after that
 *
 * Under that offer, what somebody pays depends on **how long they have been a
 * customer**, not on what month it is. A therapist who joined in March and one
 * who joined in May are billed differently in the same June, and an aggregate
 * model cannot represent that at all: it would have to pick one of the two and
 * be wrong about the other.
 *
 * So this engine tracks COHORTS. Every account remembers the month it joined,
 * and its price and its churn are read off its own age. That is also the only
 * way to answer the question the whole beta exists to ask, which is **what
 * happens in month 4 when the discount ends.**
 *
 * ## 🔴 IT IS PURE, like `model.ts`, and for the same reason
 *
 * No `Date`, no database, no `fetch`, no randomness. A plan you cannot reproduce
 * is a plan you cannot defend to the person writing the cheque.
 *
 * ## Every number in `plans.ts` is one of three things
 *
 * **Measured** — the AI cost, from three runs against the live API.
 * **Decided** — the offer, the salaries, the hiring plan. These are choices, not
 * forecasts: they are true because somebody will make them true.
 * **Guessed** — every market number. Utilisation, churn, what an Egyptian
 * therapist will pay. These are the ones the beta exists to replace, and they
 * are labelled so nobody mistakes the arithmetic for evidence.
 */

/* ------------------------------------------------------------------ types -- */

/** What a kind of customer is and how they behave. All money in USD. */
export type Segment = {
  key: "company" | "clinic" | "therapist";
  label: string;
  /** Arrivals month by month. Index 0 is month 1. */
  arrivals: number[];
  /** Arrivals each month once the explicit list runs out. */
  steadyPerMonth: number;
  /** Full-price monthly subscription. Companies pay none: they fund a pot. */
  monthlyUsd: number;
  /** Clinicians this account puts on the platform. */
  cliniciansEach: number;
  /** Patients one of those clinicians sees in a month. */
  patientsPerClinician: number;
  /** Sessions one patient has in a month. */
  sessionsPerPatient: number;
  /**
   * 🔴 How many months an account takes to reach full volume.
   *
   * A clinic that signed last week is not seeing a hundred sessions this month.
   * It has to get its clinicians on, get them to trust the thing, and get their
   * patients to consent. Without this the model gives a month-three signature
   * a full month-three caseload, which flatters every revenue line in exactly
   * the months a beta is judged on. Volume scales 1/ramp, 2/ramp … to full.
   */
  rampMonths: number;
  /** Monthly churn while the promotional price still applies. */
  churnInPromo: number;
  /**
   * 🔴 The cliff. The share who leave in the FIRST month at full price, on top
   * of the steady rate. This is the number the whole beta is built to measure
   * and the one most likely to be wrong.
   */
  churnAtFullPrice: number;
  /** Monthly churn thereafter. */
  churnSteady: number;
  /** Credit we fund into their pot when they join. Companies only. */
  welcomeCreditUsd: number;
};

/** What a cohort pays, by how many months old it is. */
export type Promo = {
  /** Multiplier by lifecycle month. `[0, 0.5, 0.5]` is free, half, half. */
  schedule: number[];
  /** What they pay once the schedule runs out. 1 is full price. */
  after: number;
  /** Cohorts joining after this month get `afterBeta` instead of `schedule`. */
  lastMonth: number;
  /** The schedule for anybody joining after `lastMonth`. */
  afterBeta: { schedule: number[]; after: number };
};

/** One person on the payroll. */
export type Person = { role: string; startMonth: number; monthlyUsd: number };

/** One line of spend. `everyMonth` false makes it a one-off in `startMonth`. */
export type Spend = {
  label: string;
  monthlyUsd: number;
  startMonth: number;
  endMonth?: number;
  everyMonth: boolean;
};

export type Plan = {
  name: string;
  months: number;
  /** For reporting prices in the currency the customer actually pays in. */
  egpPerUsd: number;
  openingCashUsd: number;
  /** A round: how much and which month it lands. 0 for none. */
  raiseUsd: number;
  raiseMonth: number;
  unit: {
    /** What a patient pays a therapist for one session. */
    sessionPriceUsd: number;
    /** Our share of that, as a fraction. */
    takeRate: number;
    /** A flat fee on every session, on top of the share. */
    platformFeeUsd: number;
    /** What we charge for the AI on a session the patient consented to record. */
    aiFeeUsd: number;
    /** The share of sessions where they do consent. */
    consentRate: number;
    /** Minutes of audio in a real session. */
    sessionMinutes: number;
    /** 🔴 MEASURED. Once per session, whatever its length. */
    aiFixedUsd: number;
    /** 🔴 MEASURED. Per audio minute. */
    aiPerMinuteUsd: number;
    /** Video, per participant-minute. A session bills twice its length. */
    videoPerParticipantMinuteUsd: number;
    /** Card processing. */
    paymentPercent: number;
    paymentFixedUsd: number;
  };
  segments: Segment[];
  promo: Promo;
  people: Person[];
  spend: Spend[];
};

/** One month of the plan, with every line a reader might ask about. */
export type BetaMonth = {
  month: number;

  /* ------------------------------------------------------------- accounts -- */
  companies: number;
  clinics: number;
  therapistAccounts: number;
  /** Clinicians actually on the platform, across every kind of account. */
  clinicians: number;
  patients: number;
  sessions: number;
  /** New accounts this month, across every segment. */
  joined: number;
  /** Accounts lost this month. */
  left: number;

  /* -------------------------------------------------------------- revenue -- */
  subscriptionUsd: number;
  /** What we would have billed at full price. The offer's cost, made visible. */
  subscriptionAtFullPriceUsd: number;
  discountGivenUsd: number;
  sessionFeeUsd: number;
  aiFeeUsd: number;
  revenueUsd: number;

  /* ---------------------------------------------------------------- costs -- */
  aiCostUsd: number;
  videoCostUsd: number;
  paymentCostUsd: number;
  /** Welcome credit consumed this month, at our expense. */
  creditBurnUsd: number;
  grossProfitUsd: number;
  grossMarginPct: number;

  peopleUsd: number;
  marketingUsd: number;
  otherUsd: number;
  operatingCostUsd: number;

  /* --------------------------------------------------------------- result -- */
  netUsd: number;
  cashUsd: number;
  headcount: number;
};

export type PlanResult = {
  name: string;
  months: BetaMonth[];
  /** First month cash goes below zero, or null. */
  runsOutInMonth: number | null;
  /** First month net is positive, or null. */
  breakEvenMonth: number | null;
  /** How far below zero the cash ever goes, as money required. */
  deepestDeficitUsd: number;
  deepestDeficitMonth: number | null;
  totals: {
    revenueUsd: number;
    aiCostUsd: number;
    peopleUsd: number;
    marketingUsd: number;
    discountGivenUsd: number;
    creditBurnUsd: number;
    netUsd: number;
  };
  /** Sales and marketing spend divided by accounts won, over the whole plan. */
  blendedCacUsd: number;
};

/* --------------------------------------------------------------- the engine */

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One cohort of one segment: when it joined and how many are left. */
/**
 * One month's intake, tracked from the month it arrived.
 *
 * 🔴 `count` is the part still on a plan and `paygCount` is the part that
 * decided the plan was not worth it and dropped to the metered rate. They are
 * separate because they pay us in completely different ways and the whole
 * forecast turns on the split: a subscriber pays monthly and nothing per
 * session, and a metered account pays nothing monthly and $1 plus $3 a session.
 * Both keep giving us 15% of what their patients pay.
 */
type Cohort = {
  joinedMonth: number;
  count: number;
  paygCount: number;
  creditLeftUsd: number;
};

/**
 * What a cohort pays this month, as a multiple of the list price.
 *
 * 🔴 Read off the cohort's OWN age, never the calendar. This function is the
 * whole reason the engine exists.
 */
function priceMultiplier(promo: Promo, joinedMonth: number, month: number): number {
  const age = month - joinedMonth; /* 0 in the month they joined. */
  const beta = joinedMonth <= promo.lastMonth;
  const s = beta ? promo.schedule : promo.afterBeta.schedule;
  const after = beta ? promo.after : promo.afterBeta.after;
  return age < s.length ? s[age]! : after;
}

export function runPlan(plan: Plan): PlanResult {
  const rows: BetaMonth[] = [];
  const cohorts = new Map<string, Cohort[]>();
  for (const s of plan.segments) cohorts.set(s.key, []);

  const aiPerSession =
    plan.unit.aiFixedUsd + plan.unit.aiPerMinuteUsd * plan.unit.sessionMinutes;

  let cash = plan.openingCashUsd;
  let accountsWon = 0;

  for (let month = 1; month <= plan.months; month++) {
    let joined = 0;
    let left = 0;

    let subscriptionUsd = 0;
    let subscriptionAtFullPriceUsd = 0;
    let sessions = 0;
    let clinicians = 0;
    let patients = 0;
    let creditBurnUsd = 0;
    let companySessionValueUsd = 0;
    /* 🔴 Sessions run by accounts paying per session rather than per month. */
    let paygSessions = 0;
    let toPayg = 0;

    const counts: Record<string, number> = { company: 0, clinic: 0, therapist: 0 };

    for (const seg of plan.segments) {
      const list = cohorts.get(seg.key)!;

      /*
       * 🔴 CHURN BEFORE ARRIVALS, always.
       *
       * The other order churns people who joined this month, which quietly
       * throws away a whole month of intake and makes every growth number
       * flatter than the plan it is meant to describe.
       */
      for (const c of list) {
        const mult = priceMultiplier(plan.promo, c.joinedMonth, month);
        const prevMult = priceMultiplier(plan.promo, c.joinedMonth, month - 1);

        /*
         * 🔴 THE CLIFF, applied once: the month the price rises to full is the
         * month people decide whether they were customers or were taking a free
         * thing. Detected by the multiplier RISING rather than by counting
         * months, so changing the offer moves the cliff with it automatically.
         */
        const hitFullPrice = month > c.joinedMonth && mult > prevMult && mult >= 1;

        /*
         * 🔴 THE CLIFF DOES NOT DELETE ANYBODY. IT MOVES THEM TO PAY AS YOU GO.
         *
         * ⚠️ This is the correction that mattered most in the whole model. The
         * first version treated `churnAtFullPrice` as people leaving the
         * platform: their sessions, their patients and every dollar they
         * generated vanished from the forecast.
         *
         * That is not what happens. A therapist who decides $80 a month is not
         * worth it **does not stop seeing patients.** They drop to the metered
         * rate and keep paying us $1 a session, $3 more when the patient
         * consents, and 15% of everything the patient pays them. A busy
         * therapist on pay as you go is worth MORE to us than a quiet one on a
         * plan.
         *
         * So the cliff is a move between two ways of paying, and only
         * `churnSteady` is people actually going away. Modelling the cliff as
         * departure made the plan pessimistic by roughly the size of the number
         * the whole beta exists to measure.
         */
        if (hitFullPrice) {
          const moved = c.count * seg.churnAtFullPrice;
          c.count -= moved;
          c.paygCount += moved;
          toPayg += moved;
        }

        /*
         * Steady churn is leaving, and it applies to both ways of paying. A
         * metered therapist who stops working stops being worth anything.
         */
        const steady = mult < 1 ? seg.churnInPromo : seg.churnSteady;
        const lostSub = c.count * steady;
        const lostPayg = c.paygCount * steady;
        left += lostSub + lostPayg;
        c.count -= lostSub;
        c.paygCount -= lostPayg;
      }

      const arriving =
        month - 1 < seg.arrivals.length ? seg.arrivals[month - 1]! : seg.steadyPerMonth;
      if (arriving > 0) {
        list.push({
          joinedMonth: month,
          count: arriving,
          /* 🔴 Nobody arrives metered: the offer's first month is free. */
          paygCount: 0,
          creditLeftUsd: arriving * seg.welcomeCreditUsd,
        });
        joined += arriving;
        accountsWon += arriving;
      }

      for (const c of list) {
        const live = c.count + c.paygCount;
        if (live <= 0) continue;
        counts[seg.key] = (counts[seg.key] ?? 0) + live;

        const mult = priceMultiplier(plan.promo, c.joinedMonth, month);
        /* 🔴 Subscription revenue from the subscribed half only. */
        subscriptionUsd += c.count * seg.monthlyUsd * mult;
        subscriptionAtFullPriceUsd += c.count * seg.monthlyUsd;

        /* 🔴 The ramp, read off the cohort's own age like the price is. */
        const age = month - c.joinedMonth;
        const ramp =
          seg.rampMonths <= 1 ? 1 : Math.min(1, (age + 1) / seg.rampMonths);

        const segClinicians = live * seg.cliniciansEach;
        const segPatients = segClinicians * seg.patientsPerClinician * ramp;
        const segSessions = segPatients * seg.sessionsPerPatient;

        clinicians += segClinicians;
        patients += segPatients;
        sessions += segSessions;

        /*
         * 🔴 The per-session base and AI rates are charged to METERED accounts
         * only. A subscriber's sessions carry neither: that is what the
         * subscription bought.
         */
        paygSessions += segSessions * (live > 0 ? c.paygCount / live : 0);

        /*
         * 🔴 THE WELCOME CREDIT IS REAL MONEY LEAVING, not a discount.
         *
         * A discount is revenue we choose not to bill. A pot credit is cash we
         * put in somebody's account that a therapist then withdraws. Our fee
         * comes straight back to us, so the cost is the therapist's share, and
         * the credit is consumed at the rate their people actually book.
         */
        if (seg.key === "company" && c.creditLeftUsd > 0) {
          const value = segSessions * plan.unit.sessionPriceUsd;
          const drawn = Math.min(c.creditLeftUsd, value);
          c.creditLeftUsd -= drawn;
          creditBurnUsd += drawn * (1 - plan.unit.takeRate);
          companySessionValueUsd += value;
        }
      }

      /* Cohorts that have emptied stop being carried. */
      cohorts.set(
        seg.key,
        list.filter((c) => c.count + c.paygCount > 0.01),
      );
    }

    /* --------------------------------------------------------- the revenue -- */

    /*
     * 🔴 TWO THINGS WE CHARGE, ON TWO DIFFERENT POPULATIONS.
     *
     * ⚠️ The first version added `platformFeeUsd` to the take rate and charged
     * the sum on every session, which was wrong in both directions at once: it
     * billed subscribers a base rate they do not pay, and it billed metered
     * accounts the take rate on sessions nobody paid for.
     *
     *   1. **The cut.** 15% of what the patient paid, on every PAID session,
     *      whoever the therapist is and whatever plan they are on.
     *   2. **The base and AI rates.** $1 for the room and $3 for the note, on
     *      every session a METERED account runs, paid or free, online or in
     *      person. A subscriber pays neither: that is what the plan bought.
     */
    const takeUsd = sessions * plan.unit.sessionPriceUsd * plan.unit.takeRate;
    const baseFeeUsd = paygSessions * plan.unit.platformFeeUsd;

    /*
     * 🔴 C209 — the AI rate rides on consent, and the base rate does not. An
     * online session where the patient declined bills the $1 and nothing more,
     * because nothing was transcribed and no note was written.
     */
    const aiFeeUsd = paygSessions * plan.unit.consentRate * plan.unit.aiFeeUsd;

    const sessionFeeUsd = takeUsd + baseFeeUsd;
    const revenueUsd = subscriptionUsd + sessionFeeUsd + aiFeeUsd;

    /* ----------------------------------------------------------- the costs -- */

    /* 🔴 AI runs on every session, including the ones we gave away. */
    const aiCostUsd = sessions * plan.unit.consentRate * aiPerSession;
    const videoCostUsd =
      sessions * plan.unit.sessionMinutes * 2 * plan.unit.videoPerParticipantMinuteUsd;

    const cardVolume = sessions * plan.unit.sessionPriceUsd + subscriptionUsd;
    const paymentCostUsd =
      cardVolume * plan.unit.paymentPercent + sessions * plan.unit.paymentFixedUsd;

    const grossProfitUsd =
      revenueUsd - aiCostUsd - videoCostUsd - paymentCostUsd - creditBurnUsd;

    const activePeople = plan.people.filter((p) => p.startMonth <= month);
    const peopleUsd = activePeople.reduce((s, p) => s + p.monthlyUsd, 0);

    const live = plan.spend.filter(
      (s) =>
        (s.everyMonth
          ? s.startMonth <= month && (s.endMonth === undefined || month <= s.endMonth)
          : s.startMonth === month),
    );
    const marketingUsd = live
      .filter((s) => /video|ad|influenc|sponsor|market|referr/i.test(s.label))
      .reduce((sum, s) => sum + s.monthlyUsd, 0);
    const otherUsd = live
      .filter((s) => !/video|ad|influenc|sponsor|market|referr/i.test(s.label))
      .reduce((sum, s) => sum + s.monthlyUsd, 0);

    const operatingCostUsd = peopleUsd + marketingUsd + otherUsd;
    const netUsd = grossProfitUsd - operatingCostUsd;

    if (month === plan.raiseMonth) cash += plan.raiseUsd;
    cash += netUsd;

    rows.push({
      month,
      companies: r2(counts.company ?? 0),
      clinics: r2(counts.clinic ?? 0),
      therapistAccounts: r2(counts.therapist ?? 0),
      clinicians: r2(clinicians),
      patients: r2(patients),
      sessions: r2(sessions),
      joined: r2(joined),
      left: r2(left),
      subscriptionUsd: r2(subscriptionUsd),
      subscriptionAtFullPriceUsd: r2(subscriptionAtFullPriceUsd),
      discountGivenUsd: r2(subscriptionAtFullPriceUsd - subscriptionUsd),
      sessionFeeUsd: r2(sessionFeeUsd),
      aiFeeUsd: r2(aiFeeUsd),
      revenueUsd: r2(revenueUsd),
      aiCostUsd: r2(aiCostUsd),
      videoCostUsd: r2(videoCostUsd),
      paymentCostUsd: r2(paymentCostUsd),
      creditBurnUsd: r2(creditBurnUsd),
      grossProfitUsd: r2(grossProfitUsd),
      grossMarginPct: revenueUsd > 0 ? r2((grossProfitUsd / revenueUsd) * 100) : 0,
      peopleUsd: r2(peopleUsd),
      marketingUsd: r2(marketingUsd),
      otherUsd: r2(otherUsd),
      operatingCostUsd: r2(operatingCostUsd),
      netUsd: r2(netUsd),
      cashUsd: r2(cash),
      headcount: activePeople.length,
    });
  }

  const runsOut = rows.find((r) => r.cashUsd < 0)?.month ?? null;
  const breakEven = rows.find((r) => r.netUsd > 0)?.month ?? null;

  const lowest = rows.reduce(
    (worst, r) => (r.cashUsd < worst.cashUsd ? r : worst),
    rows[0] ?? { cashUsd: 0, month: 0 },
  );

  const sum = (f: (r: BetaMonth) => number) => r2(rows.reduce((s, r) => s + f(r), 0));

  /*
   * 🔴 CAC counts the people who SELL and the money that MARKETS, and nothing
   * else. Founders' pay is not acquisition cost even when founders sell, or the
   * number moves when somebody gives themselves a raise.
   */
  const salesUsd = rows.reduce(
    (s, r) =>
      s +
      plan.people
        .filter((p) => p.startMonth <= r.month && /sales|bd|account/i.test(p.role))
        .reduce((x, p) => x + p.monthlyUsd, 0),
    0,
  );

  return {
    name: plan.name,
    months: rows,
    runsOutInMonth: runsOut,
    breakEvenMonth: breakEven,
    deepestDeficitUsd: lowest.cashUsd < 0 ? r2(-lowest.cashUsd) : 0,
    deepestDeficitMonth: lowest.cashUsd < 0 ? lowest.month : null,
    totals: {
      revenueUsd: sum((r) => r.revenueUsd),
      aiCostUsd: sum((r) => r.aiCostUsd),
      peopleUsd: sum((r) => r.peopleUsd),
      marketingUsd: sum((r) => r.marketingUsd),
      discountGivenUsd: sum((r) => r.discountGivenUsd),
      creditBurnUsd: sum((r) => r.creditBurnUsd),
      netUsd: sum((r) => r.netUsd),
    },
    blendedCacUsd:
      accountsWon > 0 ? r2((salesUsd + sum((r) => r.marketingUsd)) / accountsWon) : 0,
  };
}
