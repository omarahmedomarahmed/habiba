"use client";

import { Check, FileText, Sparkles } from "lucide-react";

import type { NoteContent } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();

  const sections: { key: string; label: string; body: string }[] = [
    { key: "s", label: t("tnote.subjective"), body: note.soap.subjective },
    { key: "o", label: t("tnote.objective"), body: note.soap.objective },
    { key: "a", label: t("tnote.assessment"), body: note.soap.assessment },
    { key: "p", label: t("tnote.plan"), body: note.soap.plan },
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
              {patientLabel
                ? t("tnc.sessionNoteFor", { name: patientLabel })
                : t("tnc.sessionNote")}
            </p>
            {dateLabel ? <p className="text-xs text-slate-500">{dateLabel}</p> : null}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="space-y-4 px-4 py-4">
        {note.summary ? (
          <p className="text-[15px] leading-relaxed font-medium text-slate-900">{note.summary}</p>
        ) : null}

        {/*
          🔴 22R — a missing SOAP section says so rather than disappearing.
          
          A note came back with Subjective, Objective and Plan and no
          Assessment, and the heading simply was not rendered. A clinician
          skimming a shape they know does not notice a section that is absent;
          they notice one that is wrong. Saying "the model did not produce
          this" is both true and the prompt to write it themselves — this is a
          draft with their name going on it.
        */}
        {/*
          🔴 76.66 — THE FOUR SECTIONS ARE THE DOCUMENT, SO THEY ARE BUILT LIKE ONE.
          
          The labels were `text-slate-400` on white: **2.56:1**, which fails even
          the 3:1 large-text floor and is being asked to carry 11px bold, where
          the requirement is 4.5:1. A clinician skimming for the Assessment could
          not find the word Assessment. Measured, not judged by eye.
          
          They are now `navy-500` on a tinted rail, which is 15.8:1, and each
          section carries its SOAP letter. The letter is the reason this note
          format exists: a clinician reads S-O-A-P as a shape and jumps to the
          part they need. Rendering the four as identical grey paragraphs threw
          away the one piece of structure the format has.
        */}
        <div className="space-y-3">
          {sections.map((section) => (
            <div
              key={section.key}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-navy-500 text-[11px] font-bold text-white"
                >
                  {section.key.toUpperCase()}
                </span>
                <p className="text-[11px] font-bold tracking-wider text-navy-500 uppercase">
                  {section.label}
                </p>
              </div>
              {section.body ? (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{section.body}</p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-amber-700">
                  {t("tnc.notWritten")}
                </p>
              )}
            </div>
          ))}
        </div>

        {!compact && note.talkingPoints.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              {t("tnc.keyPoints")}
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
              {t("tnc.impressions")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{note.impressions}</p>
          </div>
        ) : null}

        {!compact && note.recommendations.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              {t("tnc.recommendations")}
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
            <span className="font-semibold text-slate-800">{t("tnc.followUp")}</span> {note.followUp}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "approved" | "generating" }) {
  const t = useT();
  if (status === "approved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3 w-3" aria-hidden /> {t("tnote.approved")}
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
        <Sparkles className="h-3 w-3" aria-hidden /> {t("tnc.writing")}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {t("tnote.stateDraft")}
    </span>
  );
}
