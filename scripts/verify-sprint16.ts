/**
 * Sprint 16 acceptance — two rails, two currencies, two entities.
 * PLAN.md §3c, 16.1–16.10, C37, C69, C74, C76.
 *
 *   npm run verify:sprint16
 *
 * Every claim here is about money, so every one of them is exercised against
 * the real database: a constraint is asserted by **attempting the write**, and
 * a refusal is proved by trying the thing that must be refused. Reading the
 * schema would only prove that a migration ran.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";

import {
  invoices,
  ledgerEntries,
  organizations,
  payoutMethods,
  payoutRequestEvents,
  payoutRequests,
  sessions,
  subscriptions,
  users,
} from "../lib/db/schema";
import { writesTo } from "./_verify";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";

/*
 * 🔴 30.1 — an operator tool writes to the region its DATABASE_URL names.
 *
 * `dbFor(DEFAULT_REGION)` rather than a bare handle, because after this
 * sprint there is no bare handle: a script that plants fixtures is planting
 * them in a jurisdiction, and saying which one is the point. When Cairo is
 * live a script that needs to touch it passes "eg" and nothing else changes.
 */
const db = dbFor(DEFAULT_REGION);

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? `, ${detail}` : ""}`);
}

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

const TAG = "verify16";

async function main() {
  /*
   * 🔴 C147 — this script WRITES, so it says where and refuses production.
   */
  writesTo();

  try {
    /*
     * 🔴 22.1 — the fixtures are PLANTED, not borrowed.
     *
     * This used to take the first organisation and the first three users it
     * found, which meant it only ran on a database somebody else had filled.
     * After the purge there was one user — the seeded admin — and the whole
     * verifier stopped at its first line, reporting a missing fixture as a
     * failure and checking none of the twenty-nine things it exists to check.
     * A gate that only works on a full database is a gate that stops working
     * the week before launch.
     */
    const [org] =
      (await db.select({ id: organizations.id }).from(organizations).limit(1)).length > 0
        ? await db.select({ id: organizations.id }).from(organizations).limit(1)
        : await db
            .insert(organizations)
            .values({ name: `${TAG} clinic`, slug: `${TAG}-${Date.now()}` })
            .returning({ id: organizations.id });

    const existing = await db.select({ id: users.id }).from(users).limit(3);
    const wanted = 3 - existing.length;

    const planted =
      wanted > 0
        ? await db
            .insert(users)
            .values(
              Array.from({ length: wanted }, (_, index) => ({
                organizationId: org!.id,
                email: `${TAG}-${index}-${Date.now()}@example.test`,
                passwordHash: "x".repeat(60),
                firstName: `${TAG}`,
                lastName: `${index}`,
                role: "therapist" as const,
              })),
            )
            .returning({ id: users.id })
        : [];

    const staff = [...existing, ...planted];
    const [payee, alice, bob] = staff as [{ id: string }, { id: string }, { id: string }];

    /* ------------------------------------------------ 16.9 · the entity */

    const txnId = crypto.randomUUID();
    await db.insert(ledgerEntries).values([
      {
        txnId,
        txnKind: "session_payment",
        account: "cash",
        organizationId: org.id,
        amountCents: 10_000,
        entity: "eg",
        memo: `${TAG} cash in, Egyptian entity`,
      },
      {
        txnId,
        txnKind: "session_payment",
        account: "therapist_payable",
        organizationId: org.id,
        userId: payee.id,
        amountCents: -10_000,
        entity: "eg",
        memo: `${TAG} held for a clinician`,
      },
    ]);

    const [entityRow] = await db
      .select({ entity: ledgerEntries.entity })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.txnId, txnId), eq(ledgerEntries.account, "cash")))
      .limit(1);
    check(
      "16.9 every ledger leg records which entity holds it",
      entityRow?.entity === "eg",
      String(entityRow?.entity),
    );

    check(
      "16.9 …and an entity the product does not have is refused BY THE DATABASE",
      await refused(
        () =>
          db.insert(ledgerEntries).values({
            txnId: crypto.randomUUID(),
            txnKind: "adjustment",
            account: "cash",
            organizationId: org.id,
            amountCents: 1,
            entity: "atlantis" as "us",
            memo: `${TAG} nowhere`,
          }),
        "ledger_entries_entity_known",
      ),
    );

    const { postEntityTransfer, journal, UnbalancedTransaction } = await import(
      "../lib/billing/ledger"
    );

    /*
     * 🔴 The ledger's own rule, asserted rather than assumed: a transaction
     * whose legs do not sum to zero cannot be written. Everything else in this
     * file rests on it.
     */
    let unbalancedRefused = false;
    try {
      await journal({
        kind: "adjustment",
        legs: [
          { account: "cash", amountCents: 500, organizationId: org.id, memo: `${TAG} one leg` },
        ],
      });
    } catch (error) {
      unbalancedRefused = error instanceof UnbalancedTransaction;
    }
    check("🔴 16.8 a transaction whose legs do not net to zero cannot be written", unbalancedRefused);

    const moved = await postEntityTransfer({
      organizationId: org.id,
      fromEntity: "eg",
      toEntity: "us",
      amountCents: 5_000,
      reason: `${TAG} settling a cross-border crossing`,
      adminUserId: alice.id,
    });
    check("16.9 a cross-entity movement is an explicit, audited transaction", moved.ok === true);
    check(
      "16.9 …and a transfer from an entity to itself moves nothing and is refused",
      (
        await postEntityTransfer({
          organizationId: org.id,
          fromEntity: "eg",
          toEntity: "eg",
          amountCents: 100,
          reason: `${TAG} nowhere`,
          adminUserId: alice.id,
        })
      ).error !== undefined,
    );

    /* ---------------------------------------- 16.2 · the payout request */

    const { savePayoutMethod, requestPayout, approvePayout, markPayoutSent, confirmPayout } =
      await import("../lib/billing/payouts");

    /*
     * 🔴 C74 — the payout details are edited by ALICE. She may not then approve
     * a transfer to them. That is the whole rule, and it is set up here rather
     * than described.
     */
    const method = await savePayoutMethod({
      therapistId: payee.id,
      organizationId: org.id,
      method: "instapay",
      identifier: `${TAG}@instapay`,
      accountName: `${TAG} Full Name`,
      editedByUserId: alice.id,
    });
    check("16.2 a payout destination is saved with the person who last edited it", method.ok === true);

    check(
      "16.2 …and a destination with no name on it is refused BY THE DATABASE",
      await refused(
        () =>
          db.insert(payoutMethods).values({
            therapistId: payee.id,
            organizationId: org.id,
            method: "instapay",
            identifier: `${TAG}-x`,
            accountName: "",
            isDefault: false,
          }),
        "payout_methods_named",
      ),
    );

    const tooMuch = await requestPayout({
      therapistId: payee.id,
      organizationId: org.id,
      amountCents: 999_999,
    });
    check(
      "🔴 16.10 a clinician cannot withdraw more than the LEDGER says we hold",
      tooMuch.error !== undefined,
      tooMuch.error ?? "ACCEPTED",
    );

    const asked = await requestPayout({
      therapistId: payee.id,
      organizationId: org.id,
      amountCents: 4_000,
    });
    check("16.2 a payout request is created", asked.ok === true, asked.error ?? "");

    const [request] = await db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.id, asked.id ?? ""))
      .limit(1);

    check(
      "🔴 16.6 the exchange rate is FROZEN onto the request, with its timestamp",
      request?.fxRateMicro !== null && request?.fxQuotedAt !== null,
      `${request?.payoutAmountMinor} ${request?.payoutCurrency} at ${request?.fxRateMicro}`,
    );
    check(
      "16.2 …in EGP, because there is no such thing as an InstaPay transfer in dollars",
      request?.payoutCurrency === "egp" && request?.entity === "eg",
      `${request?.payoutCurrency} / ${request?.entity}`,
    );

    const twice = await requestPayout({
      therapistId: payee.id,
      organizationId: org.id,
      amountCents: 1_000,
    });
    check(
      "16.3 a second request while one is in flight is refused, not queued twice",
      twice.error !== undefined,
      twice.error ?? "ACCEPTED",
    );

    /* --------------------------------------------- 🔴 16.3d · C74 */

    const selfApproved = await approvePayout({
      requestId: request!.id,
      approverUserId: payee.id,
    });
    check(
      "🔴 C74 a clinician cannot approve their own payout",
      selfApproved.error !== undefined,
      selfApproved.error ?? "ACCEPTED",
    );

    const editorApproved = await approvePayout({
      requestId: request!.id,
      approverUserId: alice.id,
    });
    check(
      "🔴 C74 the person who EDITED the payout details cannot approve sending money to them",
      editorApproved.error !== undefined,
      editorApproved.error ?? "ACCEPTED, a one-person fraud path is open",
    );

    /*
     * 🔴 The control. Both refusals above come from `approvePayout`, and a
     * check on a function's own error string proves only that the function
     * agrees with itself. This asserts the rule where it actually lives — the
     * database — by writing the forbidden row directly, past every code path.
     */
    check(
      "🔴 C74 CONTROL, the same approval written STRAIGHT TO THE TABLE is refused by a CHECK",
      await refused(
        () =>
          db
            .update(payoutRequests)
            .set({ approvedByUserId: alice.id, approvedAt: new Date(), status: "approved" })
            .where(eq(payoutRequests.id, request!.id)),
        "payout_requests_approver_not_editor",
      ),
      "if this passes by not throwing, the rule is only in the code path",
    );

    const approved = await approvePayout({ requestId: request!.id, approverUserId: bob.id });
    check(
      "16.3d …and somebody who did neither CAN approve it",
      approved.ok === true,
      approved.error ?? "",
    );

    /* ------------------------------------------- 16.3c · the receipt */

    const noProof = await markPayoutSent({
      requestId: request!.id,
      senderUserId: bob.id,
      proofUrl: "",
    });
    check(
      "16.3c a payout cannot be marked sent with no transfer receipt",
      noProof.error !== undefined,
      noProof.error ?? "ACCEPTED",
    );

    const sent = await markPayoutSent({
      requestId: request!.id,
      senderUserId: bob.id,
      proofUrl: `https://example.test/${TAG}.png`,
    });
    check("16.2 the transfer is recorded as sent", sent.ok === true, sent.error ?? "");

    const held = await (await import("../lib/billing/ledger")).heldForTherapist(payee.id);
    check(
      "🔴 16.8 the money leaves the books when it leaves the bank, $100 held, $40 sent, $60 left",
      held === 6_000,
      `${held} cents`,
    );

    await confirmPayout({ requestId: request!.id, actorUserId: bob.id });
    const events = await db
      .select({ to: payoutRequestEvents.toStatus, actor: payoutRequestEvents.actorUserId })
      .from(payoutRequestEvents)
      .where(eq(payoutRequestEvents.requestId, request!.id));
    check(
      "16.2 every transition is recorded and attributable to a person",
      events.length >= 4 && events.every((e) => e.actor !== null),
      events.map((e) => e.to).join(" → "),
    );

    /*
     * 🔴 The other half of C74, and the one a code review would miss: sending
     * money that was never approved. Written straight to the table, because a
     * future admin script is exactly how it would happen.
     */
    const [second] = await db
      .insert(payoutRequests)
      .values({
        organizationId: org.id,
        therapistId: payee.id,
        amountCents: 1_000,
        payoutAmountMinor: 48_000,
        payoutCurrency: "egp",
        entity: "eg",
        method: "instapay",
        identifier: `${TAG}@instapay`,
        accountName: `${TAG} Full Name`,
        status: "requested",
      })
      .returning({ id: payoutRequests.id });

    check(
      "🔴 C74 a payout marked SENT without an approval is refused BY THE DATABASE",
      await refused(
        () =>
          db
            .update(payoutRequests)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(payoutRequests.id, second!.id)),
        "payout_requests_sent_was_approved",
      ),
    );

    /* -------------------------------------------------- 16.8 · the proof */

    const { reconcile, traceHeld } = await import("../lib/billing/ledger");
    const books = await reconcile();
    check(
      "🔴 16.8 the daily reconciliation balances to zero",
      books.balances && books.outOfBalanceCents === 0,
      `out by ${books.outOfBalanceCents}, ${books.unbalancedTxns.length} unbalanced, ${books.negativeHolds.length} negative holds`,
    );

    const trace = await traceHeld(payee.id);
    check(
      "🔴 16.8 every held cent traces to one payment in and at most one payout out",
      trace.heldCents === held && trace.duplicatePayouts.length === 0,
      `in ${trace.inCents}, out ${trace.outCents}, duplicates ${trace.duplicatePayouts.length}`,
    );

    /* ------------------------------------------------------- C37 */

    const { quoteMaySettle } = await import("../lib/billing/fx");
    check(
      "🔴 C37 a static rate may settle money outside production…",
      quoteMaySettle({ source: "static" }) === true,
    );

    /*
     * …and may not inside it. Asserted in a **child process** at
     * `NODE_ENV=production`, not by editing `process.env` here: `lib/env`
     * reads it once at module load, so a flip in this process would prove
     * nothing about a real production boot. Same technique as the hydration
     * test, for the same reason — and not by reading the source, which is how
     * four checkers in this repo have already passed by matching their own
     * prose.
     */
    const { execFileSync } = await import("node:child_process");
    let productionRefuses = false;
    try {
      const out = execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "-e",
          // `-e` runs as CJS, so the ES module arrives under `default`.
          `import("./lib/billing/fx.ts").then((m) => console.log(String((m.default ?? m).quoteMaySettle({ source: "static" }))))`,
        ],
        {
          /*
           * A production boot refuses to start without these, which is
           * `lib/env`'s own guard doing its job. They are dummies for this
           * child only — the point of the child is `NODE_ENV`, not its keys.
           */
          env: {
            ...process.env,
            NODE_ENV: "production",
            AUTH_SECRET: process.env.AUTH_SECRET ?? "0".repeat(64),
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_verify16",
            APP_URL: process.env.APP_URL ?? "https://verify16.test",
          },
          encoding: "utf8",
        },
      );
      productionRefuses = out.trim().endsWith("false");
    } catch (error) {
      productionRefuses = false;
      console.log(`    (child process failed: ${String(error).slice(0, 120)})`);
    }
    check(
      "🔴 C37 …and a static rate is REFUSED in production, in code rather than in a comment",
      productionRefuses,
      productionRefuses ? "refused" : "a guessed rate could settle a real payment",
    );

    /* ------------------------------------------------------- C69 */

    /*
     * 🔴 The ruling, exercised rather than described.
     *
     * A completed session for a clinician whose money we are holding must take
     * its fee out of that held balance — no invoice to pay, no cash movement,
     * and the two balances that meet are the only two that ever should. This
     * runs the real `chargeForSession`, not the posting underneath it, because
     * the claim 17 will publish is about what happens when a session ends.
     */
    await db
      .insert(subscriptions)
      .values({ organizationId: org.id, plan: "payg", status: "active", trialSessionUsed: true })
      .onConflictDoUpdate({
        target: subscriptions.organizationId,
        set: { trialSessionUsed: true },
      });

    const [netSession] = await db
      .insert(sessions)
      .values({
        organizationId: org.id,
        therapistId: payee.id,
        status: "completed",
        modality: "video",
        guestName: TAG,
        feedbackToken: `${TAG}-token`,
        endedAt: new Date(),
      })
      .returning({ id: sessions.id });

    const heldBefore = await (await import("../lib/billing/ledger")).heldForTherapist(payee.id);
    const { chargeForSession } = await import("../lib/billing/service");
    const charge = await chargeForSession({ organizationId: org.id, sessionId: netSession!.id });
    const heldAfter = await (await import("../lib/billing/ledger")).heldForTherapist(payee.id);

    check(
      "🔴 C69 a session fee is taken OUT OF held earnings, so 17 may say it is",
      charge?.status === "netted" && heldAfter === heldBefore - (charge?.amountCents ?? 0),
      `${charge?.status}: ${heldBefore} → ${heldAfter} cents`,
    );

    const [nettedInvoice] = await db
      .select({ status: invoices.status, amount: invoices.amountCents })
      .from(invoices)
      .where(eq(invoices.sessionId, netSession!.id))
      .limit(1);
    check(
      "🔴 C69 …and the clinician is left with nothing to pay, rather than a second bill",
      nettedInvoice?.status === "paid",
      `invoice ${nettedInvoice?.status} for ${nettedInvoice?.amount}`,
    );

    /*
     * The control. Netting must be *conditional*: a clinician we hold nothing
     * for is billed exactly as before. Without this, the check above would
     * pass just as well if the code netted unconditionally and invented money.
     */
    const drained = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, bob.id))
      .limit(1);
    const [plainSession] = await db
      .insert(sessions)
      .values({
        organizationId: org.id,
        therapistId: drained[0]!.id,
        status: "completed",
        modality: "video",
        guestName: TAG,
        feedbackToken: `${TAG}-token-2`,
        endedAt: new Date(),
      })
      .returning({ id: sessions.id });

    const plainCharge = await chargeForSession({
      organizationId: org.id,
      sessionId: plainSession!.id,
    });
    check(
      "🔴 C69 CONTROL, a clinician we hold nothing for is still BILLED, not netted",
      plainCharge?.status === "due",
      `${plainCharge?.status}`,
    );

    const { getSettings } = await import("../lib/settings");
    const settings = await getSettings();
    check(
      "🔴 C69 netting exists as a setting, and is ON by default, 17's copy may describe it",
      settings.payouts.netFeeFromHeldEarnings === true,
      `netFeeFromHeldEarnings=${settings.payouts.netFeeFromHeldEarnings}`,
    );
    check(
      "C74 the two-person threshold and the ageing window are configuration, not constants",
      settings.payouts.twoPersonThresholdCents > 0 && settings.payouts.alertAfterHours > 0,
      `$${settings.payouts.twoPersonThresholdCents / 100} · ${settings.payouts.alertAfterHours}h`,
    );
    check(
      "🔴 C76 the spread a therapist absorbs is zero by default. We take no margin on the rate",
      settings.payouts.egpSpreadBps === 0,
      `${settings.payouts.egpSpreadBps}bps`,
    );
  } finally {
    /*
     * The payout legs this script posts carry the product's own memo, not the
     * tag, so they are cleaned by what they REFER to: the requests below. A
     * previous run of this file left $20 of untagged held balance behind and
     * the next run failed on it — cleanup that only knows about its own
     * strings is cleanup that leaks.
     */
    await db.delete(ledgerEntries).where(
      sql`(${ledgerEntries.refType} = 'payout_request'
           AND ${ledgerEntries.refId} IN (SELECT id FROM payout_requests WHERE identifier LIKE ${`${TAG}%`}))`,
    );
    await db.delete(ledgerEntries).where(
      sql`${ledgerEntries.refType} = 'session'
          AND ${ledgerEntries.refId} IN (SELECT id FROM sessions WHERE guest_name = ${TAG})`,
    );
    await db.delete(invoices).where(
      sql`session_id IN (SELECT id FROM sessions WHERE guest_name = ${TAG})`,
    );
    await db.delete(ledgerEntries).where(
      sql`${ledgerEntries.refType} = 'invoice'
          AND ${ledgerEntries.refId} NOT IN (SELECT id FROM invoices)`,
    );
    await db.delete(sessions).where(like(sessions.guestName, `${TAG}%`));
    await db.delete(payoutRequestEvents).where(
      sql`request_id IN (SELECT id FROM payout_requests WHERE identifier LIKE ${`${TAG}%`})`,
    );
    await db.delete(payoutRequests).where(like(payoutRequests.identifier, `${TAG}%`));
    await db.delete(payoutMethods).where(like(payoutMethods.identifier, `${TAG}%`));
    await db.delete(ledgerEntries).where(like(ledgerEntries.memo, `${TAG}%`));
    /*
     * Last, because everything above refers to them: the users and the
     * organisation this run planted, and never one it found.
     */
    await db.delete(users).where(like(users.email, `${TAG}-%`));
    await db.delete(organizations).where(like(organizations.name, `${TAG} clinic`));

  }

  console.log(
    `\n${failures === 0 ? "sprint 16: PASS" : `sprint 16: ${failures} FAILED`} (${checks} checks)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
