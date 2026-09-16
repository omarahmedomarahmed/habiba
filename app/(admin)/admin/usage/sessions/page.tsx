import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { requireRole } from "@/lib/auth/guard";
import { formatMicrocents, sessionCosts } from "@/lib/data/usage";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Session costs", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 76.41 — EVERY SESSION, WHAT IT COST US, AND WHO RAN IT.
 *
 * ## Why a list and not another average
 *
 * `/admin/usage` upstairs already answers "what does a session cost" with one
 * number. That number is a mean, and a mean is the one statistic that cannot
 * show you the session that went wrong: a fifty-minute session transcribed end
 * to end, a note regenerated four times, a job that crashed and retried and
 * produced nothing. All three are invisible in an average and obvious in a list
 * sorted by cost.
 *
 * ## 🔴 THE HEADLINE IS THE SPREAD, NOT THE TOTAL
 *
 * The four figures at the top are the cheapest session, the median, the dearest
 * and the count. A business whose median session costs a few cents and whose
 * dearest costs a dollar has a pricing question about long sessions; one where
 * they are the same number has no question at all. A total would hide both.
 *
 * ## No patient, anywhere on this screen
 *
 * A session id, a clinician, a duration, a number of model calls and money.
 * This is a finance screen and naming the person in the room would add nothing
 * to the question it answers while turning it into a route into a record.
 */
export default async function SessionCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ therapist?: string }>;
}) {
  const actor = await requireRole("super_admin");

  const { therapist } = await searchParams;

  const rows = await sessionCosts(30, { therapistId: therapist || undefined });

  const withSpend = rows.filter((row) => row.costMicrocents > 0);
  const sorted = [...withSpend].map((row) => row.costMicrocents).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  const dearest = sorted.length ? sorted[sorted.length - 1]! : 0;
  const cheapest = sorted.length ? sorted[0]! : 0;

  /* The filter names itself off the rows it produced, so it needs no second query. */
  const selected = therapist ? rows[0]?.therapistName : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {/*
          🔴 ONE LINK, AND IT IS BOTH DOORS.

          Filtered, it clears the filter; unfiltered, it goes back to the sums
          this list is made of. A row of clinician chips here would repeat the
          per-clinician table one screen up, where each name is already a link
          into this one.
        */}
        <Link
          href={therapist ? "/admin/usage/sessions" : "/admin/usage"}
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {therapist ? "Everyone" : "Usage"}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Session costs</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Last 30 days.{" "}
          {selected ? `${selected} only.` : "Everyone."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="With spend" value={String(withSpend.length)} />
        <Stat label="Cheapest" value={formatMicrocents(cheapest)} />
        <Stat label="Median" value={formatMicrocents(median)} />
        <Stat label="Dearest" value={formatMicrocents(dearest)} tone="red" />
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Every session</p>
        <p className="mt-0.5 text-sm text-slate-500">
          Model spend only, not the room and not the rail.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-start text-xs text-slate-400">
                <Th>When</Th>
                <Th>Clinician</Th>
                <Th align="end">Minutes</Th>
                <Th align="end">Audio</Th>
                <Th align="end">Calls</Th>
                <Th align="end">Cost</Th>
                <Th align="end">Patient paid</Th>
                <Th align="end">Our fee</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                /*
                 * 🔴 UNDERWATER IS A REAL STATE AND IT IS MARKED.
                 *
                 * A session whose model spend exceeded our fee lost us money.
                 * It is the row this whole page exists to make findable, and
                 * the comparison is only meaningful where a fee was charged:
                 * a free session has no margin to be wrong about.
                 */
                const underwater =
                  row.feeCents > 0 && row.costMicrocents / 100_000 > row.feeCents / 100;
                return (
                  <tr key={row.sessionId} className="border-b border-slate-50">
                    <Td className="whitespace-nowrap text-slate-500">
                      {formatDateTime(row.createdAt, actor.timezone, "en")}
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900">{row.therapistName}</span>
                      <span className="block text-xs text-slate-400">
                        {row.modality === "video" ? "Video" : "In person"}
                        {row.status !== "completed" ? ` · ${row.status.replace("_", " ")}` : ""}
                      </span>
                    </Td>
                    <Td align="end">
                      {/*
                        🔴 FIFTY IS THE CAP, so a session that hit it is the one
                        worth looking at: it is the most expensive shape this
                        product can produce and the only one that tells us what
                        the ceiling actually costs.
                      */}
                      {row.durationMinutes === null ? (
                        <span className="text-slate-300">-</span>
                      ) : row.durationMinutes >= 50 ? (
                        <Badge tone="amber">{row.durationMinutes}</Badge>
                      ) : (
                        row.durationMinutes
                      )}
                    </Td>
                    <Td align="end">{row.audioMinutes ? `${row.audioMinutes} min` : "-"}</Td>
                    <Td align="end">{row.aiCalls || "-"}</Td>
                    <Td align="end" className={underwater ? "font-semibold text-red-600" : ""}>
                      {formatMicrocents(row.costMicrocents)}
                    </Td>
                    <Td align="end">
                      {row.grossCents ? <Money cents={row.grossCents} /> : <span className="text-slate-300">-</span>}
                    </Td>
                    <Td align="end" className="font-medium text-teal-700">
                      {row.feeCents ? <Money cents={row.feeCents} /> : <span className="text-slate-300">-</span>}
                    </Td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-6 text-center text-slate-400">
                    No sessions.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tracking-tight ${tone === "red" ? "text-red-600" : "text-slate-900"}`}
      >
        {value}
      </p>
    </Card>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th className={`py-2 font-medium ${align === "end" ? "text-end" : "text-start"}`}>{children}</th>
  );
}

function Td({
  children,
  align,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  align?: "end";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`py-2.5 ${align === "end" ? "text-end" : "text-start"} ${className}`}
    >
      {children}
    </td>
  );
}
