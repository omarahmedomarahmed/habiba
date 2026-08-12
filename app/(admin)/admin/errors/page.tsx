import type { Metadata } from "next";

import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { ERROR_RETENTION_DAYS, recentErrors } from "@/lib/observability/errors";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Errors", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What is broken, and how long it has been broken.
 *
 * Until this page there was nowhere at all to answer that. A patient in crisis
 * hitting a 500 on the join page produced a stack trace in a serverless log
 * that expires, that nobody subscribes to, and that nobody would think to read
 * unless they already knew something was wrong.
 *
 * Grouped by fingerprint rather than listed flat, because a broken route
 * throws once per request and an ungrouped list of four thousand identical
 * entries is the same as no list.
 */
export default async function AdminErrorsPage() {
  await requireRole("super_admin");
  const rows = await recentErrors(200);

  const groups = new Map<string, { rows: typeof rows; first: Date; last: Date }>();
  for (const row of rows) {
    const existing = groups.get(row.fingerprint);
    if (existing) {
      existing.rows.push(row);
      if (row.createdAt < existing.first) existing.first = row.createdAt;
      if (row.createdAt > existing.last) existing.last = row.createdAt;
    } else {
      groups.set(row.fingerprint, { rows: [row], first: row.createdAt, last: row.createdAt });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Errors</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Server errors from the last {ERROR_RETENTION_DAYS} days, newest first. Paths have their
          identifiers removed and messages have addresses stripped — this is a debugging tool and
          must not become another way to read a chart. Repeats within ten minutes are recorded once.
        </p>
      </div>

      {groups.size === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-slate-900">Nothing has thrown</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Either the product is behaving or nothing is using it. Both are worth knowing, and
            before this page there was no way to tell them apart.
          </p>
        </Card>
      ) : null}

      {[...groups.entries()].map(([fingerprint, group]) => {
        const latest = group.rows[0]!;
        return (
          <Card key={fingerprint} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={group.rows.length > 5 ? "red" : "amber"}>
                {group.rows.length} {group.rows.length === 1 ? "time" : "times"}
              </Badge>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                {latest.method ?? "—"} {latest.route}
              </code>
              <span className="text-xs text-slate-400">
                last {formatDateTime(group.last)}
                {group.rows.length > 1 ? ` · first ${formatDateTime(group.first)}` : ""}
              </span>
            </div>

            <p className="mt-2 text-sm font-medium break-words text-slate-900">{latest.message}</p>

            {latest.digest ? (
              <p className="mt-1 text-xs text-slate-400">
                Digest <code className="font-mono">{latest.digest}</code> — this is the code a
                clinician sees on the error page, so a support message quoting it lands here.
              </p>
            ) : null}

            {latest.stack ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900">
                  Stack
                </summary>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">
                  {latest.stack}
                </pre>
              </details>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
