import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { Card, PageHeader } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { requireStaff } from "@/lib/auth/guard";
import { ledgerPotBalance } from "@/lib/billing/pot";
import { controlDb as db } from "@/lib/db";
import { manualPayments, sponsorPots, sponsors } from "@/lib/db/schema";
import { potTerms } from "@/lib/data/sponsor-admin";

export const metadata: Metadata = { title: "Company", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * One company, for the operator who is looking at a transfer from them.
 *
 * ## 🔴 76.11 — WHY THIS PAGE EXISTS AND WHAT IT DELIBERATELY DOES NOT HOLD
 *
 * The transfers queue now links a payer's name to their page, and a company
 * had none: `/admin/sponsors` is a list, and finding one account in it meant
 * scrolling or searching. The question an operator actually has in front of an
 * unmatched transfer is always the same — **has this company paid us before,
 * and what did they send last time** — so that is what this answers.
 *
 * ## 🔴 IT IS A MONEY PAGE, AND IT NAMES NOBODY WHO IS IN THERAPY
 *
 * C243's ruling is that an employer never learns which of their staff
 * attended, and the corollary holds here: an operator looking at a company's
 * payment has no business reading who that company covers either. There is no
 * roster on this page, no enrolment count small enough to identify anybody, and
 * no session. A balance, its terms, and the money that has moved.
 */
export default async function SponsorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [row] = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      kind: sponsors.kind,
      state: sponsors.state,
      entity: sponsors.entity,
      currency: sponsors.currency,
      contactName: sponsors.contactName,
      contactEmail: sponsors.contactEmail,
      contactPhone: sponsors.contactPhone,
    })
    .from(sponsors)
    .where(eq(sponsors.id, id))
    .limit(1);

  if (!row) notFound();

  const [[pot], terms, ledgerCents, payments] = await Promise.all([
    db
      .select({ balanceCents: sponsorPots.balanceCents, coverageBps: sponsorPots.coverageBps })
      .from(sponsorPots)
      .where(eq(sponsorPots.sponsorId, id))
      .limit(1),
    potTerms(id),
    ledgerPotBalance(id),
    /*
     * 🔴 Every transfer they have ever sent, including the rejected ones.
     * A company that has been turned down twice and is sending a third is the
     * single most useful thing this page can tell an operator, and a list that
     * quietly showed only the successes would hide it.
     */
    db
      .select({
        id: manualPayments.id,
        state: manualPayments.state,
        amountCents: manualPayments.amountCents,
        settlesCents: manualPayments.settlesCents,
        currency: manualPayments.currency,
        reference: manualPayments.reference,
        rejectReason: manualPayments.rejectReason,
        createdAt: manualPayments.createdAt,
      })
      .from(manualPayments)
      .where(eq(manualPayments.sponsorId, id))
      .orderBy(desc(manualPayments.createdAt))
      .limit(50),
  ]);

  /*
   * 🔴 THE TWO BALANCES, SIDE BY SIDE, because they are maintained by different
   * writers and can drift. `reconcilePots` exists to find exactly that, and an
   * operator standing in front of a disputed transfer is the person best placed
   * to notice it first.
   */
  const table = pot?.balanceCents ?? 0;
  const drift = table - ledgerCents;

  return (
    <div className="space-y-5">
      <PageHeader
        title={row.name}
        subtitle={`${row.kind} · ${row.state} · ${row.entity.toUpperCase()} entity`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Pot</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900">
            <Money cents={table} />
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {((pot?.coverageBps ?? 0) / 100).toFixed(0)}% covered
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Ledger</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900">
            <Money cents={ledgerCents} />
          </p>
          {drift !== 0 ? (
            <p className="mt-1 text-xs font-semibold text-red-600">
              Out by <Money cents={Math.abs(drift)} />
            </p>
          ) : (
            <p className="mt-1 text-xs text-emerald-700">Agrees.</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs text-slate-500">Contact</p>
          {/*
            🔴 Only what exists. Three placeholder lines is three lines of
            nothing, and C117 bans the em dash that would otherwise fill them.
          */}
          {[row.contactName, row.contactEmail, row.contactPhone].filter(Boolean).length === 0 ? (
            <p className="mt-0.5 text-sm text-slate-400">None</p>
          ) : (
            <>
              {row.contactName ? (
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{row.contactName}</p>
              ) : null}
              {row.contactEmail ? (
                <p className="text-xs break-all text-slate-500">{row.contactEmail}</p>
              ) : null}
              {row.contactPhone ? (
                <p className="text-xs text-slate-500">{row.contactPhone}</p>
              ) : null}
            </>
          )}
        </Card>
      </div>

      {terms?.refundPolicy ? (
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-700">Refund terms</p>
          <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-slate-600">
            {terms.refundPolicy}
          </p>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50 p-4">
          {/*
            🔴 The heading is the whole message. C233 means the database itself
            refuses a balance without terms, so an operator seeing this card
            already knows the transfer below it cannot be confirmed.
          */}
          <p className="text-sm font-semibold text-amber-900">No terms agreed</p>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">Transfers</h2>

        {payments.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500">Nothing yet.</Card>
        ) : (
          <Card className="divide-y divide-slate-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    <Money cents={p.settlesCents} />{" "}
                    <span className="text-xs text-slate-400">
                      sent {p.amountCents} {p.currency.toUpperCase()}
                    </span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {p.createdAt.toISOString().slice(0, 10)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                  {p.rejectReason ? (
                    <p className="mt-0.5 text-xs text-rose-600">{p.rejectReason}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-600">{p.state}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <Link href="/admin/transfers" className="text-sm text-slate-500 underline">
        Back
      </Link>
    </div>
  );
}
