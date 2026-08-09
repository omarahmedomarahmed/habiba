"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";

import { decideTherapistVerification } from "@/app/(admin)/admin/actions";
import { Badge, Button, Card, Input } from "@/components/ui";

/**
 * One applicant, with their documents on screen.
 *
 * Rejection requires a reason and the reason is sent to them verbatim, so the
 * field is not optional. "Rejected" with no explanation produces a support
 * ticket and a resubmission of the exact same documents.
 */
export function VerificationReview(props: {
  id: string;
  name: string;
  email: string;
  organizationName: string | null;
  countryLabel: string;
  licenseBody: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  specialties: string[];
  languages: string[];
  documents: { label: string; url: string | null }[];
  submittedAt: string | null;
  reviewNote: string | null;
  decided: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const decide = (approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await decideTherapistVerification(props.id, approve, note);
      if (result.error) setError(result.error);
      else setDone(approve ? "approved" : "rejected");
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{props.name}</p>
          <p className="truncate text-xs text-slate-500">
            {props.email}
            {props.organizationName ? ` · ${props.organizationName}` : ""}
            {props.submittedAt ? ` · submitted ${props.submittedAt}` : ""}
          </p>
        </div>
        {done ? (
          <Badge tone={done === "approved" ? "green" : "red"}>{done}</Badge>
        ) : (
          <Badge tone="slate">{props.countryLabel}</Badge>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
        <Row label="Regulator">{props.licenseBody ?? "—"}</Row>
        <Row label="Licence no.">{props.licenseNumber ?? "—"}</Row>
        <Row label="Expires">{props.licenseExpiry ?? "—"}</Row>
        <Row label="Country">{props.countryLabel}</Row>
        <Row label="Languages">{props.languages.join(", ") || "—"}</Row>
        <Row label="Works with">{props.specialties.join(", ") || "—"}</Row>
      </dl>

      <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4">
        {props.documents.map((doc) => (
          <figure key={doc.label} className="min-w-0">
            {doc.url ? (
              <a href={doc.url} target="_blank" rel="noreferrer" className="group block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.url}
                  alt={doc.label}
                  className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover group-hover:border-brand-400"
                  referrerPolicy="no-referrer"
                />
                <figcaption className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  {doc.label}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden />
                </figcaption>
              </a>
            ) : (
              <>
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400">
                  not provided
                </div>
                <figcaption className="mt-1 truncate text-[11px] text-slate-400">
                  {doc.label}
                </figcaption>
              </>
            )}
          </figure>
        ))}
      </div>

      {props.decided ? (
        props.reviewNote ? (
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Note sent to them: {props.reviewNote}
          </p>
        ) : null
      ) : done ? null : (
        <div className="space-y-2.5 border-t border-slate-100 bg-slate-50 p-4">
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <Input
            aria-label="Note to the clinician"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required to reject — they see this word for word"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => decide(true)}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              {pending ? "Working…" : "Approve"}
            </Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => decide(false)}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Reject
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{children}</dd>
    </div>
  );
}
