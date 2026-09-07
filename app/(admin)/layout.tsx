import Link from "next/link";
import {
  Banknote,
  FileEdit,
  Languages,
  LifeBuoy,
  PhoneCall,
  Globe2,
  LayoutDashboard,
  Radio,
  Star,
  Megaphone,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Vault,
} from "lucide-react";

import { requireStaff } from "@/lib/auth/guard";
import { openChanges } from "@/lib/data/phone-change";
import { ticketCounts } from "@/lib/data/support";
import { countOpenReports } from "@/lib/data/radar-admin";
import { pendingReviewCount } from "@/lib/data/verification";

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
  const isManager = actor.role === "manager" || actor.role === "super_admin";
  const isOwner = actor.role === "super_admin";

  const [waiting, reports, tickets, changes] = await Promise.all([
    pendingReviewCount(),
    countOpenReports(),
    ticketCounts(),
    openChanges(200).then((rows) => rows.length),
  ]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-navy-500">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/admin" className="text-[15px] font-bold tracking-tight text-white">
            24Therapy <span className="font-normal text-white/50">admin</span>
          </Link>
          <Link href="/dashboard" className="text-xs font-medium text-white/70 hover:text-white">
            Back to portal
          </Link>
        </div>

        <nav aria-label="Admin" className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
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
            20.8 — the money, the lists and the settings are the owner's, and
            the performance overview is a manager's. A staff member is not
            shown a link that would bounce them: a door that opens for nobody
            is a door people keep trying.
          */}
          {isManager ? <AdminLink href="/admin/ratings" icon={Star}>Ratings</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/vault" icon={Vault}>Vault</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/taxonomy" icon={Globe2}>Radar lists</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/announce" icon={Megaphone}>Announce</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/content" icon={FileEdit}>Site content</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/settings" icon={SlidersHorizontal}>Settings</AdminLink> : null}
          {isOwner ? <AdminLink href="/admin/strings" icon={Languages}>Strings</AdminLink> : null}
          {isManager ? <AdminLink href="/admin/audit" icon={ScrollText}>Audit log</AdminLink> : null}
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
