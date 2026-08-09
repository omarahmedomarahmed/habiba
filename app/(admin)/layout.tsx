import Link from "next/link";
import { FileEdit, LayoutDashboard, Megaphone, ScrollText, Users, Vault } from "lucide-react";

import { requireRole } from "@/lib/auth/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every admin page also calls requireRole itself — this is defence in depth,
  // not the only check.
  await requireRole("super_admin");

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
          <AdminLink href="/admin/therapists" icon={Users}>Clinicians</AdminLink>
          <AdminLink href="/admin/vault" icon={Vault}>Vault</AdminLink>
          <AdminLink href="/admin/announce" icon={Megaphone}>Announce</AdminLink>
          <AdminLink href="/admin/content" icon={FileEdit}>Site content</AdminLink>
          <AdminLink href="/admin/audit" icon={ScrollText}>Audit log</AdminLink>
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
