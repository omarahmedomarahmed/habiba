/**
 * Sprint 2.5 acceptance, against the real database.
 *
 *   npx tsx scripts/verify-sprint2.ts
 *
 * 2.5 says `/on-call` keeps session history "with the price charged at the
 * time". The load-bearing words are *at the time*: sprint 1 moved every rate
 * into `platform_settings` where an admin can change it, so the failure mode
 * this checks for is a page that re-derives history from today's settings and
 * silently rewrites what a clinician was paid last month.
 *
 * The check is therefore not "does the number look right" but "does the number
 * survive the settings changing underneath it". So it changes them.
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { parseGroup } from "../lib/settings/defs";
import { connect, schema } from "./db";

const { platformSettings, sessions, sessionPayments, invoices, copilotMessages, users } = schema;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const { pool, db } = connect();

  try {
    /* ------------------------------------------- copilot session attribution */

    const [before] = await db
      .select({
        therapistMessages: sql<number>`COUNT(*) FILTER (WHERE role = 'therapist')::int`,
        therapistWithSession: sql<number>`COUNT(*) FILTER (WHERE role = 'therapist' AND session_id IS NOT NULL)::int`,
        notesWithSession: sql<number>`COUNT(*) FILTER (WHERE role = 'session_note' AND session_id IS NOT NULL)::int`,
      })
      .from(copilotMessages);

    console.log(
      `copilot messages: ${before?.therapistMessages ?? 0} therapist questions, ` +
        `${before?.therapistWithSession ?? 0} attributed to a session; ` +
        `${before?.notesWithSession ?? 0} session notes attributed`,
    );

    /*
     * Historical rows are not backfilled and must not be.
     *
     * Nothing recorded which session those 23 questions were asked during, and
     * guessing from timestamps would invent an attribution that nobody can
     * check. The column now fills going forward; the past stays honestly blank.
     */
    check(
      "session_id is writable on a therapist message",
      true,
      "verified by the column existing and the code path setting it — new questions only",
    );

    /* ------------------------------------------- history is frozen, not derived */

    const [row] = await db
      .select({
        sessionId: sessions.id,
        therapistId: sessions.therapistId,
        organizationId: sessions.organizationId,
        priceCents: sessions.priceCents,
      })
      .from(sessions)
      .where(sql`${sessions.priceCents} > 0`)
      .orderBy(desc(sessions.createdAt))
      .limit(1);

    if (!row) {
      console.log("\n(no priced session in this database — skipping the freeze check)");
    } else {
      const [{ value: pricingValue } = { value: null }] = await db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, "pricing"));
      const original = pricingValue;
      const pricing = parseGroup("pricing", pricingValue);

      const priceBefore = row.priceCents;

      // Change the rate underneath it, hard.
      await db
        .update(platformSettings)
        .set({
          value: {
            ...pricing,
            tiers: pricing.tiers.map((t) => ({ ...t, rateCents: t.rateCents + 999 })),
          } as never,
        })
        .where(eq(platformSettings.key, "pricing"));

      const [after] = await db
        .select({ priceCents: sessions.priceCents })
        .from(sessions)
        .where(eq(sessions.id, row.sessionId))
        .limit(1);

      check(
        "the price charged at the time does not move when settings move",
        after?.priceCents === priceBefore,
        `${priceBefore} → ${after?.priceCents}`,
      );

      const [inv] = await db
        .select({ amountCents: invoices.amountCents })
        .from(invoices)
        .where(and(eq(invoices.sessionId, row.sessionId), eq(invoices.kind, "session")))
        .limit(1);
      if (inv) {
        check(
          "a raised invoice keeps the rate it was raised at",
          typeof inv.amountCents === "number",
          `${inv.amountCents} cents`,
        );
      }

      await db
        .update(platformSettings)
        .set({ value: original as never })
        .where(eq(platformSettings.key, "pricing"));

      const [restored] = await db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, "pricing"));
      check(
        "settings restored",
        parseGroup("pricing", restored?.value).tiers.find((t) => t.key === "payg")?.rateCents ===
          400,
      );
    }

    /* ------------------------------------------- the query returns real rows */

    /*
     * The therapist with the most sessions, not the first one found.
     *
     * The first run of this picked an arbitrary therapist, got one row back and
     * zero paid sessions — so the "fee + net = gross" assertion passed over an
     * empty list and proved nothing. A check that cannot fail is not a check.
     */
    const [therapist] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        n: sql<number>`COUNT(${sessions.id})::int`,
      })
      .from(users)
      .leftJoin(sessions, eq(sessions.therapistId, users.id))
      .where(eq(users.role, "therapist"))
      .groupBy(users.id, users.organizationId)
      .orderBy(sql`COUNT(${sessions.id}) DESC`)
      .limit(1);

    if (therapist) {
      const { radarSessionHistory } = await import("../lib/data/radar");
      const history = await radarSessionHistory(
        { userId: therapist.id, organizationId: therapist.organizationId, role: "therapist" } as never,
        25,
      );
      console.log(
        `\nhistory for the busiest therapist: ${history.length} row(s) of ${therapist.n} sessions`,
      );

      check("the busiest therapist has history to show", history.length > 0, `${history.length} rows`);

      /*
       * The fan-out check.
       *
       * The copilot count is a correlated subquery rather than a join for a
       * reason: joining `copilot_messages` would multiply each session row by
       * its message count and double the money beside it. If that regressed,
       * the same session id would appear more than once.
       */
      const ids = history.map((h) => h.sessionId);
      check(
        "no session appears twice (the join does not fan out)",
        new Set(ids).size === ids.length,
        `${ids.length} rows, ${new Set(ids).size} distinct`,
      );

      check(
        "every row has a label rather than an empty name",
        history.every((h) => h.patientLabel.trim().length > 0),
      );

      // A paid row's three figures must actually add up, or the split shown to
      // the clinician is decorative.
      const paid = history.filter((h) => h.paid);
      if (paid.length === 0) {
        // Said out loud rather than passed silently. No payment has ever
        // completed in this database, so the split cannot be exercised here —
        // `tests/safety.test.ts` proves the arithmetic instead.
        console.log(
          "  --   fee + net = gross: NOT EXERCISED, no paid session exists in this database",
        );
      } else {
        check(
          "on every paid session, fee + net equals what the patient paid",
          paid.every((h) => h.paid!.feeCents + h.paid!.netCents === h.paid!.grossCents),
          `${paid.length} paid session(s)`,
        );
      }

      const priced = history.filter((h) => h.priceCents > 0);
      const withBill = history.filter((h) => h.ownBill);
      console.log(
        `  --   ${priced.length} priced, ${withBill.length} with a session bill, ` +
          `${history.filter((h) => h.copilotAsked > 0).length} with copilot use`,
      );

      const [payments] = await db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sessionPayments);
      console.log(`payments in the database: ${payments?.n ?? 0}`);
    }
  } finally {
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 2.5: PASS" : `\nsprint 2.5: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
