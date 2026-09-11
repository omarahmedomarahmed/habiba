import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";

import { PayoutSettings } from "@/components/settings/payouts";
import { SettingsNav, SettingsSection } from "@/components/settings/section";
import { PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { TimezoneSettings } from "@/components/settings/timezone-settings";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { accountBalance, getConnectAccount, refreshAccountStatus } from "@/lib/billing/connect";
import { heldForTherapist } from "@/lib/billing/ledger";
import { db } from "@/lib/db";
import { AssistantPrefsSettings } from "@/components/assistant/prefs-settings";
import { assistantPrefs } from "@/lib/ai/assistant";
import { practiceState } from "@/lib/data/verification";
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

  const [[user], balance, [outstanding], settings, prefs, practice] = await Promise.all([
    db.select().from(users).where(eq(users.id, actor.userId)).limit(1),
    accountBalance(actor.userId),
    db
      .select({
        cents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}), 0)::int`,
      })
      .from(invoices)
      .where(and(eq(invoices.organizationId, actor.organizationId), eq(invoices.status, "due"))),
    getSettings(),
    assistantPrefs(actor.userId),
    practiceState(actor.userId),
  ]);

  /*
   * 24.4 — the sections, in the order somebody arrives looking for them.
   *
   * Getting paid is second rather than last because it is the reason most
   * people open this page at all; the copilot's voice is fourth because
   * nobody has ever opened settings in a hurry to change it.
   */
  const sections = [
    { id: "you", title: "You" },
    { id: "paid", title: "Getting paid" },
    { id: "when", title: "Your hours" },
    { id: "copilot", title: "The copilot" },
    { id: "security", title: "Security" },
    ...(actor.role === "super_admin" ? [{ id: "admin", title: "Admin" }] : []),
  ];

  const held = await heldForTherapist(actor.userId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle={actor.email} />

      <div className="space-y-8 px-4 pb-10 sm:px-6">
        <SettingsNav sections={sections} />

        {payouts === "refresh" ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            That Stripe link expired before you finished. Start it again below. Nothing was lost.
          </p>
        ) : null}

        <SettingsSection
          id="you"
          title="You"
          why="Your name and credentials as a patient sees them, and the licence our compliance team checked."
        >
          {/*
            24.4 — the verification state belongs here, and it was on no screen
            a verified clinician ever visits again. "Am I approved?" is a
            question people ask support, and the answer was only ever on the
            onboarding page they are redirected away from once they pass.
          */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">Your practice</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {practice === "approved"
                ? "Approved. Your licence has been checked and you can see patients."
                : practice === "submitted"
                  ? "With our compliance team. You will hear from us, and nothing else is needed from you right now."
                  : practice === "rejected"
                    ? "Not approved. Open verification to see what we need and send it again."
                    : "Not submitted yet. You cannot start a session until your licence has been checked."}
            </p>
            {practice !== "approved" ? (
              <Link
                href="/onboarding"
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
              >
                Open verification
              </Link>
            ) : null}
          </Card>

          <ProfileForm
            initial={{
              firstName: user?.firstName ?? "",
              lastName: user?.lastName ?? "",
              credentials: user?.profile?.credentials ?? "",
              licenseType: user?.profile?.licenseType ?? "",
              licenseNumber: user?.profile?.licenseNumber ?? "",
              licenseState: user?.profile?.licenseState ?? "",
            }}
          />

          {/* 25.17 / C120 — the clinic-wall code lives with the rest of "you". */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">Your QR code</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              A code for the wall or the end of a session. It names you and nothing else, and you
              can revoke one when a poster goes out of date.
            </p>
            <Link
              href="/settings/codes"
              className="mt-3 inline-flex text-sm font-semibold text-brand-600"
            >
              Open your codes
            </Link>
          </Card>
        </SettingsSection>

        <SettingsSection
          id="paid"
          title="Getting paid"
          why="Where a patient's payment lands, what we are holding for you, and what you owe us."
        >
          <PayoutSettings
            state={{
              connected: Boolean(connect.accountId),
              chargesEnabled: connect.chargesEnabled,
              payoutsEnabled: connect.payoutsEnabled,
              sessionRateCents: connect.sessionRateCents,
              rateCurrency: connect.rateCurrency,
              autoSettleFromEarnings: connect.autoSettleFromEarnings,
              availableCents: balance?.availableCents ?? null,
              pendingCents: balance?.pendingCents ?? null,
              outstandingCents: outstanding?.cents ?? 0,
              feeBps: settings.session.platformFeeBps,
              heldCents: held,
            }}
          />
        </SettingsSection>

        <SettingsSection
          id="when"
          title="Your hours"
          why="The zone every time in this product is shown in, and the hour we are willing to message your patients at."
        >
          <TimezoneSettings initial={user?.timezone ?? null} />
        </SettingsSection>

        <SettingsSection
          id="copilot"
          title="The copilot"
          why="How it talks back to you. It never talks to a patient."
        >
          <AssistantPrefsSettings
            initial={{
              language: prefs.language,
              voice: prefs.voice,
              voiceSpeed: prefs.voiceSpeed,
            }}
          />
        </SettingsSection>

        <SettingsSection
          id="security"
          title="Security"
          why="Your password, and the way out."
        >
          <PasswordForm />
        </SettingsSection>

        {actor.role === "super_admin" ? (
          <SettingsSection
            id="admin"
            title="Admin"
            why="The back office. Only people with a role here can open it."
          >
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
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}
