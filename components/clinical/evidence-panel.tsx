"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, FileText, MessageSquare, NotebookPen, User } from "lucide-react";

import { confirmFact, rejectFact } from "@/app/(app)/patients/[id]/evidence/actions";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Why the system believes something. PLAN.md 33.6.
 *
 * ## 🔴 The quote is the interface
 *
 * Not a disclosure, not a tooltip, not a "view source" link: the sentence that
 * produced the fact sits under the fact, always, and the fact is unreadable
 * without it. That is the accept criterion of the sprint made visual — every
 * clinical fact traceable to the exact sentence — and it is the difference
 * between a chart a clinician can argue with and a chart they have to trust.
 *
 * ## What each badge is doing
 *
 * **Source** is the rank: a clinician's entry, a document, the patient's own
 * words, or a model. A model's row also shows its confidence, and the two are
 * deliberately printed together with the word "unverified" until somebody
 * agrees, because a number on its own reads as certainty.
 *
 * **Age** is the age of the *thing*, not of the row (33.3). "8 months ago (not
 * current)" on an ideation fact is the whole point of the temporal work: the
 * clinician asks again rather than reacting to March.
 *
 * **Contradicted** is shown rather than resolved silently. Session 17
 * disagreeing with session 4 is clinical information, and a panel that quietly
 * displayed the winner would be making a judgement it is not qualified to make.
 */

export type PanelFact = {
  id: string;
  domain: string;
  field: string;
  value: string;
  sourceType: "clinician" | "document" | "patient" | "ai";
  confidence: number | null;
  status: string;
  verified: boolean;
  ageLabel: string;
  current: boolean;
  quote: string;
  evidenceKind: "segment" | "chunk" | "journal" | "clinician" | "gone";
  evidenceWhere: string;
  /** Lines either side of the quoted one, for a transcript. */
  context: { speaker: string; text: string; self: boolean }[];
  contradicts: { value: string; sourceType: string; ageLabel: string }[];
};

/* 37L.2 — keys, resolved at render. */
const SOURCE_LABEL: Record<PanelFact["sourceType"], MessageKey> = {
  clinician: "tev.srcClinician",
  document: "tev.srcDocument",
  patient: "tev.srcPatient",
  ai: "tev.srcAi",
};

const EVIDENCE_ICON = {
  segment: MessageSquare,
  chunk: FileText,
  journal: NotebookPen,
  clinician: User,
  gone: AlertTriangle,
} as const;

export function EvidencePanel({
  patientId,
  facts,
}: {
  patientId: string;
  facts: PanelFact[];
}) {
  const t = useT();

  if (facts.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-600">
          {t("tev.none")}
        </p>
      </Card>
    );
  }

  const domains = [...new Set(facts.map((fact) => fact.domain))];

  return (
    <div className="space-y-8">
      {domains.map((domain) => (
        <section key={domain}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {domain}
          </h2>
          <div className="space-y-3">
            {facts
              .filter((fact) => fact.domain === domain)
              .map((fact) => (
                <FactCard key={fact.id} patientId={patientId} fact={fact} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FactCard({ patientId, fact }: { patientId: string; fact: PanelFact }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const Icon = EVIDENCE_ICON[fact.evidenceKind];

  return (
    <Card className={cn("p-4", fact.status === "disputed" && "border-amber-300 bg-amber-50/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{fact.field}</p>
          <p className="text-[15px] font-medium text-slate-900">{fact.value}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={fact.sourceType === "ai" ? "amber" : "slate"}>
            {t(SOURCE_LABEL[fact.sourceType])}
          </Badge>
          {/*
            🔴 The number never appears alone. "0.82" beside a clinical
            statement reads as 82% true; "0.82, unverified" reads as what it is.
          */}
          {fact.sourceType === "ai" ? (
            <Badge tone={fact.verified ? "green" : "amber"}>
              {fact.verified
                ? "confirmed by you"
                : `confidence ${fact.confidence?.toFixed(2) ?? "unknown"}, unverified`}
            </Badge>
          ) : null}
          <Badge tone={fact.current ? "slate" : "amber"}>{fact.ageLabel}</Badge>
          {fact.status === "disputed" ? <Badge tone="amber">{t("tev.youDisagreed")}</Badge> : null}
        </div>
      </div>

      {/* The evidence. Always visible, never behind a disclosure. */}
      <figure className="mt-3 border-s-2 border-slate-200 ps-3">
        <blockquote className="text-sm italic leading-relaxed text-slate-700">
          “{fact.quote}”
        </blockquote>
        <figcaption className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {fact.evidenceWhere}
        </figcaption>
      </figure>

      {fact.context.length > 1 ? (
        <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3">
          {fact.context.map((line, index) => (
            <p
              key={index}
              className={cn(
                "text-xs leading-relaxed",
                line.self ? "font-medium text-slate-900" : "text-slate-500",
              )}
            >
              <span className="text-slate-400">
                {line.speaker === "patient"
                  ? t("tev.speakerPatient")
                  : line.speaker === "therapist"
                    ? t("tev.speakerYou")
                    : t("tev.speakerOther")}
                :{" "}
              </span>
              {line.text}
            </p>
          ))}
        </div>
      ) : null}

      {fact.contradicts.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-600">{t("tev.contradicts")}</p>
          <ul className="mt-1 space-y-1">
            {fact.contradicts.map((other, index) => (
              <li key={index} className="text-xs text-slate-500">
                “{other.value}” · {other.sourceType} · {other.ageLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

      {disputing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("tev.whyPlaceholder")}
            aria-label={t("tev.whyLabel")}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await rejectFact(patientId, fact.id, reason);
                  if (result.error) setError(result.error);
                  else {
                    setDisputing(false);
                    setError(null);
                  }
                })
              }
            >
              {t("tev.recordDisagreement")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDisputing(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {!fact.verified && fact.status !== "disputed" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await confirmFact(patientId, fact.id);
                  if (result.error) setError(result.error);
                })
              }
            >
              <Check className="me-1.5 h-3.5 w-3.5" aria-hidden />
              {t("tev.thisIsRight")}
            </Button>
          ) : null}
          {fact.status !== "disputed" ? (
            <Button size="sm" variant="ghost" onClick={() => setDisputing(true)}>
              {t("tev.iDisagree")}
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
