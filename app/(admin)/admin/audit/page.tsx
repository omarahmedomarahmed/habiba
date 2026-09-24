import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { listAuditLog } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };
export const dynamic = "force-dynamic";

const CATEGORIES = ["phi_access", "auth", "admin", "billing", "break_glass"] as const;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const actor = await requireRole("super_admin");
  const { category } = await searchParams;
  const entries = await listAuditLog({ category, limit: 200 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Append-only. Patients appear as references, never names.
        </p>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <FilterChip href="/admin/audit" active={!category}>
          All
        </FilterChip>
        {CATEGORIES.map((value) => (
          <FilterChip
            key={value}
            href={`/admin/audit?category=${value}`}
            active={category === value}
          >
            {value.replace("_", " ")}
          </FilterChip>
        ))}
      </div>

      <Card className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="font-mono text-xs text-slate-500">
              {formatDateTime(entry.createdAt, actor.timezone, "en")}
            </span>
            <Badge tone={entry.category === "phi_access" ? "brand" : "slate"}>
              {entry.category.replace("_", " ")}
            </Badge>
            <span className="text-sm font-medium text-slate-900">{entry.action}</span>
            {/*
              🔴 0086 — four principals can write here, so four possible actors.
              The label says WHICH, because "ahmed@acme.com" means nothing on
              its own: our operator, their HR admin and their practice manager
              have entirely different authority, and an audit screen that
              flattens them answers the wrong question.

              "system" only when every actor column is null, which is a job or a
              cron rather than a person.
            */}
            <span className="text-xs text-slate-500">
              {entry.actorEmail ??
                (entry.sponsorActorEmail
                  ? `sponsor · ${entry.sponsorActorEmail}`
                  : entry.clinicActorEmail
                    ? `practice · ${entry.clinicActorEmail}`
                    : "system")}
            </span>
            {entry.organizationName ? (
              <span className="text-xs text-slate-500">{entry.organizationName}</span>
            ) : null}
            {entry.patientId ? (
              <span className="font-mono text-xs text-slate-500">
                patient {entry.patientId.slice(0, 8)}…
              </span>
            ) : null}
          </div>
        ))}
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nothing logged yet.</p>
        ) : null}
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "tap-target flex shrink-0 items-center rounded-full bg-navy-500 px-3.5 text-sm font-medium text-white"
          : "tap-target flex shrink-0 items-center rounded-full bg-white px-3.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
      }
    >
      {children}
    </Link>
  );
}
