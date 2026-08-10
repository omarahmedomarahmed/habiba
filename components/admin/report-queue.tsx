"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, FileSearch, UserX, X } from "lucide-react";

import { resolveReport } from "@/app/(admin)/admin/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ReportRow = {
  id: string;
  kind: string;
  detail: string | null;
  patientEmail: string | null;
  status: string;
  resolution: string | null;
  filedAt: string;
  therapistId: string;
  therapistName: string;
  therapistEmail: string;
  sessionId: string;
  sessionDate: string | null;
  durationMinutes: number | null;
};

/**
 * What patients told us went wrong.
 *
 * The detail text is the patient's own words and is shown verbatim — summarising
 * a complaint before a human reads it is how the serious ones get filed as
 * minor. Every decision needs a sentence, and the sentence is stored with the
 * name of whoever wrote it, because "we looked into it" is not a record.
 */
export function ReportQueue({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Check className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-slate-900">Nothing here</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <ReportCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function ReportCard({ row }: { row: ReportRow }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const decide = (outcome: "actioned" | "dismissed") =>
    startTransition(async () => {
      setError(null);
      const result = await resolveReport(row.id, outcome, note);
      if (result.error) setError(result.error);
      else setDone(outcome);
    });

  const serious = row.kind === "abuse";

  return (
    <Card className={cn("overflow-hidden", serious && "border-red-200")}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            {serious ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden />
            ) : (
              <UserX className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            )}
            {row.kind === "no_show"
              ? "Therapist did not attend"
              : row.kind === "abuse"
                ? "Conduct during a session"
                : "Report"}
          </p>
          <p className="truncate text-xs text-slate-500">
            {row.therapistName} · {row.therapistEmail} · session {row.sessionDate ?? "—"}
            {row.durationMinutes ? ` · ${row.durationMinutes} min` : ""} · filed {row.filedAt}
          </p>
        </div>
        {done ? (
          <Badge tone={done === "actioned" ? "green" : "slate"}>{done}</Badge>
        ) : (
          <Badge tone={serious ? "red" : "amber"}>{row.status}</Badge>
        )}
      </div>

      {row.detail ? (
        <blockquote className="border-l-2 border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-700 italic">
          “{row.detail}”
        </blockquote>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-500">
          No detail given — the patient reported a no-show, which needs none.
        </p>
      )}

      {row.patientEmail ? (
        <p className="px-4 pb-2 text-xs text-slate-500">Reply to: {row.patientEmail}</p>
      ) : (
        <p className="px-4 pb-2 text-xs text-slate-400">They left no address.</p>
      )}

      {row.status === "open" && !done ? (
        <div className="space-y-2.5 border-t border-slate-100 bg-slate-50 p-4">
          {/*
            The only route to a transcript in the whole admin console, and it
            starts from a complaint. It shows the periods the recording was
            paused as well as what was said — an allegation about something
            that happened off record deserves to have that gap exist as a fact
            rather than as an argument.
          */}
          <a
            href={`/admin/radar/investigate/${row.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <FileSearch className="h-3.5 w-3.5" aria-hidden />
            Open the session record
          </a>

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <Input
            aria-label="What you decided"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What you decided, and why"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => decide("actioned")}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Actioned
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => decide("dismissed")}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              No action needed
            </Button>
          </div>
        </div>
      ) : row.resolution ? (
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          {row.resolution}
        </p>
      ) : null}
    </Card>
  );
}
