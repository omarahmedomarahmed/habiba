import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Bell, LogOut, Building2, Plus } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { switchToClinic } from "@/app/(app)/switch-principal/actions";
import { BottomNav } from "@/components/nav/bottom-nav";
import { SectionTabs } from "@/components/nav/section-tabs";
import { SidebarLink } from "@/components/nav/sidebar-link";
import { destinationsFor, OPEN_TO_UNVERIFIED } from "@/lib/nav/clinician";
import { RadarPresence } from "@/components/radar/presence";
import { requireUser } from "@/lib/auth/guard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRadarProfile } from "@/lib/data/radar";
import { isCleared, practiceState } from "@/lib/data/verification";
import { licenceNotice } from "@/lib/data/licence-expiry";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { clinicManagers, users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { initials } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { localeTag } from "@/lib/i18n/config";
import { pendingPaymentFor } from "@/lib/billing/pending";
import { PendingBar } from "@/components/billing/pending-bar";
import { LanguageCorner } from "@/components/i18n/language-corner";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/layout.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * The portal shell.
 *
 * `requireUser()` here is a convenience, not the security boundary — nested
 * pages call it (or `requireRole`) themselves. A layout is not guaranteed to
 * re-run for every nested render, so treating it as the only gate is a mistake
 * that is very hard to see in review.
 */
/* Pages an unverified clinician may still reach: `lib/nav/clinician.ts` (W2-T01). */

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale } = await getI18n();
  const actor = await requireUser();
  /*
   * 🔴 W1-02: the organisation's bill in flight is the account holder's. A
   * clinic seat clinician's organisation is the clinic, whose bill they do not run.
   */
  const { orgKindOf } = await import("@/lib/data/org-kind");
  const { mayRunOrgAccount } = await import("@/lib/auth/org-authority");
  const pending = mayRunOrgAccount(await orgKindOf(actor.organizationId))
    ? await pendingPaymentFor(
        { kind: "organization", organizationId: actor.organizationId },
        t,
        localeTag(locale),
      )
    : null;

  const [radar, [me], state, licence] = await Promise.all([
    getRadarProfile(actor.userId),
    db
      .select({
        profile: users.profile,
        sessionRateCents: users.sessionRateCents,
        chargesEnabled: users.chargesEnabled,
      })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1),
    practiceState(actor.userId),
    /* 🔴 W1-16: an expired or expiring licence, said on every screen. */
    licenceNotice(actor.userId, actor.organizationId),
  ]);

  /*
   * 🔴 63.2 / C352 — does this human also run a practice here?
   *
   * One query against the link column, and null for almost everybody. It is here
   * rather than in the clinic module because a layout cannot import from
   * `lib/data/clinic-team.ts` without pulling the permission writer into every
   * clinician page render.
   */
  const [linked] = await db
    .select({ id: clinicManagers.id })
    .from(clinicManagers)
    .where(and(eq(clinicManagers.linkedUserId, actor.userId), isNull(clinicManagers.deletedAt)))
    .limit(1);
  const clinicManagerId = linked?.id ?? null;

  const cleared = isCleared(actor, state);

  /*
   * Send an unverified clinician to onboarding rather than letting them find a
   * dead end. `x-pathname` is set by middleware; if it is somehow missing the
   * page still renders and the per-action guard still refuses, so this failing
   * open costs nothing.
   */
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!cleared && pathname && !OPEN_TO_UNVERIFIED.some((prefix) => pathname.startsWith(prefix))) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-dvh bg-navy-50">
      {/*
        🔴 75.3 — the language switch, in the same corner of every screen, and
        the bell for every notice we write them beside it (W2-T06).
      */}
      <LanguageCorner
        beside={
          <Link
            href="/notifications"
            aria-label={t("tw2.notifications")}
            title={t("tw2.notifications")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-navy-600 shadow-sm ring-1 ring-navy-100 backdrop-blur hover:bg-white"
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        }
      />
      {/* Desktop is the enhancement: a sidebar appears only at lg and above. */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col overflow-hidden bg-navy-900 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
        />
        <div className="relative px-6 pt-6 pb-5">
          {/* The mark, not the name set as text. See components/brand/logo.tsx. */}
          <Link href="/dashboard" className="inline-flex items-center">
            <Logo ink="white" height={28} />
          </Link>
        </div>

        {cleared ? (
          <Link
            href="/sessions/new"
            className="relative mx-4 mb-5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 text-[14px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            <Plus className="h-4 w-4 text-brand-300" aria-hidden />
            {t("portal.nav.newSession")}
          </Link>
        ) : null}

        <nav aria-label={t("portal.nav.primary")} className="relative flex-1 space-y-1 overflow-y-auto px-4">
          {/*
            Nothing gated is linked until they are cleared.

            Not decoration: a link into a gated page is a *client-side*
            navigation, and the shell's redirect for those renders a blank
            document rather than the onboarding page. Removing the links
            removes the only way an unverified clinician could trigger it.

            🔴 W2-T07: the list is `destinationsFor`, the same one the phone bar
            renders, so the two screens can no longer disagree about where a
            clinician can go.
          */}
          {destinationsFor(cleared).map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              cleared={cleared}
              icon={<item.icon className="h-[18px] w-[18px]" aria-hidden />}
            >
              {/*
                When a clinician is live, the radar stops being one nav item
                among eight. It is the only thing on this screen that a stranger
                in crisis is currently depending on, so it says so.
              */}
              {item.href === "/on-call" &&
              (radar?.status === "online" || radar?.status === "in_session") ? (
                <span className="flex items-center gap-2">
                  {t(item.label)}
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-800 uppercase">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
                    {radar.status === "in_session"
                      ? t("portal.nav.radarInSession")
                      : t("portal.nav.radarLive")}
                  </span>
                </span>
              ) : (
                t(item.label)
              )}
            </SidebarLink>
          ))}
        </nav>

        {/*
          Sign out lives here, next to who you are signed in as.

          It used to be a button halfway down the Settings page, which is not
          where anybody looks for it — every other product on a clinician's
          screen puts it against their own name, and a person who wants to leave
          a screen with patient data on it should not have to hunt.
        */}
        <div className="relative m-4 flex items-center gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-navy-700">
              {initials(actor.firstName, actor.lastName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-white">
                {actor.firstName} {actor.lastName}
              </span>
              <span className="block truncate text-xs text-white/70">{actor.email}</span>
            </span>
          </Link>
          {/*
            🔴 63.2 / C352 — THE SWITCHER, and only for a human who has both.

            A therapist who upgraded is a clinician AND the practice's admin. The
            two principals have separate cookies, so both could be live at once
            unless something ends one: pressing this revokes every session of the
            one being left before minting the other, audited, in that order.
          */}
          {clinicManagerId ? (
            <form action={switchToClinic}>
              <button
                type="submit"
                title={t("portal.nav.switchToClinic")}
                aria-label={t("portal.nav.switchToClinic")}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Building2 className="h-4 w-4" aria-hidden />
              </button>
            </form>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              title={t("portal.nav.signOut")}
              aria-label={t("portal.nav.signOut")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:ps-64">
        {/*
          The top bar: the mark on a phone, and the pages of this group as a row
          of tabs (ruling 14b). Its end is left clear for the language corner
          and the bell, which are fixed there on every screen.
        */}
        <header className="sticky top-0 z-20 flex min-h-16 flex-col justify-center border-b border-navy-100 bg-white/85 backdrop-blur-xl lg:pe-[240px]">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:hidden">
            <Link href="/dashboard" className="inline-flex items-center">
              <Logo ink="navy" height={24} />
            </Link>
          </div>
          {/* 🔴 Ruling 14b: the pages inside this group, one tap away. */}
          <SectionTabs cleared={cleared} />
        </header>
        {/*
          🔴 76.4 — MONEY IN FLIGHT FOLLOWS THEM AROUND THE PORTAL.

          The Egyptian rail's middle state lasts hours and used to be visible on
          the one screen they paid on. A clinician who minimised the popup and
          went to look at their calendar had no way back to it and no way to
          tell whether anything was happening, so they assumed the subscription
          had failed and sent a second transfer nobody can reverse.
        */}
        {pending ? (
          <PendingBar
            what={pending.what}
            amount={pending.amount}
            href={pending.href}
            stage={pending.stage}
            paymentId={pending.paymentId}
            storageKey={pending.storageKey}
          />
        ) : null}
        {licence ? (
          <div
            role="status"
            className="mx-4 mt-4 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:mx-6"
          >
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900">
                {t(licence.kind === "expired" ? "tlic.expiredTitle" : "tlic.expiringTitle")}
              </p>
              <p className="mt-0.5 text-sm text-amber-900">
                {t(licence.kind === "expired" ? "tlic.expiredBody" : "tlic.expiringBody", {
                  date: licence.date,
                })}{" "}
                <Link href="/onboarding" className="font-semibold underline underline-offset-2">
                  {t("tlic.update")}
                </Link>
              </p>
            </div>
          </div>
        ) : null}
        {/* Content gets bottom padding on mobile so the nav never covers a control. */}
        <div className="pb-28 lg:pb-10">{children}</div>
      </div>

      {/* 🔴 W2-T07: the practice switch reaches the phone too. */}
      <BottomNav cleared={cleared} clinic={Boolean(clinicManagerId)} />

      {/* Presence and the booking alarm follow the clinician around the whole
          portal, not just the radar page — see the comment in the component. */}
      <RadarPresence
        zone={actor.timezone}
        initialStatus={radar?.status ?? "offline"}
        // Both default on: a clinician who has never touched the setting should
        // hear that someone needs them.
        alertOnView={me?.profile?.alertOnView ?? true}
        alertOnBooking={me?.profile?.alertOnBooking ?? true}
        /*
          Who gets asked to arm an alarm.
          -------------------------------
          A cleared clinician, and nobody else. An administrator never appears
          on the radar and nothing will ever ring for them, so prompting them
          for audio permission on login would be asking for a capability we
          have no intention of using — the fastest way to teach somebody to
          dismiss our prompts reflexively.
        */
        clinician={cleared && actor.role === "therapist"}
        /*
          The orb's static half. The live half is polled inside the component —
          see the prop's own comment for why there is not a second poller.
        */
        orb={{
          sessionRateCents: me?.sessionRateCents ?? 0,
          chargesEnabled: me?.chargesEnabled ?? false,
          acceptsWalkIns: radar?.acceptsWalkIns ?? false,
          practiceAddress: radar?.practiceAddress ?? null,
          practiceConfirmed: Boolean(radar?.practiceConfirmedAt),
        }}
      />
    </div>
  );
}
