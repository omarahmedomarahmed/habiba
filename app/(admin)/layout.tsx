import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  FileEdit,
  Languages,
  LifeBuoy,
  PhoneCall,
  Globe2,
  HeartPulse,
  Hospital,
  PauseCircle,
  Plug,
  LayoutDashboard,
  Radio,
  Star,
  Megaphone,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Vault,
  Gauge,
  TriangleAlert,
  LineChart,
  Wallet,
} from "lucide-react";

import { requireStaff } from "@/lib/auth/guard";
import { getI18n } from "@/lib/i18n/server";
import { openChanges } from "@/lib/data/phone-change";
import { ticketCounts } from "@/lib/data/support";
import { countOpenReports } from "@/lib/data/radar-admin";
import { pendingReviewCount } from "@/lib/data/verification";
import { waitingCount } from "@/lib/billing/manual";
import { LanguageCorner } from "@/components/i18n/language-corner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /*
   * 20.8 — the shell admits the back office; each page still decides for itself.
   *
   * Staff work the queues, managers also see how the queues are doing, and
   * super_admins additionally hold the settings that price the product. This
   * is defence in depth rather than the only check: every page below calls its
   * own guard, and the nav is filtered by role so nobody is shown a door that
   * will bounce them.
   */
  const actor = await requireStaff();
  /*
   * 🔴 ONE keyed label in a nav of fifteen literals, and that is deliberate.
   *
   * The console's other labels predate sprint 45 and the ratchet counts 294 of
   * them. This one is new, and the rule from 45 on is that a new string is a
   * MessageKey. So the ratchet does not rise on this sprint's account, and the
   * inconsistency is the debt becoming visible rather than a new one.
   */
  const { t } = await getI18n();
  const isManager = actor.role === "manager" || actor.role === "super_admin";
  const isOwner = actor.role === "super_admin";

  const [waiting, reports, tickets, changes, transfers] = await Promise.all([
    pendingReviewCount(),
    countOpenReports(),
    ticketCounts(),
    openChanges(200).then((rows) => rows.length),
    waitingCount(),
  ]);

  return (
    <div className="min-h-dvh">
      {/* 🔴 75.3 — the language switch, in the same corner of every screen. */}
      <LanguageCorner />
      <header className="border-b border-slate-200 bg-navy-500">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/admin" className="text-[15px] font-bold tracking-tight text-white">
            24Therapy <span className="font-normal text-white/50">admin</span>
          </Link>
          <Link href="/dashboard" className="text-xs font-medium text-white/70 hover:text-white">
            Back to portal
          </Link>
        </div>

        {/*
          🔴 37R.25 / C188 — sixteen destinations, and five of them were off
          the screen on a laptop.

          The row was `max-w-5xl` with `overflow-x-auto` and `no-scrollbar`, so
          at 1440px it clipped mid-word after "Radar lists" and showed nothing
          to say there was more: Announce, Site content, Settings, Strings and
          the Audit log simply did not appear, and nothing in the console links
          to them from anywhere else. It wraps now — a console is a tool, and a
          tool that hides a third of itself to stay on one line is the wrong
          trade. The horizontal scroll stays for phones, where wrapping sixteen
          items would push the page down instead.
        */}
        <nav aria-label="Admin" className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5 lg:flex-wrap lg:overflow-x-visible">
          <AdminLink href="/admin" icon={LayoutDashboard}>Overview</AdminLink>

          {/* 🔴 20.18 / 20.24 — two support queues, never one list. */}
          <AdminLink href="/admin/support" icon={LifeBuoy}>
            Support
            {tickets.open + tickets.waiting > 0 ? (
              <span className="ms-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-navy-600">
                {tickets.open + tickets.waiting}
              </span>
            ) : null}
          </AdminLink>

          <AdminLink href="/admin/numbers" icon={PhoneCall}>
            Numbers
            {changes > 0 ? (
              <span className="ms-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-navy-600">
                {changes}
              </span>
            ) : null}
          </AdminLink>

          {isOwner ? (
            <AdminLink href="/admin/therapists" icon={Users}>Clinicians</AdminLink>
          ) : null}
          <AdminLink href="/admin/verifications" icon={ShieldCheck}>
            Verifications
            {waiting > 0 ? (
              <span className="ms-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-navy-600">
                {waiting}
              </span>
            ) : null}
          </AdminLink>
          <AdminLink href="/admin/radar" icon={Radio}>
            Radar control
            {reports > 0 ? (
              <span className="ms-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {reports}
              </span>
            ) : null}
          </AdminLink>
          <AdminLink href="/admin/payouts" icon={Banknote}>Payouts</AdminLink>
          {/*
            🔴 73.2 — THE BADGE IS NOT DECORATION. Every number in it is a person
            on a spinner, and several of them are waiting to join a therapy
            session. Red rather than the muted style the other counts use,
            because this queue is worked by the minute and the others are not.
          */}
          <AdminLink href="/admin/transfers" icon={ArrowLeftRight}>
            Transfers
            {transfers > 0 ? (
              <span className="ms-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {transfers}
              </span>
            ) : null}
          </AdminLink>

          {/*
            20.8 — the money, the lists and the settings are the owner's, and
            the performance overview is a manager's. A staff member is not
            shown a link that would bounce them: a door that opens for nobody
            is a door people keep trying.
          */}
          {isManager ? <AdminLink href="/admin/ratings" icon={Star}>Ratings</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/vault" icon={Vault}>Vault</AdminLink> : null}
          {/*
            53.6 — the owner's, like every other money door. Activating a sponsor
            opens a corporate account and opening a pot commits us to refund terms.
          */}
          {isOwner ? <AdminLink href="/admin/sponsors" icon={Building2}>{t("asponsor.nav")}</AdminLink> : null}
          {/*
            🔴 C247 — the pause is "a real and unfair outcome" and must be
            "reversible by us in one step". A door beside the sponsors one,
            because it is the same authority: lifting a pause restarts an
            employer's funding without the proof the cycle exists to collect.

            Separate from that screen on purpose. The sponsors page refuses to
            render who is enrolled; this is a short work queue ordered by who
            has waited longest, which is a different object.
          */}
          {isOwner ? <AdminLink href="/admin/benefits" icon={PauseCircle}>Paused benefits</AdminLink> : null}
          {/*
            54.3 — the owner's too. Activating a clinic opens an organisation that will
            hold clinical records, which is a strictly larger act than activating a
            sponsor: a sponsor's tenancy contains nothing and this one contains charts.
          */}
          {isOwner ? <AdminLink href="/admin/clinics" icon={Hospital}>{t("aclinic.nav")}</AdminLink> : null}
          {/*
            55.2 — the owner's. Activating a partner lets them hold a key, and an employment
            key is an identity oracle pointed at our own patients (C265). Nothing on that
            screen mints one: they do that in their own portal, where the scope is chosen by
            the person who will build against it.
          */}
          {isOwner ? <AdminLink href="/admin/partners" icon={Plug}>{t("apartner.nav")}</AdminLink> : null}
          {/*
            44.1 — the owner's. C97's ruling was to ship the cadence with an admin-controlled rate
            and MEASURE THE MUTE RATE, and this is where that number lives beside the threshold that
            halts the channel. Not a clinical screen: six counts and nobody's words.
          */}
          {isOwner ? <AdminLink href="/admin/checkins" icon={HeartPulse}>{t("acheckin.nav")}</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/taxonomy" icon={Globe2}>Radar lists</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/announce" icon={Megaphone}>Announce</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/content" icon={FileEdit}>Site content</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/settings" icon={SlidersHorizontal}>Settings</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/strings" icon={Languages}>Strings</AdminLink> : null}
          {isManager ? <AdminLink href="/admin/audit" icon={ScrollText}>Audit log</AdminLink> : null}
          {/*
            🔴 58.3 — two pages that existed, worked, and were reachable only by
            typing the URL. `verify:reachable` found both on its first run.

            `/admin/usage` carries the figure its own header calls "the figure
            that decides the business", cost per session. `/admin/errors` exists
            because, in its own words, "until this page there was nowhere at all
            to answer" what is broken and for how long. A page nobody can reach
            is not a half-built feature, it is a built one nobody is using.
          */}
          {isManager ? <AdminLink href="/admin/usage" icon={Gauge}>Usage and cost</AdminLink> : null}
          {isManager ? <AdminLink href="/admin/errors" icon={TriangleAlert}>Errors</AdminLink> : null}
          {/*
            🔴 Sprint 71. Linked, because a page reachable only by typing its
            URL is the defect `verify:reachable` exists to catch, and this one
            is the reason the simulation measures what it measures.
          */}
          {/*
            🔴 76.53 — `isOwner`, NOT `isManager`, and the line above used to
            be the second kind.

            Both pages call `requireRole("super_admin")`, which REDIRECTS. So a
            manager was shown a link that bounced them to the dashboard with no
            explanation, which reads as the product being broken rather than as
            a door that is not theirs. `verify:reachable` catches a page nothing
            links to; nothing catches a link nobody who can see it may follow.

            The company's own result and the company's own payroll are a board
            pack. The 24/7 team works queues.
          */}
          {isOwner ? (
            <AdminLink href="/admin/financial-model" icon={LineChart}>Financial model</AdminLink>
          ) : null}
          {isOwner ? (
            <AdminLink href="/admin/actuals" icon={Wallet}>Actuals</AdminLink>
          ) : null}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

function AdminLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="tap-target flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}
