import type { Metadata } from "next";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { patientCredits, patients, sessionPayments, sessions, users } from "@/lib/db/schema";
import { formatMoney } from "@/lib/billing/plans";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What a patient paid, and what it was split into. PLAN.md 15.6.
 *
 * ## Three numbers, never one
 *
 * §3 is explicit that the patient and the therapist each see the split as
 * separate lines with reasons. A single "you paid $34.20" hides that $4.20 of
 * it was tax and $4.50 was ours — and a patient who discovers either later is
 * one who stops trusting the receipt.
 *
 * ⚠️ **Incomplete until sprint 16.** Every figure here is the settlement
 * currency, which today is always USD. 15.6 asks for "the currency they paid
 * in", and the EGP rail does not exist yet — so this shows what was actually
 * charged rather than inventing a conversion, and says so.
 */
export default async function PatientBillingPage() {
  const actor = await requirePatient();

  const [paid, credits] = await Promise.all([
    db
      .select({
        sessionId: sessions.id,
        at: sessionPayments.paidAt,
        gross: sessionPayments.grossCents,
        vat: sessionPayments.vatCents,
        fee: sessionPayments.platformFeeCents,
        currency: sessionPayments.currency,
        therapistFirst: users.firstName,
        therapistLast: users.lastName,
      })
      .from(sessionPayments)
      .innerJoin(sessions, eq(sessions.id, sessionPayments.sessionId))
      .innerJoin(patients, eq(patients.id, sessions.patientId))
      .innerJoin(users, eq(users.id, sessions.therapistId))
      .where(and(eq(patients.personId, actor.personId), eq(sessionPayments.status, "paid")))
      .orderBy(desc(sessionPayments.paidAt))
      .limit(50),

    db
      .select({
        id: patientCredits.id,
        amount: patientCredits.amountCents,
        spent: patientCredits.spentCents,
        reason: patientCredits.reason,
        expiresAt: patientCredits.expiresAt,
      })
      .from(patientCredits)
      .where(
        and(
          eq(patientCredits.personId, actor.personId),
          gt(patientCredits.expiresAt, new Date()),
          sql`${patientCredits.spentCents} < ${patientCredits.amountCents}`,
        ),
      ),
  ]);

  const creditCents = credits.reduce((sum, c) => sum + (c.amount - c.spent), 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          What you paid, and exactly where it went.
        </p>
      </div>

      {creditCents > 0 ? (
        <Card className="border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-semibold text-teal-900">
            {formatMoney(creditCents, "USD")} in credit
          </p>
          <p className="mt-1 text-xs leading-relaxed text-teal-800">
            {credits[0]?.reason} It comes off your next session automatically, and it lasts until{" "}
            {formatDate(credits[0]?.expiresAt ?? null, actor.timezone)}.
          </p>
        </Card>
      ) : null}

      {paid.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">Nothing paid yet</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Sessions you pay for appear here with the full breakdown.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {paid.map((row) => (
            <li key={row.sessionId}>
              <Card className="p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {[row.therapistFirst, row.therapistLast].filter(Boolean).join(" ")}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatMoney((row.gross ?? 0) + (row.vat ?? 0), row.currency ?? "usd")}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(row.at, actor.timezone)}
                </p>

                {/* Three lines, with reasons. Never one number. */}
                <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                  <Row label="Your therapist's fee">
                    {formatMoney(row.gross ?? 0, row.currency ?? "usd")}
                  </Row>
                  <Row label="VAT, paid to the government">
                    {formatMoney(row.vat ?? 0, row.currency ?? "usd")}
                  </Row>
                  <Row label="24Therapy's share of the fee">
                    {formatMoney(row.fee ?? 0, row.currency ?? "usd")}
                  </Row>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-slate-400">
        ⚠️ Amounts are shown in the currency each payment was settled in. Paying in Egyptian pounds
        arrives in a later release.
      </p>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-700">{children}</dd>
    </div>
  );
}
