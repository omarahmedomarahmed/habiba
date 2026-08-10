import type { Metadata } from "next";

import { RadarCommand } from "@/components/admin/radar-command";
import { ReportQueue } from "@/components/admin/report-queue";
import { requireRole } from "@/lib/auth/guard";
import { openReports, radarCommandView } from "@/lib/data/radar-admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Radar control", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The room where you watch the radar.
 *
 * Same globe patients see, with everything they are not shown: suspensions,
 * demonstration fixtures, lapsed heartbeats, money, conduct. Nothing clinical
 * — no transcript, no note, no risk flag reaches this page. The only route to
 * a transcript in the entire admin console is through a report somebody filed,
 * and it writes an audit row on the way.
 */
export default async function AdminRadarPage({
  searchParams,
}: {
  searchParams: Promise<{ reports?: string }>;
}) {
  await requireRole("super_admin");
  const { reports } = await searchParams;

  const bucket =
    reports === "actioned" || reports === "dismissed"
      ? (reports as "actioned" | "dismissed")
      : "open";

  const [view, queue] = await Promise.all([radarCommandView(), openReports(bucket)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Radar control</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Every clinician on the board, live, everywhere. Availability, geography, ratings and our
          cut — and nothing anyone said in a session.
        </p>
      </div>

      <RadarCommand initial={view} />

      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Reports
          {view.totals.openReports > 0 ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {view.totals.openReports} open
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          What patients told us went wrong. A no-show has already been refunded and the clinician
          suspended automatically; everything else is waiting for you.
        </p>

        <nav className="mt-3 flex gap-1">
          {(["open", "actioned", "dismissed"] as const).map((tab) => (
            <a
              key={tab}
              href={`/admin/radar?reports=${tab}`}
              className={
                bucket === tab
                  ? "rounded-xl bg-navy-500 px-3.5 py-2 text-sm font-medium text-white capitalize"
                  : "rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 capitalize hover:bg-slate-100"
              }
            >
              {tab}
            </a>
          ))}
        </nav>

        <div className="mt-3">
          <ReportQueue
            rows={queue.map((row) => ({
              id: row.id,
              kind: row.kind,
              detail: row.detail,
              patientEmail: row.patientEmail,
              status: row.status,
              resolution: row.resolution,
              filedAt: formatDate(row.createdAt),
              therapistId: row.therapistId,
              therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
              therapistEmail: row.therapistEmail,
              sessionId: row.sessionId,
              sessionDate: row.sessionEndedAt ? formatDate(row.sessionEndedAt) : null,
              durationMinutes: row.sessionDuration,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
