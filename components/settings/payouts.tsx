"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpRight, BadgeCheck, Banknote, Clock, Wallet } from "lucide-react";

import {
  connectPayouts,
  openPayoutDashboard,
  payOutNow,
  updatePaymentSettings,
  type SettingsState,
} from "@/app/(app)/settings/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { FlowStrip, SplitBar } from "@/components/visual/primitives";
import { useT } from "@/lib/i18n/client";

const INITIAL: SettingsState = {};

export type PayoutState = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  sessionRateCents: number;
  /** 16.5 — the currency that number is denominated in. */
  rateCurrency: string;
  /**
   * 🔴 74.6 — where this practice bills from, and null when it is not theirs to
   * set because they are on a clinic's roster.
   */
  practiceRegion: string | null;
  autoSettleFromEarnings: boolean;
  availableCents: number | null;
  pendingCents: number | null;
  outstandingCents: number;
  feeBps: number;
  /** Taken on their behalf before Stripe verified them, and not yet released. */
  heldCents: number;
};

function Saving({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.saving") : label}
    </Button>
  );
}

/**
 * Payouts and pricing.
 *
 * The platform cut is shown live as the therapist types a rate, not buried in a
 * fee schedule. A percentage someone discovers on their first statement is a
 * percentage they resent, and this is the screen where they decide whether the
 * arrangement is fair.
 */
export function PayoutSettings({ state }: { state: PayoutState }) {
  const [formState, formAction] = useActionState(updatePaymentSettings, INITIAL);
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(
    state.sessionRateCents > 0 ? String(state.sessionRateCents / 100) : "",
  );
  const [currency, setCurrency] = useState(state.rateCurrency);

  const sessionRateCents = Math.round((Number(rate) || 0) * 100);
  const cut = Math.floor((sessionRateCents * state.feeBps) / 10_000);
  const keep = Math.max(0, sessionRateCents - cut);

  const run = (fn: () => Promise<SettingsState>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Wallet className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t("tpay.title")}</p>
          {/*
            The old line — "the money goes straight to your own Stripe account,
            we never hold it" — was a promise the product can no longer make
            unconditionally, and a promise that is true most of the time is the
            worst kind to leave on a screen about money.
          */}
          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
            {state.heldCents > 0
              ? t("tpay.holding", { amount: formatUsd(state.heldCents) })
              : state.payoutsEnabled
                ? t("tpay.enabled")
                : t("tpay.notEnabled")}
          </p>
        </div>
      </div>

      {/*
        🔴 65.10 — THE PAYOUT RAIL, AS A FLOW WITH THE CLINICIAN'S POSITION ON IT.

        > *The verification requirements, the fee explanation, the payout rails and the
        > consent rules become components.*

        This screen said one of three sentences depending on where somebody was, and each
        described a state without showing the other two. A clinician being held is not in
        an error: they are at step two of three, their money is safe, and the thing that
        moves it is Stripe rather than anything they can do. A sentence cannot say that
        without saying all of it; three numbered steps with a tick on the ones behind you
        say it at a glance.

        🔴 65.22 — AND IT IS NUMBERED BECAUSE IT IS A SEQUENCE. Step three cannot happen
        before step two, which is the whole reason a held balance is not a problem.
      */}
      <div className="mt-4">
        <FlowStrip
          steps={[
            { title: t("tpay.rail1"), detail: t("tpay.rail1Body") },
            { title: t("tpay.rail2"), detail: t("tpay.rail2Body") },
            { title: t("tpay.rail3"), detail: t("tpay.rail3Body") },
          ]}
          done={state.payoutsEnabled ? 2 : state.connected ? 0 : -1}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!state.connected ? (
        <div className="mt-4">
          <Button full size="lg" disabled={pending} onClick={() => run(connectPayouts)}>
            <Banknote className="h-4 w-4" aria-hidden />
            {pending ? t("tpay.openingStripe") : t("tpay.setUp")}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {t("tpay.setUpBody")}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusChip
              ok={state.chargesEnabled}
              okLabel={t("tpay.chargesOk")}
              waitLabel={t("tpay.chargesWait")}
            />
            <StatusChip
              ok={state.payoutsEnabled}
              okLabel={t("tpay.payoutsOk")}
              waitLabel={t("tpay.payoutsWait")}
            />
          </div>

          {!state.chargesEnabled ? (
            <div className="mt-3">
              <Button variant="secondary" disabled={pending} onClick={() => run(connectPayouts)}>
                {pending ? t("tpay.openingStripe") : t("tpay.finishStripe")}
              </Button>
            </div>
          ) : null}

          {state.availableCents !== null ? (
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs text-slate-500">{t("tpay.available")}</dt>
                <dd className="mt-0.5 text-2xl font-bold text-slate-900">
                  {formatUsd(state.availableCents)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden />
                  {t("tpay.clearing")}
                </dt>
                <dd className="mt-0.5 text-2xl font-bold text-slate-900">
                  {formatUsd(state.pendingCents ?? 0)}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {state.payoutsEnabled && (state.availableCents ?? 0) > 0 ? (
              <Button disabled={pending} onClick={() => run(payOutNow)}>
                {pending
                  ? t("tpay.requesting")
                  : t("tpay.payOut", { amount: formatUsd(state.availableCents ?? 0) })}
              </Button>
            ) : null}
            <Button variant="secondary" disabled={pending} onClick={() => run(openPayoutDashboard)}>
              {t("tpay.dashboard")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {t("tpay.dailyNote")}
          </p>
        </>
      )}

      <form action={formAction} className="mt-5 space-y-4 border-t border-slate-100 pt-4">
        {formState.ok ? <p className="text-sm text-emerald-700">{t("common.saved")}</p> : null}
        {formState.error ? <p className="text-sm text-red-600">{formState.error}</p> : null}

        <Field
          label={t("tpay.rateLabel")}
          htmlFor="rateDollars"
          hint={t("tpay.rateHint")}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-slate-400">
                {currency === "egp" ? "E£" : "$"}
              </span>
              <Input
                id="rateDollars"
                name="rateDollars"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                className="ps-9"
                placeholder="60"
              />
            </div>

            {/*
              16.5 — price in either currency. The number is stored in the
              currency chosen, not converted: a rate meant to stay 1,500 EGP
              must not drift because the market did.
            */}
            <select
              name="rateCurrency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              aria-label={t("tpay.currency")}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="usd">USD</option>
              <option value="egp">EGP</option>
            </select>
          </div>
        </Field>

        {/*
          🔴 74.6 — WHERE THEY PRACTISE, WHICH IS NOT THE SAME QUESTION AS WHAT
          THEY PRICE IN.

          It decides which of our companies bills them and therefore how they pay
          us: a practice in Egypt is invoiced and pays by InstaPay or bank
          transfer, because there is no card rail there yet. Somebody in Cairo
          may still price in dollars, so the two selects are two answers.

          Rendered only for a practice of one. A clinic's jurisdiction belongs to
          the clinic, and one clinician must not be able to move which company
          bills their colleagues.
        */}
        {state.practiceRegion !== null ? (
          <Field label={t("tpay.whereYouPractise")} htmlFor="practice-region">
            <select
              id="practice-region"
              name="practiceRegion"
              defaultValue={state.practiceRegion}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="us">{t("tpay.regionUs")}</option>
              <option value="eg">{t("tpay.regionEg")}</option>
            </select>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t("tpay.whereYouPractiseBody")}
            </p>
          </Field>
        ) : null}

        {/*
          🔴 65.10 — THE SAME SPLIT BAR THE SESSION FORM DRAWS.

          *The fee split is a diagram, not a paragraph about a diagram.* It was two rows
          of a table here and a sentence on the new-session form, which is the same fact
          in two shapes: 65.4's rule is that the same rule on two screens has to look like
          the same rule, and a clinician who has learned to read the bar once should not
          have to read a table the second time.
        */}
        {sessionRateCents > 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <SplitBar
              parts={[
                { label: `${t("tpay.youKeep")} ${formatUsd(keep)}`, value: keep, kind: "keep" },
                {
                  label: `${t("tpay.fee", { percent: (state.feeBps / 100).toFixed(0) })} ${formatUsd(cut)}`,
                  value: cut,
                  kind: "fee",
                },
              ]}
            />
          </div>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            name="autoSettle"
            defaultChecked={state.autoSettleFromEarnings}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">
              {t("tpay.autoSettle")}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
              {t("tpay.autoSettleBody")}
              {state.outstandingCents > 0
                ? ` ${t("tpay.owedNow", { amount: formatUsd(state.outstandingCents) })}`
                : ""}
            </span>
          </span>
        </label>

        <Saving label={t("tpay.saveSettings")} />
      </form>
    </Card>
  );
}

function StatusChip({
  ok,
  okLabel,
  waitLabel,
}: {
  ok: boolean;
  okLabel: string;
  waitLabel: string;
}) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          : "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
      }
    >
      {ok ? <BadgeCheck className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
      {ok ? okLabel : waitLabel}
    </span>
  );
}
