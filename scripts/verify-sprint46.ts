/**
 * Sprint 46 acceptance: the split fee, plans and credits.
 *
 *   npm run verify:sprint46
 *
 * ## What this sprint is actually protecting
 *
 * `chargeForSession` billed the same amount whether or not any AI ran, which
 * is two bad things at once. A therapist who wanted the fee to go away had a
 * reason to lean on a patient about consent, and a therapist who never asked
 * got unlimited hosted HIPAA-grade video for nothing.
 *
 * The fix is a platform fee on **every** session and an AI fee only where the
 * patient consented. 🔴 The protection is the FIRST of those. Making the AI fee
 * conditional is only safe because the fee above it cannot be avoided, and
 * every check below about the declined session is really a check about that.
 *
 * ## 🔴 Why the declined-session check asserts a PRESENCE
 *
 * The obvious check is "a declined session raises no AI fee". It passes
 * against code that charges nothing at all, against a billing path that threw
 * and was swallowed, and against a session that was never invoiced. It is the
 * §6 family wearing a billing costume, and the accept criterion for this
 * sprint calls it out by name.
 *
 * So every absence here is bracketed: the AI line is gone AND the platform
 * line is there, with the right amount, on the same invoice.
 */
import { and, eq } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  const { invoiceLines, invoices, sessions, sessionCredits, subscriptions, users } = schema;
  const { chargeForSession, reconcileMissingCharges } = await import("../lib/billing/service");
  const { sessionLines, tierByKey } = await import("../lib/billing/plans");
  const { currentTier } = await import("../lib/billing/credits");
  const { getSettings } = await import("../lib/settings");

  const settings = await getSettings();
  const platformFeeCents = settings.session.platformFeeCents;

  /*
   * An organisation that already has a session, rather than the first user in
   * the table. The two are not the same in a shared verification database, and
   * the probe below needs a real session to bill against.
   */
  const seed = required(
    (
      await db
        .select({ organizationId: sessions.organizationId, therapistId: sessions.therapistId })
        .from(sessions)
        .limit(1)
    )[0],
    "session to bill against",
  );
  const actor = {
    id: seed.therapistId ?? required(
      (await db.select({ id: users.id }).from(users).limit(1))[0],
      "user to own a test session",
    ).id,
    organizationId: seed.organizationId,
  };

  /* ------------------------------------------------- the pure rule, first -- */

  /*
   * Asserted on the pure function before anything touches the database,
   * because if this is wrong every check below is measuring the wrong thing
   * correctly.
   */
  const declinedPure = sessionLines({ settings, tierKey: "payg", aiConsented: false });
  const consentedPure = sessionLines({ settings, tierKey: "payg", aiConsented: true });

  check(
    "🔴 46.1 / C209 a declined session still costs the platform fee, and it is not zero",
    declinedPure.totalCents === platformFeeCents && platformFeeCents > 0,
    `${declinedPure.totalCents}c on a refusal`,
  );

  check(
    "🔴 CONTROL and a consented one costs that plus the tier's AI rate",
    consentedPure.totalCents ===
      platformFeeCents + tierByKey(settings.pricing.tiers, "payg").aiRateCents,
    `${consentedPure.totalCents}c with AI`,
  );

  /* ------------------------------- 46.13 · the index C251 said must survive -- */

  /*
   * 🔴 Asserted by ATTEMPTING THE WRITE, never by reading a migration file.
   *
   * `invoices_session_unique` is what makes the reconciler racing a live
   * completion a no-op rather than a double charge, and 46.1's first draft
   * would have traded it for the two-line shape. A check that reads the SQL
   * would pass against a database where somebody had dropped it by hand.
   */
  const org = actor.organizationId;

  const raceSession = required(
    (
      await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.organizationId, org))
        .limit(1)
    )[0],
    "session to bill against",
  );

  let doubleInvoiceRefused = false;
  const [first] = await db
    .insert(invoices)
    .values({
      organizationId: org,
      kind: "session",
      sessionId: raceSession.id,
      amountCents: platformFeeCents,
      status: "due",
      description: "verify:sprint46 probe",
    })
    .onConflictDoNothing({ target: invoices.sessionId })
    .returning({ id: invoices.id });

  const invoiceId =
    first?.id ??
    required(
      (
        await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.sessionId, raceSession.id))
          .limit(1)
      )[0],
      "invoice for the probe session",
    ).id;

  try {
    await db.insert(invoices).values({
      organizationId: org,
      kind: "session",
      sessionId: raceSession.id,
      amountCents: 999,
      status: "due",
      description: "verify:sprint46 second invoice, must be refused",
    });
  } catch {
    doubleInvoiceRefused = true;
  }

  check(
    "🔴 46.13 / C251 the DATABASE still refuses a second invoice for one session",
    doubleInvoiceRefused,
    "invoices_session_unique survived the two-line shape, which is the whole of C251",
  );

  /*
   * 🔴 And the same argument one level down.
   *
   * 46.14's reconciler adds a MISSING LINE to an invoice it did not create, so
   * it races a live completion in exactly the way the parent used to. Without
   * this index a session whose AI fee was slow gets two AI fees.
   */
  await db
    .insert(invoiceLines)
    .values({ invoiceId, kind: "platform", amountCents: platformFeeCents })
    .onConflictDoNothing();

  let doubleLineRefused = false;
  try {
    await db
      .insert(invoiceLines)
      .values({ invoiceId, kind: "platform", amountCents: 999 });
  } catch {
    doubleLineRefused = true;
  }

  check(
    "🔴 46.13 …and refuses a second line of the same kind on one invoice",
    doubleLineRefused,
    "invoice_lines_invoice_kind_unique, so a slow AI fee cannot post twice",
  );

  // Clean the probe up before the real billing checks touch this session.
  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  /* ----------------------------------- 46.1 · a real charge, both directions -- */

  /*
   * Two sessions, billed for real through `chargeForSession`, because the
   * thing being checked is the CHARGE PATH and not the arithmetic above it.
   * The trial and any credit are cleared first: both are legitimate outcomes
   * that produce a zero invoice, and either would make this check pass while
   * proving nothing about the split.
   */
  await db
    .update(subscriptions)
    .set({ trialSessionUsed: true })
    .where(eq(subscriptions.organizationId, org));
  await db
    .update(sessionCredits)
    .set({ status: "void" })
    .where(and(eq(sessionCredits.organizationId, org), eq(sessionCredits.status, "active")));

  const billed: { consent: "granted" | "declined"; sessionId: string }[] = [];

  for (const consent of ["declined", "granted"] as const) {
    const [made] = await db
      .insert(sessions)
      .values({
        organizationId: org,
        therapistId: actor.id,
        status: "completed",
        recordingConsent: consent,
        endedAt: new Date(),
        // NOT NULL and uniquely indexed. Prefixed so a stray fixture is
        // recognisable in a shared verification database.
        feedbackToken: `v46-${consent}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      .returning({ id: sessions.id });
    if (made) billed.push({ consent, sessionId: made.id });
  }

  try {
    for (const entry of billed) {
      await chargeForSession({ organizationId: org, sessionId: entry.sessionId });
    }

    const tier = await currentTier(org);

    for (const entry of billed) {
      const [invoice] = await db
        .select({ id: invoices.id, amountCents: invoices.amountCents })
        .from(invoices)
        .where(eq(invoices.sessionId, entry.sessionId))
        .limit(1);

      const lines = invoice
        ? await db
            .select({ kind: invoiceLines.kind, amountCents: invoiceLines.amountCents })
            .from(invoiceLines)
            .where(eq(invoiceLines.invoiceId, invoice.id))
        : [];

      const platform = lines.find((line) => line.kind === "platform");
      const ai = lines.find((line) => line.kind === "ai");

      if (entry.consent === "declined") {
        /*
         * 🔴 THE check this sprint's accept criterion names.
         *
         * The platform line being PRESENT, at the right amount, is the half
         * that means something. "No AI fee" on its own passes against code
         * that charges nothing at all.
         */
        check(
          "🔴 46.1 a DECLINED session raises exactly one line, and it is the platform fee",
          lines.length === 1 &&
            platform !== undefined &&
            platform.amountCents === platformFeeCents &&
            ai === undefined,
          `lines: ${lines.map((l) => `${l.kind}=${l.amountCents}`).join(", ") || "none"}`,
        );
      } else {
        check(
          "🔴 46.1 a CONSENTED session raises two lines, platform and AI",
          lines.length === 2 &&
            platform?.amountCents === platformFeeCents &&
            ai?.amountCents === tier.aiRateCents,
          `lines: ${lines.map((l) => `${l.kind}=${l.amountCents}`).join(", ") || "none"}`,
        );

        check(
          "46.1 …and the invoice total is the sum of its lines",
          invoice?.amountCents === platformFeeCents + tier.aiRateCents,
          `invoice ${invoice?.amountCents}c, lines ${platformFeeCents + tier.aiRateCents}c`,
        );
      }
    }

    /* --------------------------- 46.14 · the reconciler, per line kind -- */

    /*
     * 🔴 The failure C251 names, reproduced and then repaired.
     *
     * Delete the AI line from the consented session. The invoice still exists,
     * so the OLD reconciler — which asked "has this session an invoice" —
     * would answer yes and never look again. Silently, forever, under-billing.
     */
    const consented = billed.find((entry) => entry.consent === "granted");
    if (consented) {
      const [invoice] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.sessionId, consented.sessionId))
        .limit(1);

      if (invoice) {
        await db
          .delete(invoiceLines)
          .where(and(eq(invoiceLines.invoiceId, invoice.id), eq(invoiceLines.kind, "ai")));

        const before = await db
          .select({ kind: invoiceLines.kind })
          .from(invoiceLines)
          .where(eq(invoiceLines.invoiceId, invoice.id));

        await reconcileMissingCharges();

        const after = await db
          .select({ kind: invoiceLines.kind })
          .from(invoiceLines)
          .where(eq(invoiceLines.invoiceId, invoice.id));

        check(
          "🔴 46.14 / C251 the reconciler notices a MISSING LINE on an invoice that exists",
          before.length === 1 && after.some((line) => line.kind === "ai"),
          `${before.length} line before, ${after.length} after`,
        );
      }
    }
  } finally {
    for (const entry of billed) {
      await db.delete(invoices).where(eq(invoices.sessionId, entry.sessionId));
      await db.delete(sessions).where(eq(sessions.id, entry.sessionId));
    }
    await db
      .update(sessionCredits)
      .set({ status: "active" })
      .where(and(eq(sessionCredits.organizationId, org), eq(sessionCredits.status, "void")));
  }

  /* ------------------------------------ 46.15 / C243 · the corporate leak -- */

  /*
   * 🔴 The find that moved into this sprint, and the reason it is here rather
   * than in 53.
   *
   * `sessionPayments.payerName` was rendered on the therapist's own ledger. A
   * pot payment has no cardholder, so that column would either carry the
   * employer's name or be null, and null means the therapist's ledger shows a
   * real name on every private patient and "Patient" on every corporate one:
   * a sorted, complete, self-updating list of who a sponsor pays for.
   *
   * 🔴 And the verifier C242 asks for would have PASSED against it, because
   * the leak is a null. So this asserts on what the surfaces select, which is
   * the only place the difference is visible.
   */
  /*
   * 🔴 The WRITE path keeps `payerName`, and must.
   *
   * We still record who actually paid: a receipt, a refund and a
   * reconciliation all need it, and a payment row that cannot say who settled
   * it is unauditable. What changed is that nothing a therapist looks at reads
   * it back. So this scans the READ — the body of `recentPayments`, which is
   * the one query every therapist-facing money screen is built on — rather
   * than the file, which was the first version of this check and failed on its
   * own legitimate write path.
   */
  const connectSource = readSource("lib/billing/connect.ts");
  const recentPaymentsBody = connectSource.slice(
    connectSource.indexOf("export async function recentPayments"),
  );
  const recentPaymentsQuery = recentPaymentsBody.slice(0, recentPaymentsBody.indexOf("\n}"));

  const displaySurfaces = [
    "app/(app)/billing/page.tsx",
    "app/(app)/earnings/page.tsx",
    "components/billing/ledger.tsx",
    "components/billing/payment-history.tsx",
    "components/admin/therapist-panel.tsx",
  ];

  const leaking = displaySurfaces.filter((file) => /payerName|payerEmail/.test(readSource(file)));
  const queryLeaks = /payerName|payerEmail/.test(recentPaymentsQuery);

  check(
    "🔴 46.15 / C243 no therapist-facing surface reads the PAYER, only the patient",
    displaySurfaces.length > 0 && leaking.length === 0 && !queryLeaks,
    leaking.length === 0 && !queryLeaks
      ? `${displaySurfaces.length} display surfaces and the query they all use, none reading the payer`
      : [queryLeaks ? "recentPayments" : "", ...leaking].filter(Boolean).join(", "),
  );

  /*
   * 🔴 CONTROL — and it reads the patient's name instead.
   *
   * Without this, the check above passes against a query that stopped
   * selecting a name at all, which would show every therapist "Patient" on
   * every row: the corporate leak's own failure mode, applied to everybody.
   */
  check(
    "🔴 CONTROL the same query names the patient, from the chart",
    /patientName/.test(recentPaymentsQuery) && /patients\./.test(recentPaymentsQuery),
    "joined through the session to the chart, identical whoever paid",
  );

  check(
    "🔴 46.15 …and the card brand and last four are gone from the earnings page too",
    !/paymentBrand|paymentLast4/.test(readSource("components/billing/payment-history.tsx")),
    "how a patient paid is between them and their bank, and after 53 it is not always a patient",
  );

  /* ------------------------------------------ 46.16 · no price on consent -- */

  /*
   * 🔴 The protection is the unavoidable fee, not a hidden one.
   *
   * A consent screen that quotes money turns a clinical question into a
   * commercial one in front of the person least able to push back. This scans
   * the surfaces where consent is asked rather than the dictionary, because a
   * price could arrive as an interpolated figure with no currency key at all.
   */
  const consentSurfaces = [
    "components/session/session-room.tsx",
    "components/pay/pay-flow.tsx",
  ].filter((file) => {
    try {
      readSource(file);
      return true;
    } catch {
      return false;
    }
  });

  const priced = consentSurfaces.filter((file) => {
    const source = readSource(file);
    // The consent block only, not the payment block on the same page.
    const consentBlocks = source.match(/consent[\s\S]{0,600}/gi) ?? [];
    return consentBlocks.some((block) => /\$\{?\d|formatUsd|formatMoney/.test(block));
  });

  check(
    "🔴 46.16 / C209 no consent surface quotes a price",
    consentSurfaces.length > 0 && priced.length === 0,
    priced.length === 0
      ? `${consentSurfaces.length} consent surfaces, none of them commercial`
      : priced.join(", "),
  );

  /* --------------------------------- 46.17 · crisis is not a billing state -- */

  /*
   * 🔴 Written here rather than in 53, because this sprint rewrites the charge
   * path months before a pot exists, and the rule is easier to keep than to
   * restore. Nothing in the crisis path may consult money.
   */
  const crisisModules = ["lib/crisis/line.ts", "lib/crisis/level.ts", "lib/crisis/alerts.ts"];
  const moneyInCrisis = crisisModules.filter((file) => {
    const source = readSource(file);
    return /invoice|credit|subscription|billing\/|platformFee|chargeFor/i.test(source);
  });

  check(
    "🔴 46.17 / C253 the crisis path does not read a single billing fact",
    moneyInCrisis.length === 0,
    moneyInCrisis.length === 0
      ? `${crisisModules.length} crisis modules, none of them aware money exists`
      : moneyInCrisis.join(", "),
  );

  /* ----------------------------------------- C223 · the rate outlives credit -- */

  check(
    "🔴 46.4 / C223 a tier is a spend threshold and an AI rate, never a session count",
    settings.pricing.tiers.every(
      (tier) => "unlockCents" in tier && "aiRateCents" in tier && !("minimumSessions" in tier),
    ),
    settings.pricing.tiers.map((t) => `${t.key}: $${t.unlockCents / 100}→$${t.aiRateCents / 100}`).join(", "),
  );

  /*
   * 🔴 The rate is derived from LIFETIME spend, so it survives the credit
   * running out. A therapist who has ever put $60 through this holds the $1
   * rate with an empty balance, forever. Asserted on the source of the
   * derivation because seeding a lifetime and then expiring it would leave
   * real rows behind in a shared database.
   */
  const creditsSource = readSource("lib/billing/credits.ts");
  check(
    "🔴 46.4 the tier comes from lifetime spend, not from the current balance",
    /lifetimeCents/.test(creditsSource) && /tierForSpend\(settings\.pricing\.tiers, lifetimeCents\)/.test(creditsSource),
    "expired credit still counts toward the threshold; a refunded purchase does not",
  );

  finish("sprint 46");
}

void main();
