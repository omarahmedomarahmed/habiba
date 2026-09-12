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
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { AssistantPrefsSettings } from "@/components/assistant/prefs-settings";
import { assistantPrefs } from "@/lib/ai/assistant";
import { practiceState } from "@/lib/data/verification";
import { invoices, users } from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/settings/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payouts?: string }>;
}) {
  const { t } = await getI18n();
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
    { id: "you", title: t("portal.settings.tabYou") },
    { id: "paid", title: t("portal.settings.tabPaid") },
    { id: "when", title: t("portal.settings.tabHours") },
    { id: "copilot", title: t("portal.settings.tabCopilot") },
    { id: "security", title: t("portal.settings.tabSecurity") },
    ...(actor.role === "super_admin"
      ? [{ id: "admin", title: t("portal.settings.tabAdmin") }]
      : []),
  ];

  const held = await heldForTherapist(actor.userId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("portal.settings.title")} subtitle={actor.email} />

      <div className="space-y-8 px-4 pb-10 sm:px-6">
        <SettingsNav sections={sections} />

        {payouts === "refresh" ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            {t("portal.settings.stripeExpired")}
          </p>
        ) : null}

        <SettingsSection
          id="you"
          title={t("portal.settings.tabYou")}
          why={t("portal.settings.whyYou")}
        >
          {/*
            24.4 — the verification state belongs here, and it was on no screen
            a verified clinician ever visits again. "Am I approved?" is a
            question people ask support, and the answer was only ever on the
            onboarding page they are redirected away from once they pass.
          */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">{t("portal.settings.practice")}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {practice === "approved"
                ? t("portal.settings.practiceApproved")
                : practice === "submitted"
                  ? t("portal.settings.practiceSubmitted")
                  : practice === "rejected"
                    ? t("portal.settings.practiceRejected")
                    : t("portal.settings.practiceNone")}
            </p>
            {practice !== "approved" ? (
              <Link
                href="/onboarding"
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
              >
                {t("portal.settings.openVerification")}
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
            <p className="text-sm font-semibold text-slate-900">{t("portal.settings.qr")}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {t("portal.settings.qrBlurb")}
            </p>
            <Link
              href="/settings/codes"
              className="mt-3 inline-flex text-sm font-semibold text-brand-600"
            >
              {t("portal.settings.openCodes")}
            </Link>
          </Card>
        </SettingsSection>

        <SettingsSection
          id="paid"
          title={t("portal.settings.tabPaid")}
          why={t("portal.settings.whyPaid")}
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
          title={t("portal.settings.tabHours")}
          why={t("portal.settings.whyHours")}
        >
          <TimezoneSettings initial={user?.timezone ?? null} />
        </SettingsSection>

        <SettingsSection
          id="copilot"
          title={t("portal.settings.tabCopilot")}
          why={t("portal.settings.whyCopilot")}
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
          title={t("portal.settings.tabSecurity")}
          why={t("portal.settings.whySecurity")}
        >
          <PasswordForm />
        </SettingsSection>

        {actor.role === "super_admin" ? (
          <SettingsSection
            id="admin"
            title={t("portal.settings.tabAdmin")}
            why={t("portal.settings.whyAdmin")}
          >
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-900">{t("portal.settings.admin")}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {t("portal.settings.adminBlurb")}
              </p>
              <Link
                href="/admin"
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white"
              >
                {t("portal.settings.openAdmin")}
              </Link>
            </Card>
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}
