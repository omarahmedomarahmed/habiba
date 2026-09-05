"use client";

import { useState, useTransition } from "react";
import { Clock, ShieldOff, UserCheck } from "lucide-react";

import { answerRequest, revoke } from "@/app/(patient)/patient/consent/actions";
import { Badge, Card } from "@/components/ui";
import { REJECTION_REASONS } from "@/lib/access/state";
import { formatDate } from "@/lib/utils";

/**
 * Who can read your history, and the one tap that ends it. PLAN.md 7.4 / 7.5.
 *
 * ## Saying no costs nothing
 *
 * "No thanks" is a plain button with no confirmation and no required reason —
 * the reasons below it are optional, and choosing none of them still declines.
 * A dialog asking *are you sure?* on a refusal is pressure with a polite face,
 * and this is the screen where a person declines their own therapist.
 *
 * ## Two shapes, and the short one first
 *
 * §3 offers 24 hours or open-ended. **24 hours is listed first and styled as
 * the ordinary choice**, because a person skim-reading takes the first option
 * and the first option should be the one that expires by itself.
 */
export function ConsentList({
  requests,
  grants,
}: {
  requests: {
    id: string;
    therapistName: string;
    requestNote: string | null;
    requestedAt: Date | null;
  }[];
  grants: {
    id: string;
    status: string;
    shape: string | null;
    therapistName: string;
    expiresAt: Date | null;
    decidedAt: Date | null;
    revokedAt: Date | null;
  }[];
}) {
  return (
    <div className="space-y-4">
      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-slate-900">Waiting for your answer</h2>
        {requests.length === 0 ? (
          <Card className="px-4 py-5">
            <p className="text-sm text-slate-500">Nobody has asked to read your history.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-slate-900">Who has access</h2>
        {grants.length === 0 ? (
          <Card className="px-4 py-5">
            <p className="text-sm text-slate-500">
              Nobody can read your history. Your therapists still keep their own notes about the
              sessions you had with them — that part is their record, not yours to remove.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {grants.map((grant) => (
              <GrantRow key={grant.id} grant={grant} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequestRow({
  request,
}: {
  request: {
    id: string;
    therapistName: string;
    requestNote: string | null;
    requestedAt: Date | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [declining, setDeclining] = useState(false);

  const answer = (decision: "granted" | "rejected", shape?: "24h" | "open") =>
    startTransition(async () => {
      setError(null);
      const result = await answerRequest(request.id, decision, { shape, reason });
      if (result.error) setError(result.error);
    });

  return (
    <li>
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{request.therapistName}</p>
        {request.requestedAt ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Asked on {formatDate(request.requestedAt)}
          </p>
        ) : null}

        {request.requestNote ? (
          <blockquote className="mt-2 border-s-2 border-slate-200 ps-3 text-sm leading-relaxed text-slate-600">
            {request.requestNote}
          </blockquote>
        ) : null}

        {declining ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">
              You can say why, or say nothing. Either is fine.
            </p>
            {REJECTION_REASONS.map((preset) => (
              <label key={preset} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name={`reason-${request.id}`}
                  value={preset}
                  checked={reason === preset}
                  onChange={() => setReason(preset)}
                  className="mt-0.5"
                />
                {preset}
              </label>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => answer("rejected")}
                className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Working…" : "Decline"}
              </button>
              <button
                type="button"
                onClick={() => setDeclining(false)}
                className="tap-target h-10 rounded-xl px-3 text-sm font-medium text-slate-600"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => answer("granted", "24h")}
              className="tap-target h-10 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              Yes, for 24 hours
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => answer("granted", "open")}
              className="tap-target h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              Yes, until I change my mind
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeclining(true)}
              className="tap-target h-10 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              No thanks
            </button>
          </div>
        )}

        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function GrantRow({
  grant,
}: {
  grant: {
    id: string;
    status: string;
    shape: string | null;
    therapistName: string;
    expiresAt: Date | null;
    decidedAt: Date | null;
    revokedAt: Date | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const live = grant.status === "granted" && (!grant.expiresAt || grant.expiresAt > new Date());

  return (
    <li>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              {live ? (
                <UserCheck className="h-4 w-4 shrink-0 text-teal-500" aria-hidden />
              ) : (
                <ShieldOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              )}
              {grant.therapistName}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              {live && grant.expiresAt ? (
                <>
                  <Clock className="h-3 w-3" aria-hidden />
                  Until {formatDate(grant.expiresAt)}
                </>
              ) : live ? (
                "Until you change your mind"
              ) : grant.revokedAt ? (
                `You ended this on ${formatDate(grant.revokedAt)}`
              ) : grant.status === "rejected" ? (
                "You declined"
              ) : (
                "Expired"
              )}
            </p>
          </div>
          {live ? <Badge tone="teal">Can read</Badge> : <Badge tone="slate">Cannot read</Badge>}
        </div>

        {live ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await revoke(grant.id);
                if (result.error) setError(result.error);
              })
            }
            className="tap-target mt-3 h-10 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-50"
          >
            {pending ? "Working…" : "Stop their access"}
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </Card>
    </li>
  );
}
