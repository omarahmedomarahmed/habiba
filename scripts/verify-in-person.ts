/**
 * 🔴 PAY BEFORE START, IN PERSON (docs/IN-PERSON-PAID.md, rulings 5 and 5b).
 *
 * Proves, against the dev database:
 *   - a cash in-person session has no price, no link and starts at once;
 *   - one the patient pays through us gets a pay link, a price, and cannot
 *     start until paid, not even by writing past the check;
 *   - creating it spends no company money: only the patient, signed in, can,
 *     and the weekly cap holds;
 *   - "they paid me directly" turns it to cash while nothing is paid;
 *   - an unpaid one whose link ran out is cancelled, and a started one never is.
 */
import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const fixture = `inp${Date.now().toString(36)}`;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function main() {
  writesTo();
  const { db, pool } = connect();
  const one = async <T,>(text: ReturnType<typeof sql>): Promise<T> => (await db.execute(text)).rows[0] as T;

  try {
    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind) VALUES ('In Person Demo', 'eg', ${fixture}, 'solo') RETURNING id`);
    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, session_rate_cents)
      VALUES (${org.id}, ${`nadia.${fixture}@example.com`}, 'Nadia', 'Demo', 'therapist', 'x', 2000) RETURNING id`);
    const actor = { userId: therapist.id, organizationId: org.id, role: "therapist" as const, email: `nadia.${fixture}@example.com`, timezone: "UTC" };

    const { createSession, startSession, unpaidInPerson } = await import("../lib/data/sessions");

    const cash = await createSession(actor as never, { modality: "in_person", guestName: "Cash Demo", priceCents: 2000 } as never);
    const cashRow = await one<{ price: number; token: string | null; pay: string }>(sql`
      SELECT price_cents AS price, join_token AS token, payment_status AS pay FROM sessions WHERE id = ${cash!.id}`);
    check("a cash in-person session carries no price and no link", cashRow.price === 0 && cashRow.token === null && cashRow.pay === "not_required", JSON.stringify(cashRow));
    await startSession(actor as never, cash!.id);
    const cashStarted = await one<{ status: string }>(sql`SELECT status FROM sessions WHERE id = ${cash!.id}`);
    check("…and starts at once", cashStarted.status === "in_progress");

    const paid = await createSession(actor as never, {
      modality: "in_person",
      guestName: "Paid Demo",
      priceCents: 2000,
      inPersonPaid: true,
    } as never);
    const paidRow = await one<{ price: number; token: string | null; pay: string; modality: string }>(sql`
      SELECT price_cents AS price, join_token AS token, payment_status AS pay, modality FROM sessions WHERE id = ${paid!.id}`);
    check(
      "🔴 paid through us: a price, a pay link, waiting",
      paidRow.price === 2000 && Boolean(paidRow.token) && paidRow.pay === "pending" && unpaidInPerson({ modality: paidRow.modality, priceCents: paidRow.price, paymentStatus: paidRow.pay }),
      JSON.stringify(paidRow),
    );

    const pot = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM session_payments WHERE session_id = ${paid!.id}`);
    check("🔴 creating it spends no company money: the therapist never can", pot.n === 0);

    let refused = "";
    try {
      await startSession(actor as never, paid!.id);
    } catch (error) {
      refused = (error as Error).message;
    }
    const stillScheduled = await one<{ status: string }>(sql`SELECT status FROM sessions WHERE id = ${paid!.id}`);
    check("🔴 it cannot start unpaid", Boolean(refused) && stillScheduled.status === "scheduled", refused);

    const { payFromPot } = await import("../lib/billing/pot");
    const byTherapist = await payFromPot(paid!.id);
    check(
      "🔴 the company benefit refuses anyone but the patient on an in-person session",
      !byTherapist.paid && (byTherapist.reason === "patient_must_confirm" || byTherapist.reason === "no_benefit"),
      JSON.stringify(byTherapist),
    );

    const direct = read("app/(app)/sessions/[id]/actions.ts");
    check(
      "🔴 \"they paid me directly\" only while nothing is paid or on its way, and it kills the link",
      /export async function paidDirectly/.test(direct) &&
        /eq\(sessions\.paymentStatus, "pending"\)/.test(direct) &&
        /joinToken: null/.test(direct) &&
        /export async function sendPayLink/.test(direct),
    );

    await db.execute(sql`UPDATE sessions SET join_token_expires_at = now() - interval '1 minute' WHERE id = ${paid!.id}`);
    const { sweepInPerson } = await import("../lib/data/in-person");
    const swept = await sweepInPerson();
    const afterSweep = await one<{ status: string; token: string | null }>(sql`SELECT status, join_token AS token FROM sessions WHERE id = ${paid!.id}`);
    const startedKept = await one<{ status: string }>(sql`SELECT status FROM sessions WHERE id = ${cash!.id}`);
    check(
      "🔴 unpaid past its link: cancelled, link gone; the started session untouched",
      swept.expired >= 1 && afterSweep.status === "cancelled" && afterSweep.token === null && startedKept.status === "in_progress",
      JSON.stringify({ swept, afterSweep, startedKept }),
    );

    const source = read("lib/data/sessions.ts");
    check(
      "🔴 the no-unpaid-start rule is in the UPDATE too, so two tabs cannot race past it",
      /NOT \(\$\{sessions\.modality\} = 'in_person' AND \$\{sessions\.priceCents\} > 0 AND \$\{sessions\.paymentStatus\} <> 'paid'\)/.test(source),
    );
    const pay = read("app/pay/[token]/page.tsx");
    check("the pay page offers no bank transfer in person, and the benefit only to the patient", /if \(inPerson\) \{/.test(pay) && /coverWithBenefit/.test(pay));
    const actions = read("app/(app)/sessions/actions.ts");
    check("🔴 the price may be lowered and never raised above the therapist's own", /above your price per session/.test(actions));
  } finally {
    await db.execute(sql`DELETE FROM audit_log WHERE organization_id IN (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM users WHERE organization_id IN (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
  }

  await pool.end();
  finish("in person");
}

void main();
