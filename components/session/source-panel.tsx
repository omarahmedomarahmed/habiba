"use client";

import { useState, useTransition } from "react";

import {
  issueUploadCredential,
  revokeUploadCredential,
} from "@/app/(app)/sessions/[id]/actions";
import { Card } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Where a session's audio came from. PLAN.md 51.6, 36.1, 36.2, 37R.21, C179.
 *
 * ## Why this screen had to exist
 *
 * `session_sources` has a table, a migration with CHECK constraints, a service
 * with six functions, and until now no interface at all. 51.6's rule is that
 * every route the code can reach has a page a human can reach, and a table
 * nobody can see is a table whose constraints nobody can check. A clinician
 * asking "what recorded this, and who can still upload to it" had no answer.
 *
 * ## 🔴 What is deliberately absent
 *
 * There is no field for a meeting link. C132 and sprint 41's hard rule are
 * that the recorder joins meetings 24Therapy created for a session and nothing
 * else, ever, and the schema has no column that could hold a pasted link. A
 * text input here would be the first place somebody tried to add one, so the
 * screen says the rule in a sentence instead of offering a box that refuses.
 *
 * ## The credential
 *
 * Shown once, because it is stored as a hash. An interface that implies it can
 * be read back would be lying about the storage, so the copy says plainly that
 * nobody here can.
 */
export function SourcePanel({
  sessionId,
  kind,
  impliedKind = null,
  provisionedAt,
  tokenExpiresAt,
  tokenRevoked,
  tokenUses,
  canIssue,
}: {
  sessionId: string;
  kind: string | null;
  /** 🔴 Board 334: where the audio came from when no source row was written (our room, or in person). */
  impliedKind?: "24t_room" | "in_person" | null;
  provisionedAt: string | null;
  tokenExpiresAt: string | null;
  tokenRevoked: boolean;
  tokenUses: number;
  /** An ended session takes no new audio, so it gets no new credential. */
  canIssue: boolean;
}) {
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const issue = () =>
    startTransition(async () => {
      setError(null);
      const result = await issueUploadCredential(sessionId);
      if (result.error) setError(result.error);
      else setToken(result.token ?? null);
    });

  const revoke = () =>
    startTransition(async () => {
      setError(null);
      setToken(null);
      const result = await revokeUploadCredential(sessionId);
      if (result.error) setError(result.error);
    });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-navy-700">{t("portal.source.title")}</h2>

      {kind === null ? (
        impliedKind ? (
          <p className="mt-1 text-sm font-medium text-navy-700">{t(`portal.source.kind.${impliedKind}`)}</p>
        ) : (
          <p className="mt-1 text-sm text-navy-400">{t("portal.source.none")}</p>
        )
      ) : (
        <>
          <p className="mt-1 text-sm font-medium text-navy-700">
            {t(`portal.source.kind.${kind}` as MessageKey)}
          </p>
          {provisionedAt ? (
            <p className="mt-0.5 text-xs text-navy-400">
              {t("portal.source.provisioned", { date: provisionedAt })}
            </p>
          ) : null}
          {/*
            🔴 The rule, in words, on the screen. Not a disabled input and not
            a tooltip: a clinician who wonders why they cannot point this at
            their own Zoom link deserves the reason rather than a dead control.
          */}
          <p className="mt-2 text-xs leading-relaxed text-navy-400">
            {t("portal.source.onlyOurs")}
          </p>
        </>
      )}

      {kind !== null ? (
        <div className="mt-4 border-t border-navy-100/70 pt-3">
          <p className="text-xs font-semibold text-navy-600">
            {t("portal.source.tokenTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-navy-400">
            {t("portal.source.tokenBody")}
          </p>

          <p className="mt-2 text-xs text-navy-400">
            {tokenRevoked
              ? t("portal.source.tokenRevoked")
              : tokenExpiresAt
                ? t("portal.source.tokenExpires", { date: tokenExpiresAt })
                : ""}
            {tokenUses > 0 ? ` · ${t("portal.source.tokenUses", { count: tokenUses })}` : ""}
          </p>

          {token ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <code className="block break-all text-xs text-navy-700">{token}</code>
              <p className="mt-1.5 text-xs leading-relaxed text-amber-900/90">
                {t("portal.source.tokenOnce")}
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {canIssue ? (
              <button
                type="button"
                disabled={pending}
                onClick={issue}
                className="tap-target h-10 rounded-xl bg-navy-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {t("portal.source.tokenIssue")}
              </button>
            ) : null}
            {tokenExpiresAt && !tokenRevoked ? (
              <button
                type="button"
                disabled={pending}
                onClick={revoke}
                className="tap-target h-10 rounded-xl bg-navy-50 px-3 text-xs font-semibold text-navy-600 hover:bg-navy-100 disabled:opacity-50"
              >
                {t("portal.source.tokenRevoke")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
