"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { Check, Copy, Link2, ShieldCheck } from "lucide-react";

import {
  cancelInviteLink,
  createInviteLink,
  releaseClaimLock,
} from "@/app/(app)/patients/actions";
import { Badge, Card } from "@/components/clinician/kit";
import { formatDate } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/client";

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
  locked,
  zone,
}: {
  /**
   * The zone every date on this screen is printed in. 12.3, corrected.
   *
   * 🔴 A **prop from the server**, never `readerZone()` at module scope.
   *
   * The first version of 12.3 read the browser's zone in a `const` at the top
   * of this file. Next.js server-renders client components, and `Intl` is
   * defined in Node — it answers "UTC" — so the server pass emitted UTC times
   * and the browser pass emitted local ones. Every date was a React hydration
   * mismatch: console errors, and a visible flash of the wrong day for anybody
   * east of UTC. That is the same defect 12.3 exists to kill, one layer down:
   * the type system forced a zone argument and the *value* was wrong on the
   * server pass.
   *
   * One value, chosen on the server, used by both passes. They cannot disagree.
   */
  zone: string | null;
  patientId: string;
  claimed: boolean;
  claimedAt: Date | null;
  openInvite: { id: string; expiresAt: Date; issuedAt: Date } | null;
  /** 13R.4 / C88 — somebody is locked out of this record right now. */
  locked: boolean;
}) {
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reason, setReason] = useState("");
  const [released, setReleased] = useState(false);

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
      {/*
        🔴 13R.4 / C88 — the way out of the lock, on the screen of the person
        who wrote the record down.
        --------------------------------------------------------------------
        Three wrong first names lock this record for whoever is trying, and the
        budget no longer resets on a fresh code (C87). Without a door that
        would be a permanent lockout for the honest case — somebody who mistyped
        their own name — until sprint 20's staff tool exists.

        The clinician is the right person: they wrote it down, they know who
        this is, and they are reachable today. It restores one budget on one
        record. It reveals nothing and claims nothing; both questions still have
        to be answered.
      */}
      {locked && !released ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">{t("pracc.lockedOutTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {t("pracc.lockedOutBody")}
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("pracc.whyPlaceholder")}
            className="mt-2 h-10 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm"
          />
          <button
            type="button"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await releaseClaimLock(patientId, reason);
                if (result.error) setError(result.error);
                else setReleased(true);
              })
            }
            className="tap-target mt-2 h-10 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("pracc.letThemTry")}
          </button>
        </div>
      ) : null}

      {released ? (
        <div className="border-b border-brand-200 bg-brand-50 px-4 py-2.5">
          <p className="text-xs text-brand-800">
            {t("pracc.released")}
          </p>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3 border-b border-navy-100/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-700">{t("pracc.ownAccessTitle")}</p>
          <p className="mt-0.5 text-xs text-navy-400">
            {t("pracc.ownAccessBody")}
          </p>
        </div>
        {claimed ? <Badge tone="teal">{t("pracc.claimed")}</Badge> : null}
      </div>

      <div className="space-y-3 px-4 py-3">
        {claimed ? (
          <p className="flex items-start gap-2 text-sm text-navy-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
            <span>
              {claimedAt
                ? t("precord.claimedOn", { date: formatDate(claimedAt, zone, locale) })
                : t("precord.claimed")}
            </span>
          </p>
        ) : link ? (
          <>
            <p className="text-sm text-navy-400">
              {t("pracc.linkOnce")}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 font-mono text-xs text-navy-600"
              />
              <button
                type="button"
                onClick={copy}
                className="tap-target flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-navy-600 px-3 text-sm font-semibold text-white hover:bg-navy-500"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
            <p className="text-xs text-navy-400">
              {t("pracc.copyNow")}
            </p>
          </>
        ) : openInvite ? (
          <>
            <p className="flex items-start gap-2 text-sm text-navy-400">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden />
              <span>
                {t("precord.openLink", {
                  issued: formatDate(openInvite.issuedAt, zone, locale),
                  expires: formatDate(openInvite.expiresAt, zone, locale),
                })}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => cancel(openInvite.id)}
                className="tap-target h-10 rounded-lg border border-navy-100 px-3 text-sm font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-60"
              >
                {pending ? t("common.working") : t("pracc.cancelLink")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={issue}
                className="tap-target h-10 rounded-lg bg-navy-600 px-3 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-60"
              >
                {t("pracc.issueNew")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-navy-400">
              {t("pracc.inviteBody")}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={issue}
              className="tap-target flex h-10 items-center gap-1.5 rounded-lg bg-navy-600 px-3 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" aria-hidden />
              {pending ? t("common.working") : t("pracc.createLink")}
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
