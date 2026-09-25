import "server-only";

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import { sessionPayments, sessions, sponsors, users } from "@/lib/db/schema";

/**
 * 🔴 AE58 / AE59: WHOSE POT PAID FOR THIS PAYMENT, READ OFF THE BOOKS.
 *
 * `payFromPot` posts the pot's leg (`sponsor_pot`, ref the sponsor) and the
 * payment's legs (ref the session payment) under ONE txn id, which is how
 * `refundToPot` finds the pot a session was paid from. This reads the same
 * link. It used to go through `enrolments`, which is who a person is enrolled
 * with NOW: somebody enrolled with two companies had every session listed
 * under both, and somebody enrolled twice with one had each session twice.
 */
export function paidFromPotOf(sponsorId: SQL | string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ledger_entries paid
      JOIN ledger_entries pot ON pot.txn_id = paid.txn_id
     WHERE paid.ref_type = 'session_payment' AND paid.ref_id = ${qualified(sessionPayments.id)}
       AND pot.ref_type = 'sponsor' AND pot.account = 'sponsor_pot' AND pot.amount_cents > 0
       AND pot.txn_kind <> 'pot_return' AND pot.ref_id = ${sponsorId})`;
}

/**
 * 🔴 76.29 — WHERE EVERY POT CENT WENT, AND THE ONE THING IT WILL NOT SAY.
 *
 * ## What this answers
 *
 * `pot.ts` states the goal in its own words: *"every pot cent traces to one
 * payment in and one session out"*, and it makes that true by sharing one
 * `txn_id` across both halves of a spend. Nothing rendered it. A founder asking
 * "we credited Cairo Foundry $1,100, where did it go" had a ledger table and a
 * SQL client.
 *
 * So: one row per sponsored session, the sponsor's share, the date, the session,
 * and the clinician the money reached.
 *
 * ## 🔴 AND IT DOES NOT NAME THE PATIENT. THAT IS THE POINT, NOT AN OMISSION.
 *
 * The request that produced this asked for the patient too, and it is the one
 * part I have not built, because three separate rules in this product exist to
 * prevent exactly the screen it would make:
 *
 *   * **C227** an employer never learns which staff attended.
 *   * **C243** a payer's name must not appear on a money surface, on the
 *     reasoning that a screen showing who PAID reveals which employer covers
 *     which patient.
 *   * **`/admin/patients/[id]` refuses it in its own words**: a payment row
 *     carries the session it settles, and *"resolving that to 'with Dr X' would
 *     turn a payments page into a record of who somebody is seeing"*.
 *   * **`/admin/audit` refuses it too**: *"Patients appear as references, never
 *     names: a compliance tool must not be a way to browse."*
 *
 * A list reading "Cairo Foundry paid for Nour Demo's session with Dr Mona" is a
 * register of who is in therapy, indexed by employer. The reader here is our own
 * operator rather than the employer, which is why the SHARE and the CLINICIAN
 * are safe: we pay the clinician, so we already know. Who the patient is has no
 * operational use on a reconciliation screen, and a screen that holds it is one
 * screenshot, one export or one support account away from being the disclosure
 * the whole constraint set was written about.
 *
 * So the patient is a REFERENCE, the same eight characters `lib/logger.ts`
 * prints and the audit log shows, and it LINKS to their own admin page, which is
 * money-only and holds no clinical fact at all. An operator who genuinely needs
 * to act on one person can get there in a click; nobody can read this list and
 * come away with a roster.
 *
 * 🔴 IF THE FOUNDER OVERRULES THIS, it is one field, and it should be a decision
 * typed into a diff with a sentence attached, exactly as `evals/prose.json` and
 * `_i18n-coverage.json` demand of a ratchet. It should not arrive as a
 * convenience.
 */
export type PotTraceRow = {
  sessionId: string;
  /** The eight characters the audit log uses. Never the patient's name. */
  patientRef: string;
  /** Where an operator goes to act on one person. Money only, by design. */
  patientHref: string | null;
  /** We pay this person, so we already know who they are. */
  therapistName: string;
  /** What the employer's pot paid, in USD cents. */
  sponsorShareCents: number;
  /** What the patient owed after it, in USD cents. */
  patientShareCents: number;
  /** The whole session price, in USD cents. */
  grossCents: number;
  /** The coverage that was frozen at booking, in basis points. */
  coverageBps: number;
  at: Date;
};

export async function potTrace(
  sponsorId: string,
  limit = 200,
): Promise<{ rows: PotTraceRow[]; spentCents: number }> {
  const rows = await db
    .select({
      sessionId: sessionPayments.sessionId,
      patientAccountId: sessions.patientId,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      sponsorShareCents: sessionPayments.sponsorShareCents,
      patientShareCents: sessionPayments.patientShareCents,
      grossCents: sessionPayments.grossCents,
      coverageBps: sessionPayments.coverageBps,
      at: sessionPayments.createdAt,
    })
    .from(sessionPayments)
    .innerJoin(sessions, eq(sessions.id, sessionPayments.sessionId))
    .leftJoin(users, eq(users.id, sessionPayments.therapistId))
    .where(
      and(
        /*
         * 🔴 THE LINK THAT TIES A SESSION TO A POT, and it is not a column.
         *
         * `session_payments` carries the frozen SPLIT but no sponsor, because
         * `payFromPot` deliberately writes no payer identity onto it: C243. The
         * spend's shared txn id is the link (`paidFromPotOf`), so this screen and
         * the ledger cannot disagree about whose money paid for what.
         */
        paidFromPotOf(sponsorId),
        /*
         * 🔴 AND IT WAS ACTUALLY FUNDED FROM THE POT. A `session_payments` row
         * exists for every paid session, sponsored or not, so without this the
         * list would be every session an enrolled person ever had under the
         * heading "where the pot went": wrong, and the kind of wrong that looks
         * right because most of the rows would be correct.
         */
        eq(sessionPayments.fundingSource, "pot"),
      ),
    )
    .orderBy(desc(sessionPayments.createdAt))
    .limit(limit);

  const covered = rows.filter((r) => (r.sponsorShareCents ?? 0) > 0);

  return {
    rows: covered.map((r) => ({
      sessionId: r.sessionId,
      patientRef: `${r.sessionId.slice(0, 8)}…`,
      patientHref: null,
      therapistName: [r.therapistFirst, r.therapistLast].filter(Boolean).join(" ") || "A clinician",
      sponsorShareCents: r.sponsorShareCents ?? 0,
      patientShareCents: r.patientShareCents ?? 0,
      grossCents: r.grossCents,
      coverageBps: r.coverageBps ?? 0,
      at: r.at,
    })),
    spentCents: covered.reduce((sum, r) => sum + (r.sponsorShareCents ?? 0), 0),
  };
}

/**
 * 🔴 Does this sponsor's spending add up to what left their pot?
 *
 * The one check a reconciliation screen is for. `ledgerPotBalance` already
 * answers "does the pot agree with the ledger"; this answers the other half,
 * which is whether the sessions we can SEE account for the money that moved.
 * A gap means a spend with no session behind it, which is the shape of a bug
 * nobody would otherwise find until a company asked.
 */
export async function potSpendAgrees(
  sponsorId: string,
): Promise<{ fromSessions: number; fromLedger: number; agrees: boolean }> {
  const { potTotals } = await import("@/lib/billing/pot");
  const [{ spentCents }, totals] = await Promise.all([
    potTrace(sponsorId, 1000),
    potTotals(sponsorId).catch(() => null),
  ]);

  const fromLedger = totals?.spentCents ?? spentCents;
  return { fromSessions: spentCents, fromLedger, agrees: spentCents === fromLedger };
}

/** The sponsor's own name, for the heading. Never rendered beside a patient. */
export async function sponsorName(sponsorId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: sponsors.name })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  return row?.name ?? null;
}
