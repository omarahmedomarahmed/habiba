import Link from "next/link";
import { ExternalLink, MessageSquare } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import type { RadarSessionRow } from "@/lib/data/radar";
import { formatDate } from "@/lib/utils";

/**
 * The clinician's own record of what each session was worth.
 *
 * PLAN.md 2.5: `/on-call` stays full radar control rather than a status
 * toggle. This is the history half — the price charged at the time, a link into
 * the patient record, and what the session cost them.
 *
 * ## Three numbers, never one
 *
 * §3 is explicit that the patient and the therapist each see the split as
 * separate lines with reasons. A single "you earned $25.50" hides both the fee
 * and the clinician's own session bill, and a clinician who discovers either on
 * a statement is a clinician who stops trusting the statement. So a paid
 * session shows what the patient paid, what we took, and what reached them.
 *
 * ## Everything here is historical
 *
 * None of it is recomputed from today's settings — see `radarSessionHistory`.
 * A clinician looking at March sees March's rates, even after an admin changes
 * them, because the alternative is a page that silently rewrites what somebody
 * was paid.
 */
export function SessionHistory({ rows }: { rows: RadarSessionRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          title="No sessions yet"
          body="Every session you run appears here with what it earned and what it cost."
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Session history</p>
        <p className="mt-0.5 text-xs text-slate-500">
          What each one was priced at on the day, and what it cost you.
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.sessionId} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {/*
                    A link only when there is a record to link to. A join-link
                    patient has no `patients` row until somebody types a name,
                    and a link to a null id is a 404 dressed up as a feature.
                  */}
                  {row.patientId ? (
                    <Link
                      href={`/patients/${row.patientId}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {row.patientLabel}
                      <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  ) : (
                    row.patientLabel
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(row.endedAt ?? row.startedAt ?? new Date())} ·{" "}
                  {row.modality === "video" ? "Video" : "In person"}
                  {row.copilotAsked > 0
                    ? ` · ${row.copilotAsked} copilot question${row.copilotAsked === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>

              <div className="shrink-0 text-end">
                {row.priceCents === 0 ? (
                  <Badge tone="slate">Free</Badge>
                ) : row.paid ? (
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatUsd(row.paid.netCents)}
                  </p>
                ) : (
                  <Badge tone="amber">{formatUsd(row.priceCents)} unpaid</Badge>
                )}
              </div>
            </div>

            {/*
              The split, spelled out. Only for a session that was actually paid
              for — showing a fee on a free link would be inventing a
              transaction.
            */}
            {row.paid ? (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <div className="flex gap-1.5">
                  <dt>Patient paid</dt>
                  <dd className="tabular-nums text-slate-700">
                    {formatUsd(row.paid.grossCents)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>24Therapy took</dt>
                  <dd className="tabular-nums text-slate-700">{formatUsd(row.paid.feeCents)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>You received</dt>
                  <dd className="tabular-nums text-slate-700">{formatUsd(row.paid.netCents)}</dd>
                </div>
              </dl>
            ) : null}

            {/*
              The clinician's own bill, which is a separate transaction from the
              patient's and is easy to forget exists. A free session still costs
              them: the AI ran either way.
            */}
            {row.ownBill ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Your session bill:{" "}
                <span className="tabular-nums text-slate-700">
                  {row.ownBill.amountCents === 0
                    ? row.ownBill.description
                    : formatUsd(row.ownBill.amountCents)}
                </span>
                {row.ownBill.status === "due" && row.ownBill.amountCents > 0 ? " · unpaid" : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
