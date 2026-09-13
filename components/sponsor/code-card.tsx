"use client";

import { useState, useTransition } from "react";

import { replaceCode } from "@/app/(sponsor)/sponsor/code/actions";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * The printable code. PLAN.md 53.2, 53.9, C237.
 *
 * 🔴 53.2 — EVERY WORD ON THIS POSTER IS A BENEFIT WORD. Nothing here implies the
 * reader needs help. Somebody photographing a poster in an open-plan office is as
 * exposed as somebody reading the screen, so a poster headed "get help with your
 * mental health" is an outing risk for whoever is seen taking the picture.
 *
 * 🔴 Rotating is behind a confirmation because the old code stops working straight
 * away and every printed poster in the building becomes wrong. What it does NOT do
 * is unenrol anybody, and the sentence says so: the code is a gate to cross once,
 * not a credential anybody keeps.
 */
export function CodeCard({
  code,
  qrDataUri,
  posterLine,
  canRotate,
}: {
  code: string;
  /** Generated on the server so no third party sees our customer's code. */
  qrDataUri: string;
  posterLine: string;
  canRotate: boolean;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-5">
      {/*
        The printable block. `print:` utilities rather than a separate print
        route: one document means the thing on the wall is provably the thing the
        sponsor looked at.
      */}
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URI, not a remote asset */}
        <img src={qrDataUri} alt={code} width={256} height={256} className="h-64 w-64" />

        <p className="font-mono text-3xl font-bold tracking-[0.2em] text-slate-900">{code}</p>

        <p className="max-w-sm text-sm leading-relaxed text-slate-600">{posterLine}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white"
        >
          {t("sponsor.codePrint")}
        </button>

        {canRotate ? (
          confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs leading-relaxed text-slate-600">
                {t("sponsor.codeRotateBody")}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => void (await replaceCode()))}
                className="tap-target h-10 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {t("sponsor.codeRotate")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="tap-target h-10 rounded-xl px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              {t("sponsor.codeRotate")}
            </button>
          )
        ) : null}
      </div>
    </Card>
  );
}
