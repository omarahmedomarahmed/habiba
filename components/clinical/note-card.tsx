"use client";

import { Check, FileText, Sparkles } from "lucide-react";

import type { NoteContent } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/**
 * The SOAP note, read-only.
 *
 * Presentational: no fetching, no auth, no store. Rendered identically in the
 * portal and on the marketing site (with fixture content).
 */
export function NoteCard({
  note,
  status = "draft",
  patientLabel,
  dateLabel,
  className,
  compact = false,
}: {
  note: NoteContent;
  status?: "draft" | "approved" | "generating";
  patientLabel?: string;
  dateLabel?: string;
  className?: string;
  compact?: boolean;
}) {
  const sections: { key: string; label: string; body: string }[] = [
    { key: "s", label: "Subjective", body: note.soap.subjective },
    { key: "o", label: "Objective", body: note.soap.objective },
    { key: "a", label: "Assessment", body: note.soap.assessment },
    { key: "p", label: "Plan", body: note.soap.plan },
  ];

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FileText className="h-4.5 w-4.5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {patientLabel ? `Session note — ${patientLabel}` : "Session note"}
            </p>
            {dateLabel ? <p className="text-xs text-slate-500">{dateLabel}</p> : null}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="space-y-4 px-4 py-4">
        {note.summary ? (
          <p className="text-[15px] leading-relaxed text-slate-700">{note.summary}</p>
        ) : null}

        <div className="space-y-3.5">
          {sections.map((section) =>
            section.body ? (
              <div key={section.key}>
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{section.body}</p>
              </div>
            ) : null,
          )}
        </div>

        {!compact && note.talkingPoints.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Key points
            </p>
            <ul className="mt-1.5 space-y-1">
              {note.talkingPoints.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!compact && note.impressions ? (
          <div className="rounded-xl bg-amber-50/70 px-3.5 py-3">
            <p className="text-[11px] font-bold tracking-wider text-amber-700 uppercase">
              Clinical impressions — for your review
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{note.impressions}</p>
          </div>
        ) : null}

        {!compact && note.recommendations.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Recommendations
            </p>
            <ul className="mt-1.5 space-y-1">
              {note.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-400" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {note.followUp ? (
          <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Follow-up:</span> {note.followUp}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "approved" | "generating" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3 w-3" aria-hidden /> Approved
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
        <Sparkles className="h-3 w-3" aria-hidden /> Writing…
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      Draft
    </span>
  );
}
