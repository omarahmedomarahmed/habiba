"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Check } from "lucide-react";

import { saveLimit } from "@/app/(partner)/partner/actions";
import { Badge, Button, Card, Field, Glow, Input, PageHeader } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";
import { cn } from "@/lib/utils";

/**
 * The limit they set, and what the month is heading for. PLAN.md 68.15 to 68.18.
 *
 * ## 🔴 THREE NUMBERS, AND THE THIRD IS THE ONE THAT CHANGES ANYTHING
 *
 * The limit, the spend, and the projection. An integrator looking at "412 of 500" on
 * the 3rd of the month reads it as comfortable; "on course for 780" is the same two
 * numbers saying something they have to act on. So the three share one dark card, the
 * figure the portal is read in, and the projection sits right under the meter.
 *
 * ## 🔴 AND WHAT HAPPENS AT THE LIMIT IS STATED BEFORE IT HAPPENS
 *
 * Every metered API an integrator has ever used bills overage at the ceiling, so they
 * will assume this one does too unless the screen where they set the number says
 * otherwise. It does, in the words the ruling uses: their product keeps working, ours
 * stops, and we do not bill for a session we did not do.
 */
export function UsageMeter({
  limit,
  used,
  projected,
  stopped,
  canChange,
  periodLabel,
  lastMonth,
}: {
  limit: number;
  used: number;
  projected: number;
  stopped: boolean;
  canChange: boolean;
  periodLabel: string;
  /** 🔴 68.19 — the closed month, read from the same function the cron posts from. */
  lastMonth: {
    label: string;
    sessions: number;
    perSessionCents: number;
    totalCents: number;
    /** Posted to the books, so it is an invoice rather than a preview. */
    posted: boolean;
    /** When staff marked it paid, formatted on the server (C84), or null. */
    paidOn: string | null;
  } | null;
}) {
  const t = useT();
  const [wanted, setWanted] = useState(String(limit));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(share * 100);

  return (
    <div>
      <PageHeader title={t("dev.usage.title")} subtitle={t("dev.usage.body", { period: periodLabel })} />

      <div className="space-y-4 px-4 sm:px-6">
        {/*
          🔴 68.18 — THE STOP IS EXPLICIT AND IT IS THE FIRST THING ON THE PAGE.

          A copilot that vanishes without a word is read as our outage, and their
          therapist is mid-session. This is the screen the person who can fix it is
          looking at, so the fix is the button beside the sentence.
        */}
        {stopped ? (
          <div role="status" className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-[15px] font-bold text-amber-900">{t("dev.usage.stopped")}</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">{t("dev.usage.stoppedBody")}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-6 text-white lg:col-span-3">
            <Glow className="-end-16 -top-16 h-52 w-52 opacity-60" />
            <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[44px] leading-none font-bold tabular-nums">{used}</p>
              <p className="text-[15px] text-white/70">
                {t("dev.usage.ofLimit", { limit: limit > 0 ? limit : t("dev.usage.noLimitSet") })}
              </p>
            </div>

            {limit > 0 ? (
              <>
                <div
                  className="relative mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t("dev.usage.meter")}
                >
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      share >= 0.9 ? "bg-red-500" : share >= 0.8 ? "bg-amber-400" : "bg-brand-500",
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>

                {/*
                  🔴 THE PROJECTION, and it says what it means rather than a number
                  beside a word nobody parses.
                */}
                <p className="relative mt-4 text-sm leading-relaxed text-white/80">
                  {rich(
                    t(projected > limit ? "dev.usage.projectedOver" : "dev.usage.projectedUnder", {
                      count: slot(0),
                      limit,
                    }),
                    [
                      <strong key="count" className="font-bold text-brand-300 tabular-nums">
                        {projected}
                      </strong>,
                    ],
                  )}
                </p>
              </>
            ) : (
              <p className="relative mt-4 text-sm leading-relaxed text-white/80">{t("dev.usage.noLimit")}</p>
            )}
          </div>

          {/*
            🔴 68.19 — THE BILL, FROM REAL USAGE, ON THE SAME LEDGER EVERYTHING ELSE IS.

            Arithmetic somebody can check: sessions, times the price, equals the total.
            A bill an integrator cannot reproduce from two numbers on a screen is a bill
            that produces a support conversation every month.
          */}
          {lastMonth ? (
            <Card className="p-6 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[13px] font-semibold text-navy-400">{lastMonth.label}</p>
                {/*
                  How this bill is paid, and whether it has been: invoiced at month
                  end, paid by bank transfer, marked paid by our staff when it lands.
                */}
                {lastMonth.posted ? (
                  <Badge tone={lastMonth.paidOn ? "green" : "amber"}>
                    {lastMonth.paidOn ? t("dev.usage.paid", { date: lastMonth.paidOn }) : t("dev.usage.unpaid")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-3 text-[34px] leading-none font-bold tabular-nums text-navy-700">
                ${(lastMonth.totalCents / 100).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-navy-500">
                {rich(
                  t("dev.usage.lastMonth", {
                    count: slot(0),
                    price: `$${(lastMonth.perSessionCents / 100).toFixed(2)}`,
                  }),
                  [
                    <strong key="count" className="font-semibold tabular-nums text-navy-700">
                      {lastMonth.sessions}
                    </strong>,
                  ],
                )}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-navy-400">{t("dev.usage.howPaid")}</p>
            </Card>
          ) : null}
        </div>

        {canChange ? (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <Field label={t("dev.usage.perMonth")} htmlFor="partner-limit">
                  <Input
                    id="partner-limit"
                    type="number"
                    min={0}
                    className="tabular-nums"
                    value={wanted}
                    onChange={(event) => {
                      setWanted(event.target.value);
                      setSaved(false);
                    }}
                  />
                </Field>
              </div>
              <Button
                type="button"
                className="h-12"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await saveLimit(Number(wanted));
                    setError(result.error ?? null);
                    setSaved(!result.error);
                  })
                }
              >
                {pending ? t("common.saving") : t("dev.usage.save")}
              </Button>
            </div>

            {error ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800">
                <Check className="h-4 w-4" aria-hidden />
                {t("common.saved")}
              </p>
            ) : null}

            {/*
              🔴 68.16 / 68.17 — the rule, on the screen where the number is typed.

              An integrator sets this expecting the industry default, which is an
              overage charge at the ceiling. Three sentences here are cheaper than a
              support conversation after a month where their therapists lost the
              copilot and nobody could say why.
            */}
            <p className="mt-4 text-[13px] leading-relaxed text-navy-400">{t("dev.usage.rule")}</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
