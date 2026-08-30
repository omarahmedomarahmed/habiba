import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  MessageSquare,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Users, Wallet, LogOut } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { BottomNav } from "@/components/nav/bottom-nav";
import { RadarPresence } from "@/components/radar/presence";
import { requireUser } from "@/lib/auth/guard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRadarProfile } from "@/lib/data/radar";
import { isCleared, practiceState } from "@/lib/data/verification";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { initials } from "@/lib/utils";

/**
 * The portal shell.
 *
 * `requireUser()` here is a convenience, not the security boundary — nested
 * pages call it (or `requireRole`) themselves. A layout is not guaranteed to
 * re-run for every nested render, so treating it as the only gate is a mistake
 * that is very hard to see in review.
 */
/**
 * Pages an unverified clinician may still reach.
 *
 * Deliberately short. Settings and billing are here because Stripe onboarding
 * and reading the terms are things you should be able to do while waiting for
 * approval; everything else needs a patient, and they do not have one yet.
 */
const OPEN_TO_UNVERIFIED = ["/onboarding", "/settings", "/billing", "/earnings"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireUser();
  const [radar, [me], state] = await Promise.all([
    getRadarProfile(actor.userId),
    db.select({ profile: users.profile }).from(users).where(eq(users.id, actor.userId)).limit(1),
    practiceState(actor.userId),
  ]);

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
    <div className="min-h-dvh bg-slate-50">
      {/* Desktop is the enhancement: a sidebar appears only at lg and above. */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard" className="text-[15px] font-bold tracking-tight text-navy-500">
            24Therapy
          </Link>
        </div>

        {cleared ? (
          <Link
            href="/sessions/new"
            className="mx-4 mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New session
          </Link>
        ) : null}

        <nav aria-label="Primary" className="flex-1 space-y-0.5 px-3">
          {/*
            Nothing gated is linked until they are cleared.

            Not decoration: a link into a gated page is a *client-side*
            navigation, and the shell's redirect for those renders a blank
            document rather than the onboarding page. Removing the links
            removes the only way an unverified clinician could trigger it.
          */}
          {!cleared ? (
            <SidebarLink href="/onboarding" icon={ShieldCheck}>
              Finish verification
            </SidebarLink>
          ) : null}
          {cleared ? (
          <>
          <SidebarLink href="/dashboard" icon={Home}>
            Home
          </SidebarLink>
          <SidebarLink href="/sessions" icon={CalendarDays}>
            Sessions
          </SidebarLink>
          <SidebarLink href="/patients" icon={Users}>
            Patients
          </SidebarLink>
          <SidebarLink href="/notes" icon={FileText}>
            Notes
          </SidebarLink>
          <SidebarLink href="/copilot" icon={MessageSquare}>
            Copilot
          </SidebarLink>
          {/*
            When a clinician is live, the radar stops being one nav item among
            eight. It is the only thing on this screen that a stranger in crisis
            is currently depending on, so it says so.
          */}
          <SidebarLink href="/on-call" icon={Radio}>
            <span className="flex items-center gap-2">
              Crisis Radar
              {radar?.status === "online" || radar?.status === "in_session" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-teal-700 uppercase">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-500" />
                  {radar.status === "in_session" ? "In session" : "Live"}
                </span>
              ) : null}
            </span>
          </SidebarLink>
          </>
          ) : null}
          <SidebarLink href="/earnings" icon={Wallet}>
            Earnings
          </SidebarLink>
          <SidebarLink href="/billing" icon={CreditCard}>
            Billing
          </SidebarLink>
          <SidebarLink href="/settings" icon={Settings}>
            Settings
          </SidebarLink>
        </nav>

        {/*
          Sign out lives here, next to who you are signed in as.

          It used to be a button halfway down the Settings page, which is not
          where anybody looks for it — every other product on a clinician's
          screen puts it against their own name, and a person who wants to leave
          a screen with patient data on it should not have to hunt.
        */}
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
          <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-500 text-xs font-semibold text-white">
              {initials(actor.firstName, actor.lastName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-800">
                {actor.firstName} {actor.lastName}
              </span>
              <span className="block truncate text-xs text-slate-400">{actor.email}</span>
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:ps-60">
        {/* Content gets bottom padding on mobile so the nav never covers a control. */}
        <div className="pb-24 lg:pb-8">{children}</div>
      </div>

      <BottomNav cleared={cleared} />

      {/* Presence and the booking alarm follow the clinician around the whole
          portal, not just the radar page — see the comment in the component. */}
      <RadarPresence
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
      />
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Home;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}
