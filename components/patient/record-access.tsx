"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, ShieldCheck } from "lucide-react";

import { cancelInviteLink, createInviteLink } from "@/app/(app)/patients/actions";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

/**
 * Handing a record to the person it describes. C19 / 6.10.
 *
 * ## Why a link and not an email
 *
 * Measured on this database: 56 of 66 patients have no email address and none
 * has a phone number. The matching route in `/patient/claim` needs one of
 * those to find anything, so for most of a real book it finds nothing. The
 * clinician handing over a link in the room is not a fallback — it is the main
 * road.
 *
 * ## The token appears once
 *
 * We store a hash, never the token, so there is nothing to show on a later
 * visit. That is deliberate and the copy says so: a clinician who loses the
 * link cancels it and issues another. The alternative — a link we can re-read
 * forever — is a permanent handover credential sitting in our database.
 */
export function RecordAccess({
  patientId,
  claimed,
  claimedAt,
  openInvite,
}: {
  patientId: string;
  claimed: boolean;
  claimedAt: Date | null;
  openInvite: { id: string; expiresAt: Date; issuedAt: Date } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issue = () =>
    startTransition(async () => {
      setError(null);
      const result = await createInviteLink(patientId);
      if ("error" in result) setError(result.error);
      else setLink(result.url);
    });

  const cancel = (inviteId: string) =>
    startTransition(async () => {
      setError(null);
      setLink(null);
      const result = await cancelInviteLink(patientId, inviteId);
      if (result.error) setError(result.error);
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses the clipboard still shows the link in the box
      // below, selectable. Nothing here is worth an error message.
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Their own access</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Let this person sign in and see their own record.
          </p>
        </div>
        {claimed ? <Badge tone="teal">Claimed</Badge> : null}
      </div>

      <div className="space-y-3 px-4 py-3">
        {claimed ? (
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
            <span>
              This person took ownership of their record
              {claimedAt ? ` on ${formatDate(claimedAt)}` : ""}. Your notes stay yours; what they
              see is their own profile and the briefs you share.
            </span>
          </p>
        ) : link ? (
          <>
            <p className="text-sm text-slate-600">
              Send them this link. It works once, and it expires in 30 days.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={copy}
                className="tap-target flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Copy it now — we store only a fingerprint of this link, so it cannot be shown again.
            </p>
          </>
        ) : openInvite ? (
          <>
            <p className="flex items-start gap-2 text-sm text-slate-600">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span>
                A link issued on {formatDate(openInvite.issuedAt)} is still unused. It expires{" "}
                {formatDate(openInvite.expiresAt)}. We cannot show it again.
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => cancel(openInvite.id)}
                className="tap-target h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {pending ? "Working…" : "Cancel that link"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={issue}
                className="tap-target h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Issue a new one
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              A link you hand over in the room. They set a password, confirm the record is theirs,
              and choose whether you keep access.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={issue}
              className="tap-target flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" aria-hidden />
              {pending ? "Working…" : "Create an invite link"}
            </button>
          </>
        )}

        {error ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
