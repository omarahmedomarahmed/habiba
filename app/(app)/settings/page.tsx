import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";

import { PayoutSettings } from "@/components/settings/payouts";
import { SettingsForms } from "@/components/settings/settings-forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import {
  accountBalance,
  getConnectAccount,
  PLATFORM_FEE_BPS,
  refreshAccountStatus,
} from "@/lib/billing/connect";
import { heldForTherapist } from "@/lib/billing/ledger";
import { db } from "@/lib/db";
import { invoices, users } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payouts?: string }>;
}) {
  const actor = await requireUser();
  const { payouts } = await searchParams;

  // Coming back from Stripe proves the form was submitted, not that Stripe
  // accepted it — so re-read the account rather than flipping a flag on the
  // redirect. The webhook does the same thing; this is for the therapist who is
  // looking at the page right now.
  const connect =
    payouts === "return"
      ? await refreshAccountStatus(actor.userId)
      : await getConnectAccount(actor.userId);

  const [[user], balance, [outstanding]] = await Promise.all([
    db.select().from(users).where(eq(users.id, actor.userId)).limit(1),
    accountBalance(actor.userId),
    db
      .select({
        cents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(eq(invoices.organizationId, actor.organizationId), eq(invoices.status, "due")),
      ),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle={actor.email} />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {payouts === "refresh" ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            That Stripe link expired before you finished. Start it again below — nothing was lost.
          </p>
        ) : null}

        <SettingsForms
          initial={{
            firstName: user?.firstName ?? "",
            lastName: user?.lastName ?? "",
            credentials: user?.profile?.credentials ?? "",
            licenseType: user?.profile?.licenseType ?? "",
            licenseNumber: user?.profile?.licenseNumber ?? "",
            licenseState: user?.profile?.licenseState ?? "",
          }}
          isAdmin={actor.role === "super_admin"}
        />

        <PayoutSettings
          state={{
            connected: Boolean(connect.accountId),
            chargesEnabled: connect.chargesEnabled,
            payoutsEnabled: connect.payoutsEnabled,
            sessionRateCents: connect.sessionRateCents,
            autoSettleFromEarnings: connect.autoSettleFromEarnings,
            availableCents: balance?.availableCents ?? null,
            pendingCents: balance?.pendingCents ?? null,
            outstandingCents: outstanding?.cents ?? 0,
            feeBps: PLATFORM_FEE_BPS,
            heldCents: await heldForTherapist(actor.userId),
          }}
        />

        {actor.role === "super_admin" ? (
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">Admin console</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage clinicians, review the audit log and edit the public site.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white"
            >
              Open admin
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
