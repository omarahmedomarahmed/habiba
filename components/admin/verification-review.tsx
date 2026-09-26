"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";

import { decideTherapistVerification } from "@/app/(admin)/admin/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { MIN_REASON } from "@/lib/admin/reason";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { countKey } from "@/lib/i18n/count-form";

/** W1-23: the words the forms already use for each licence field. */
const CHANGE_LABELS: Record<string, MessageKey> = {
  country: "tver.country",
  licenseBody: "tver.regulator",
  licenseNumber: "tver.licenceNumber",
  licenseExpiry: "tver.licenceExpiry",
  credentials: "tset.credentials",
  licenseType: "tset.licenceType",
  licenseState: "tset.licenceState",
};

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
  /** W1-16: back in the queue because the licence ran out. */
  licenceExpired?: boolean;
  /** W1-23: a licence change an approved clinician asked for. */
  pendingChange?: Record<string, string | null> | null;
  specialties: string[];
  languages: string[];
  documents: { label: string; url: string | null }[];
  submittedAt: string | null;
  reviewNote: string | null;
  decided: boolean;
  /** 🔴 C351 — how many times this application has already been turned down. */
  rejectionCount: number;
  /** Whether the documents were removed after the second one. */
  documentsCleared: boolean;
  /** The count at which a rejection removes the documents. */
  finalAt: number;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | "proposed" | null>(null);

  const decide = (approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await decideTherapistVerification(props.id, approve, note);
      if (result.error) setError(result.error);
      else setDone(result.proposed ? "proposed" : approve ? "approved" : "rejected");
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            {props.name}
            {props.licenceExpired ? <Badge tone="amber">{t("tlic.expiredTitle")}</Badge> : null}
          </p>
          <p className="truncate text-xs text-slate-500">
            {props.email}
            {props.organizationName ? ` · ${props.organizationName}` : ""}
            {props.submittedAt ? ` · submitted ${props.submittedAt}` : ""}
          </p>
        </div>
        {done ? (
          <Badge tone={done === "approved" ? "green" : done === "proposed" ? "amber" : "red"}>
            {done === "proposed" ? "recorded: a second reviewer confirms" : done}
          </Badge>
        ) : (
          <Badge tone="slate">{props.countryLabel}</Badge>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
        <Row label="Regulator">{props.licenseBody ?? "-"}</Row>
        <Row label="Licence no.">{props.licenseNumber ?? "-"}</Row>
        <Row label="Expires">{props.licenseExpiry ?? "-"}</Row>
        <Row label="Country">{props.countryLabel}</Row>
        <Row label="Languages">{props.languages.join(", ") || "-"}</Row>
        <Row label="Works with">{props.specialties.join(", ") || "-"}</Row>
      </dl>

      {props.pendingChange ? (
        <dl className="grid gap-x-6 gap-y-2 border-t border-amber-100 bg-amber-50 px-4 py-3 text-sm sm:grid-cols-2">
          <p className="font-semibold text-amber-900 sm:col-span-2">{t("tlic.change")}</p>
          {Object.entries(props.pendingChange).map(([key, value]) => (
            <Row key={key} label={CHANGE_LABELS[key] ? t(CHANGE_LABELS[key]) : key}>
              {value ?? "-"}
            </Row>
          ))}
        </dl>
      ) : null}

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
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-500">
                  not provided
                </div>
                <figcaption className="mt-1 truncate text-[11px] text-slate-500">
                  {doc.label}
                </figcaption>
              </>
            )}
          </figure>
        ))}
      </div>

      {/*
        🔴 C351 — THE CONSEQUENCE OF THIS PARTICULAR NO, BEFORE IT IS GIVEN.
        ------------------------------------------------------------------
        Every rejection looks identical from this card: one button, one field.
        They are not identical. The second one deletes the applicant's identity
        documents and means they cannot come back without uploading again, and
        an operator who learns that afterwards has already done it.

        Shown as a state rather than a warning inside a tooltip, because the
        whole point is that it is read without being sought.
      */}
      {props.pendingChange ? null : props.documentsCleared ? (
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          {t(countKey("admin.verify.turnedDown", props.rejectionCount), { count: props.rejectionCount })}
        </p>
      ) : props.rejectionCount >= props.finalAt - 1 && !props.decided ? (
        <p className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          Turned down {props.rejectionCount === 1 ? "once" : `${props.rejectionCount} times`}. Rejecting again
          deletes their documents and they start over.
        </p>
      ) : props.rejectionCount > 0 ? (
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          Turned down {props.rejectionCount} time{props.rejectionCount === 1 ? "" : "s"} before.
        </p>
      ) : null}

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
            placeholder="Required to reject. They see this word for word"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => decide(true)}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              {pending ? "Working…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending || note.trim().length < MIN_REASON}
              onClick={() => decide(false)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {props.rejectionCount >= props.finalAt - 1 ? "Reject and clear" : "Reject"}
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
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{children}</dd>
    </div>
  );
}
