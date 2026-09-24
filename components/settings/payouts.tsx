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
import { Money } from "@/components/ui/money";
import { FlowStrip, SplitBar } from "@/components/visual/primitives";
import { useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";

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
  /**
   * 🔴 76.34 — WHO THIS IS, AT THE TOP, BESIDE THE COUNTRY.
   *
   * The country decides which of our companies bills them, which currency they
   * are asked for, and whether they will ever see a Stripe screen. It was the
   * fourth field of a form halfway down the page, under the session price, so
   * the one answer that changes everything else on the screen was read after
   * everything it changes.
   *
   * The name and the licence are here because they are what makes it read as
   * "this is you, and this is where you practise" rather than as another
   * setting. They are not editable here: that is the profile form above.
   */
  name: string;
  license: string | null;
  /**
   * 🔴 76.34 — HOW THEY WOULD LIKE TO BE PAID, on the rail where we pay them by
   * hand.
   *
   * It lived only on `/earnings`, inside a component rendered when there is
   * money held or a past request. So an Egyptian clinician who had not yet
   * earned anything could not tell us where to send it, and the first time they
   * were asked was the moment they wanted it.
   *
   * Null means nothing is set, which is a thing to say rather than a blank.
   */
  payoutMethod: { method: string; identifier: string; accountName: string } | null;
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
  /*
   * 🔴 76.34 — HELD IN STATE, so the whole screen changes as they choose.
   *
   * Picking Egypt and then reading three Stripe steps that will never apply to
   * them is worse than not asking: it teaches somebody that the setting did not
   * work. The view follows the select immediately and the form says the choice
   * is not saved until they press the button, which is the honest version of
   * the same thing.
   */
  const [region, setRegion] = useState(state.practiceRegion ?? "us");
  /*
   * 🔴 EGYPT IS THE MANUAL RAIL, and that is a fact about the country rather
   * than about this account's Stripe status. `collectionRailFor` says the same
   * thing on the server; this is the screen agreeing with it.
   *
   * A clinician on a clinic's roster has `practiceRegion === null` and does not
   * choose: the jurisdiction belongs to the clinic. They keep whatever view
   * their practice's region gives them, which is why this reads the state
   * rather than the select in that case.
   */
  const manualRail = region === "eg";

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
      {/*
        🔴 76.34 — WHO YOU ARE AND WHERE YOU PRACTISE, FIRST.
        ------------------------------------------------------
        The country was the fourth field of a form halfway down this card, under
        the session price. It decides which of our companies bills this person,
        which currency they are asked for, and whether they will ever see a
        Stripe screen at all, so every other control here is downstream of it and
        every one of them was above it.

        It sits with the name and the licence because that is what makes it read
        as an identity rather than as a preference. Neither of those is editable
        here; the profile form on the same page owns them.
      */}
      <div className="-m-4 mb-4 rounded-t-2xl border-b border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-base font-bold tracking-tight text-slate-900">{state.name}</p>
          {state.license ? (
            <p className="text-xs text-slate-500">{state.license}</p>
          ) : null}
        </div>

        {state.practiceRegion !== null ? (
          <div className="mt-3">
            <label
              htmlFor="practice-region"
              className="text-xs font-semibold text-slate-700"
            >
              {t("tpay.whereYouPractise")}
            </label>
            <select
              id="practice-region"
              name="practiceRegion"
              form="payment-settings"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="us">{t("tpay.regionUs")}</option>
              <option value="eg">{t("tpay.regionEg")}</option>
            </select>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t("tpay.whereYouPractiseBody")}
            </p>
            {/*
              🔴 THE VIEW HAS ALREADY CHANGED AND THE SETTING HAS NOT.
              Saying so is the honest version of a screen that updates live: a
              clinician who sees the Stripe box disappear and assumes it is
              saved has not saved it.
            */}
            {region !== state.practiceRegion ? (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                {t("tpay.regionUnsaved")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
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
            {/*
              🔴 76.34 — ON THE MANUAL RAIL NONE OF THE THREE STRIPE SENTENCES
              IS TRUE, and "payouts are not switched on" is the worst of them:
              it reads as something the clinician has failed to do, about a
              thing they cannot do and do not need.
            */}
            {manualRail
              ? state.heldCents > 0
                ? rich(t("tpay.egHolding", { amount: slot(0) }), [<Money cents={state.heldCents} />])
                : t("tpay.egRail")
              : state.heldCents > 0
                ? rich(t("tpay.holding", { amount: slot(0) }), [<Money cents={state.heldCents} />])
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
      {/*
        🔴 76.34 — THE WHOLE STRIPE BOX IS ABSENT IN EGYPT, not disabled.
        -----------------------------------------------------------------
        Three numbered steps, a "Set up payouts" button, two status chips, an
        available balance, a "Pay out now" and a link to a Stripe dashboard.
        Every one of them is about a rail that does not run in this country, and
        a clinician in Cairo was shown all of it and told their payouts were not
        switched on.

        Absent rather than disabled, which is the same ruling 74.6 made about
        the country select for a clinic's clinician: a disabled control invites
        somebody to ask why and then to ask support. An absent one is answered
        by the two lines that replace it.

        What is left is exactly what the founder asked for and what is true
        here: what a session costs, and how they would like to be paid.
      */}
      {!manualRail ? (
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
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/*
        🔴 76.34 — WHAT REPLACES THE STRIPE BOX IN EGYPT.

        Two facts, and they are the two the founder named: what a session costs,
        which is the form below, and how this person would like to be paid,
        which had no home on this screen at all. It lived on `/earnings` inside
        a component that renders only once there is money held, so the first
        time anybody was asked where to send their earnings was the moment they
        wanted them.
      */}
      {manualRail ? (
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">{t("tpay.egMethod")}</p>
          {state.payoutMethod ? (
            <>
              <p className="mt-1 text-sm text-slate-700">
                {t(`tpay.method.${state.payoutMethod.method}` as "tpay.method.instapay")}
                {" · "}
                <span className="font-mono text-xs select-all">
                  {state.payoutMethod.identifier}
                </span>
              </p>
              {/*
                🔴 §3c — THE NAME EXACTLY AS THE RECEIVING ACCOUNT HAS IT.
                A transfer to "M. Ali" against an account registered to "Mohamed
                Ali Hassan" bounces after a person has already done the work, so
                the name is shown back rather than assumed correct.
              */}
              <p className="mt-0.5 text-xs text-slate-500">{state.payoutMethod.accountName}</p>
            </>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{t("tpay.egMethodNone")}</p>
          )}
          <a
            href="/earnings"
            className="mt-3 inline-flex text-sm font-semibold text-brand-700"
          >
            {state.payoutMethod ? t("tpay.egMethodChange") : t("tpay.egMethodSet")}
          </a>
        </div>
      ) : null}

      {manualRail ? null : !state.connected ? (
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
                  <Money cents={state.availableCents} />
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden />
                  {t("tpay.clearing")}
                </dt>
                <dd className="mt-0.5 text-2xl font-bold text-slate-900">
                  <Money cents={state.pendingCents ?? 0} />
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {state.payoutsEnabled && (state.availableCents ?? 0) > 0 ? (
              <Button disabled={pending} onClick={() => run(payOutNow)}>
                {pending
                  ? t("tpay.requesting")
                  : rich(t("tpay.payOut", { amount: slot(0) }), [<Money cents={state.availableCents ?? 0} />])}
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

      {/*
        🔴 `id`, because the country select lives in the header at the top of
        this card and posts here through `form="payment-settings"`. One form,
        one save button, and the field that changes everything is where somebody
        reads it first.
      */}
      <form
        id="payment-settings"
        action={formAction}
        className="mt-5 space-y-4 border-t border-slate-100 pt-4"
      >
        {formState.ok ? <p className="text-sm text-emerald-700">{t("common.saved")}</p> : null}
        {formState.error ? <p className="text-sm text-red-600">{formState.error}</p> : null}

        <Field
          label={t("tpay.rateLabel")}
          htmlFor="rateDollars"
          hint={t("tpay.rateHint")}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-slate-500">
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
          🔴 76.34 — THE COUNTRY USED TO BE HERE, and it is at the top of the
          card now, beside the name and the licence.

          It decides which of our companies bills them, which currency they are
          asked for, and whether a Stripe screen exists for them at all. Every
          other control on this card is downstream of that answer and every one
          of them was above it. It posts into this form through `form=`, so
          there is still one save button and one action.
        */}

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
                { label: <>{t("tpay.youKeep")} <Money cents={keep} /></>, value: keep, kind: "keep" },
                {
                  label: <>{t("tpay.fee", { percent: (state.feeBps / 100).toFixed(0) })} <Money cents={cut} /></>,
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
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">
              {t("tpay.autoSettle")}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
              {t("tpay.autoSettleBody")}
              {state.outstandingCents > 0 ? (
                <> {rich(t("tpay.owedNow", { amount: slot(0) }), [<Money cents={state.outstandingCents} />])}</>
              ) : null}
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
