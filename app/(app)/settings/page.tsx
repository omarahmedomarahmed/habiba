import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";

import { PayoutSettings } from "@/components/settings/payouts";
import { SettingsNav, SettingsSection } from "@/components/settings/section";
import { PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { TimezoneSettings } from "@/components/settings/timezone-settings";
import { NoteFormatSettings } from "@/components/settings/note-format-settings";
import { formatsFor } from "@/lib/data/note-formats";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { accountBalance, getConnectAccount, refreshAccountStatus } from "@/lib/billing/connect";
import { heldForTherapist } from "@/lib/billing/ledger";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { AssistantPrefsSettings } from "@/components/assistant/prefs-settings";
import { assistantPrefs } from "@/lib/ai/assistant";
import { getVerification, practiceState } from "@/lib/data/verification";
import { licenceLocked } from "@/lib/data/licence-change";
import { invoices, organizations, users } from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";
import { saveMyLanguage } from "./actions";
import { LanguageSetting } from "@/components/settings/language-setting";
import { savedLocale } from "@/lib/i18n/preference";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/settings/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.settings"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payouts?: string; lang?: string }>;
}) {
  const { t } = await getI18n();
  const actor = await requireUser();
  const { payouts, lang } = await searchParams;

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

  /* 🔴 W1-23: licence fields are read-only once verification is submitted. */
  const locked = licenceLocked(await getVerification(actor.userId));

  /*
   * 🔴 74.6 — the practice's own row: what kind it is, and where it bills from.
   * `practiceState` above is a verification state and not this; the names are
   * close and the two answer entirely different questions.
   */
  const [ownPractice] = await db
    .select({ kind: organizations.kind, region: organizations.region })
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId))
    .limit(1);

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
  const noteFormats = await formatsFor(actor.organizationId, actor.userId);

  /*
   * 🔴 76.34 — how they would like to be paid, for the manual rail's half of
   * this card. It lived only on `/earnings`, inside a component that renders
   * once there is money held, so nobody could answer the question before the
   * moment they wanted the money.
   */
  const { defaultMethodFor } = await import("@/lib/billing/payouts");
  const payoutMethod = await defaultMethodFor(actor.userId);

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
          {/* 🔴 0169 / ruling 8: the language they work in, and every message we send them. */}
          <LanguageSetting
            action={saveMyLanguage}
            saved={await savedLocale({ userId: actor.userId })}
            justSaved={lang === "saved"}
          />
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
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600"
              >
                {t("portal.settings.openVerification")}
              </Link>
            ) : null}
          </Card>

          <ProfileForm
            licenceLocked={locked}
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
            {/* 🔴 W2-T07: the page the code opens, which nothing linked. */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/settings/codes" className="text-sm font-semibold text-brand-700">
                {t("portal.settings.openCodes")}
              </Link>
              <Link href={`/t/${actor.userId}`} className="text-sm font-semibold text-brand-700">
                {t("tw2.publicPage")}
              </Link>
            </div>
          </Card>

          {/*
            🔴 41.3 — meeting accounts, beside the rest of "you".

            Not a top-level nav item: connecting Zoom is a once-ever act, and a
            permanent place in the sidebar for something done once is how a
            product teaches people to stop reading it.
          */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">{t("portal.meet.title")}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {t("portal.meet.body")}
            </p>
            {/* 🔴 W2-T07: the record system page existed and nothing linked it. */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/settings/integrations" className="text-sm font-semibold text-brand-700">
                {t("portal.meet.title")}
              </Link>
              <Link href="/settings/records" className="text-sm font-semibold text-brand-700">
                {t("records.title")}
              </Link>
            </div>
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
              /* 0149 — the figure they typed, in the currency they typed it in. */
              sessionRateCents:
                connect.rateCurrency.toLowerCase() === "egp" && connect.rateEgpMinor !== null
                  ? connect.rateEgpMinor
                  : connect.sessionRateCents,
              rateCurrency: connect.rateCurrency,
              /*
               * 🔴 74.6 — null for a clinician on a clinic's roster, which hides
               * the control rather than disabling it. A disabled select invites
               * somebody to ask why; an absent one is answered by the clinic.
               */
              practiceRegion: ownPractice?.kind === "solo" ? ownPractice.region : null,
              autoSettleFromEarnings: connect.autoSettleFromEarnings,
              availableCents: balance?.availableCents ?? null,
              pendingCents: balance?.pendingCents ?? null,
              outstandingCents: outstanding?.cents ?? 0,
              feeBps: settings.session.platformFeeBps,
              heldCents: held,
              /*
               * 🔴 76.34 — who this is, beside the country that decides
               * everything else on the card. Read-only here; the profile form
               * above owns both.
               */
              name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || actor.email,
              license:
                [user?.profile?.licenseType, user?.profile?.licenseNumber]
                  .filter(Boolean)
                  .join(" ") || null,
              payoutMethod: payoutMethod
                ? {
                    method: payoutMethod.method,
                    identifier: payoutMethod.identifier,
                    accountName: payoutMethod.accountName,
                  }
                : null,
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

          {/* 🔴 W2-F01 / D7: the format every note is drafted in, and their own. */}
          <NoteFormatSettings
            current={noteFormats.defaultFormat.key}
            formats={noteFormats.formats.map((f) => ({
              key: f.key,
              label: f.label,
              labelKey: f.labelKey ?? null,
            }))}
            templates={noteFormats.templates.map((row) => ({ id: row.id, label: row.label }))}
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
