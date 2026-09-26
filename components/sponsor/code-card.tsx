"use client";

import { useState, useTransition } from "react";
import { Printer } from "lucide-react";

import { createCode, replaceCode } from "@/app/(sponsor)/sponsor/code/actions";
import { buttonClass, Card } from "@/components/clinician/kit";
import { cn } from "@/lib/utils";

import { ConfirmAct } from "./confirm-act";
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
  attempts,
  spike,
}: {
  code: string;
  /** Generated on the server so no third party sees our customer's code. */
  qrDataUri: string;
  posterLine: string;
  canRotate: boolean;
  /**
   * 🔴 53.19 — a COUNT, and there is nowhere on this component to put a name.
   *
   * The props carry a number and a boolean. Not a list of attempts, not an
   * identifier, not a time of day: a list of attempted employee numbers is a list of
   * people who tried, and half of them are real staff who mistyped.
   */
  attempts: number;
  spike: boolean;
}) {
  const t = useT();

  return (
    <Card className="p-5 sm:p-6 print:border-0 print:shadow-none">
      {/*
        The printable block. `print:` utilities rather than a separate print
        route: one document means the thing on the wall is provably the thing the
        sponsor looked at.
      */}
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className="rounded-3xl bg-white p-3 ring-1 ring-navy-100 shadow-[0_8px_24px_-12px_rgba(10,35,66,0.18)] print:shadow-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URI, not a remote asset */}
          <img src={qrDataUri} alt={code} width={256} height={256} className="h-56 w-56 sm:h-64 sm:w-64" />
        </div>

        <p
          dir="ltr"
          className="rounded-2xl bg-navy-50 px-5 py-2.5 font-mono text-2xl font-bold tracking-[0.2em] text-navy-700 ring-1 ring-navy-100 sm:text-3xl"
        >
          {code}
        </p>

        <p className="max-w-sm text-[15px] leading-relaxed text-navy-400">{posterLine}</p>
      </div>

      {/*
        🔴 53.19 — the number, and the sentence only when it means something.
        Printed out of the poster block, because a count of guesses is not something
        to put on a wall.
      */}
      <div className="mt-4 border-t border-navy-100 pt-4 print:hidden">
        <p className="text-[13px] font-semibold text-navy-400">{t("sponsor.attempts", { count: attempts })}</p>
        {spike ? (
          <p className="mt-1 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            {t("sponsor.attemptsHigh")}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-navy-100 pt-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonClass("primary", "md")}
        >
          <Printer className="h-4 w-4" aria-hidden />
          {t("sponsor.codePrint")}
        </button>

        {canRotate ? (
          /* W2-S04: a Cancel beside the red button, and a line once it is done. */
          <ConfirmAct
            label={t("sponsor.codeRotate")}
            body={t("sponsor.codeRotateBody")}
            done={t("sponsor.codeRotated")}
            act={() => replaceCode()}
          />
        ) : null}
      </div>
    </Card>
  );
}

/**
 * W2-S03: the first code, pressed by the company. `createCode` refuses when a
 * code is already live, so this can never do what "Replace this code" does.
 */
export function CreateCode() {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await createCode();
            setError(result.error ?? null);
          })
        }
        className={cn(buttonClass("primary", "md"), "disabled:opacity-50")}
      >
        {t("sponsor.codeCreate")}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
