import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { Card, PageHeader } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { requireStaff } from "@/lib/auth/guard";
import { controlDb as db } from "@/lib/db";
import { manualPayments, patientAccounts } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Patient account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A patient's PAYMENTS, for the operator holding a transfer from them.
 *
 * ## 🔴 76.11 — WHAT THIS PAGE IS, AND THE MUCH LONGER LIST OF WHAT IT IS NOT
 *
 * The transfers queue links every payer's name to their page. A company has one
 * now and a clinician always had one. This is the patient's, and it is the one
 * that needed the most care, because a patient is the person this whole product
 * exists to protect.
 *
 * So it holds **money and nothing else**. No notes. No diagnoses. No
 * assessments. No homework, no journal, no check-in replies. Not the name of
 * the clinician they see, not the times of their sessions, not how many they
 * have had.
 *
 * That is not squeamishness, it is the same rule the rest of the product is
 * built on stated for a new surface: an operator matching a bank line needs to
 * know whether a payment arrived and whether one like it already did. Every
 * other fact on this person is somebody else's to hold, and a page that offered
 * them would be read by somebody eventually — which is the entire history of
 * how a wall like this gets breached.
 *
 * ## 🔴 THE SESSION IS NAMED BY ITS REFERENCE, NEVER BY ITS CLINICIAN
 *
 * A payment row carries the session it settles. Resolving that to "with Dr X"
 * would turn a payments page into a record of who somebody is seeing, which is
 * exactly the fact C243 protects in the other direction. The id is enough to
 * match a transfer and tells an operator nothing they should not know.
 */
export default async function PatientAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [account] = await db
    .select({ id: patientAccounts.id, email: patientAccounts.email })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, id))
    .limit(1);

  if (!account) notFound();

  const payments = await db
    .select({
      id: manualPayments.id,
      purpose: manualPayments.purpose,
      refId: manualPayments.refId,
      state: manualPayments.state,
      amountCents: manualPayments.amountCents,
      settlesCents: manualPayments.settlesCents,
      currency: manualPayments.currency,
      reference: manualPayments.reference,
      rejectReason: manualPayments.rejectReason,
      createdAt: manualPayments.createdAt,
    })
    .from(manualPayments)
    .where(eq(manualPayments.patientAccountId, id))
    .orderBy(desc(manualPayments.createdAt))
    .limit(50);

  return (
    <div className="space-y-5">
      <PageHeader
        title={account.email ?? "Patient"}
        subtitle="Payments only."
      />

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
                    {p.refId ? ` · session ${p.refId.slice(0, 8)}…` : ""}
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
