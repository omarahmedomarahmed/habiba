"use client";

import { useState, useTransition } from "react";
import { Check, Quote, Sparkles, X } from "lucide-react";

import { decideDiagnosis, proposeFromDocuments } from "@/app/(app)/patients/[id]/documents/actions";
import { Badge, Card } from "@/components/ui";

/**
 * Diagnoses read out of documents, and the human who confirms them. PLAN.md 8.9.
 *
 * ## The source sentence is not decoration
 *
 * §3: *extract only what is written, show the source sentence, require
 * confirmation.* So the sentence is rendered **above** the accept button, in
 * the document's own words, quoted. A clinician confirming a diagnosis is
 * confirming that this sentence says that thing — which is a question they can
 * actually answer, unlike "does this patient have F41.1?".
 *
 * A proposal is never styled as a diagnosis. It is a quotation with a label
 * attached, and it reads that way until somebody agrees with it.
 */
export function DiagnosisList({
  patientId,
  diagnoses,
  canDecide,
}: {
  patientId: string;
  diagnoses: {
    id: string;
    label: string;
    code: string | null;
    sourceSentence: string;
    status: "proposed" | "confirmed" | "rejected";
    documentTitle: string | null;
    documentOrdinal: number | null;
    flags: { id: string; reason: string; note: string | null }[];
  }[];
  canDecide: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const proposed = diagnoses.filter((d) => d.status === "proposed");
  const confirmed = diagnoses.filter((d) => d.status === "confirmed");

  const decide = (id: string, decision: "confirmed" | "rejected") =>
    startTransition(async () => {
      setError(null);
      const result = await decideDiagnosis(patientId, id, decision);
      if (result.error) setError(result.error);
    });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Diagnoses in the documents</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Only what a document states in words. Never inferred from symptoms.
          </p>
        </div>
        {canDecide ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await proposeFromDocuments(patientId);
                if (result.error) setError(result.error);
              })
            }
            className="tap-target flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Reading…" : "Read documents"}
          </button>
        ) : null}
      </div>

      {confirmed.length === 0 && proposed.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">
          Nothing yet. Add a letter or a report and read it here — anything stated as a diagnosis
          will be offered for you to confirm.
        </p>
      ) : null}

      {confirmed.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {confirmed.map((diagnosis) => (
            <li key={diagnosis.id} className="px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                {diagnosis.label}
                {diagnosis.code ? (
                  <span className="font-mono text-xs text-slate-400">{diagnosis.code}</span>
                ) : null}
                <Badge tone="teal">Confirmed</Badge>
                {diagnosis.flags.map((flag) => (
                  <Badge key={flag.id} tone="amber">
                    {flag.reason.replace("_", " ")}
                  </Badge>
                ))}
              </p>
              <Source diagnosis={diagnosis} />
            </li>
          ))}
        </ul>
      ) : null}

      {proposed.length > 0 ? (
        <div className="border-t border-slate-100">
          <p className="px-4 pt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Waiting for you to confirm
          </p>
          <ul className="divide-y divide-slate-100">
            {proposed.map((diagnosis) => (
              <li key={diagnosis.id} className="px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  {diagnosis.label}
                  {diagnosis.code ? (
                    <span className="font-mono text-xs text-slate-400">{diagnosis.code}</span>
                  ) : null}
                </p>
                <Source diagnosis={diagnosis} />

                {canDecide ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(diagnosis.id, "confirmed")}
                      className="tap-target flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      That is what it says
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(diagnosis.id, "rejected")}
                      className="tap-target flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      No
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="px-4 pb-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function Source({
  diagnosis,
}: {
  diagnosis: {
    sourceSentence: string;
    documentTitle: string | null;
    documentOrdinal: number | null;
  };
}) {
  return (
    <blockquote className="mt-1.5 flex gap-2 border-s-2 border-slate-200 ps-2.5 text-xs leading-relaxed text-slate-600">
      <Quote className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" aria-hidden />
      <span>
        “{diagnosis.sourceSentence}”
        {diagnosis.documentTitle ? (
          <span className="mt-0.5 block text-slate-400">
            {diagnosis.documentOrdinal ? `D${diagnosis.documentOrdinal} · ` : ""}
            {diagnosis.documentTitle}
          </span>
        ) : null}
      </span>
    </blockquote>
  );
}
