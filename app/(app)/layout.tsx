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
  Users,
} from "lucide-react";

import { BottomNav } from "@/components/nav/bottom-nav";
import { RadarPresence } from "@/components/radar/presence";
import { requireUser } from "@/lib/auth/guard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRadarProfile } from "@/lib/data/radar";
import { getVerification, isCleared } from "@/lib/data/verification";
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
const OPEN_TO_UNVERIFIED = ["/onboarding", "/settings", "/billing"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireUser();
  const [radar, [me], verification] = await Promise.all([
    getRadarProfile(actor.userId),
    db.select({ profile: users.profile }).from(users).where(eq(users.id, actor.userId)).limit(1),
    getVerification(actor.userId),
  ]);

  /*
   * Send an unverified clinician to onboarding rather than letting them find a
   * dead end. `x-pathname` is set by middleware; if it is somehow missing the
   * page still renders and the per-action guard still refuses, so this failing
   * open costs nothing.
   */
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (
    !isCleared(actor, verification?.state ?? null) &&
    pathname &&
    !OPEN_TO_UNVERIFIED.some((prefix) => pathname.startsWith(prefix))
  ) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Desktop is the enhancement: a sidebar appears only at lg and above. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard" className="text-[15px] font-bold tracking-tight text-navy-500">
            24Therapy
          </Link>
        </div>

        <Link
          href="/sessions/new"
          className="mx-4 mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New session
        </Link>

        <nav aria-label="Primary" className="flex-1 space-y-0.5 px-3">
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
          <SidebarLink href="/on-call" icon={Radio}>
            Crisis Radar
          </SidebarLink>
          <SidebarLink href="/billing" icon={CreditCard}>
            Billing &amp; earnings
          </SidebarLink>
          <SidebarLink href="/settings" icon={Settings}>
            Settings
          </SidebarLink>
        </nav>

        <div className="border-t border-slate-100 px-4 py-3">
          <Link href="/settings" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-500 text-xs font-semibold text-white">
              {initials(actor.firstName, actor.lastName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-800">
                {actor.firstName} {actor.lastName}
              </span>
              <span className="block truncate text-xs text-slate-400">{actor.email}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Content gets bottom padding on mobile so the nav never covers a control. */}
        <div className="pb-24 lg:pb-8">{children}</div>
      </div>

      <BottomNav />

      {/* Presence and the booking alarm follow the clinician around the whole
          portal, not just the radar page — see the comment in the component. */}
      <RadarPresence
        initialStatus={radar?.status ?? "offline"}
        // Both default on: a clinician who has never touched the setting should
        // hear that someone needs them.
        alertOnView={me?.profile?.alertOnView ?? true}
        alertOnBooking={me?.profile?.alertOnBooking ?? true}
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
