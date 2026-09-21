"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { DeviceFrame } from "./device-frame";

/**
 * 🔴 76.75 — TWO FLOWS A PARAGRAPH CANNOT EXPLAIN, WALKED ONE SCREEN AT A TIME.
 *
 * ## Why these two and not others
 *
 * Claiming a record, and granting and revoking consent, are the two things this
 * product does that a patient has never seen any other product do. Both are
 * sequences, both turn on a single decision made at one step, and both have been
 * described on this site in a paragraph that nobody believed because a paragraph
 * is exactly what a company says when the product does something else.
 *
 * So each is a rail of steps and a phone you can click through. The thing being
 * proved is not that the screens are pretty, it is that the sequence is the one
 * claimed: the consent request cannot be answered before it is made, the
 * keeps-access box starts empty, and revoking takes one tap and asks for
 * nothing.
 *
 * ## The note under each step is the point
 *
 * Every step carries one sentence saying why it is shaped that way. A flow
 * diagram with no reasons is a screenshot gallery; the reasons are the argument,
 * and they are the part a competitor cannot copy by copying the screens.
 *
 * ## It fetches nothing
 *
 * Fixtures and local state. No action, no route, nothing that could reach a row,
 * which is what makes putting a patient-facing flow on an anonymous page safe.
 */

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/**
 * 🔴 WHAT A SCREEN CAN DO, and until this it could do nothing.
 *
 * The type used to be `screen: (t: Translate) => React.ReactNode`, invoked with
 * one argument. A screen therefore had no handle on anything: every control
 * inside the phone was a `<span>` dressed as a button, and the only thing a
 * reader could press was the "Next" button OUTSIDE the phone, underneath it.
 *
 * So a walkthrough whose whole argument is "consent is a thing you do, one tap,
 * and one tap takes it back" was demonstrated by a picture of a tap. The page
 * was making a claim about an interaction and refusing to let anybody have it.
 *
 * A screen now gets:
 *
 * - `next`, so the primary control on the screen is the thing that advances.
 *   Pressing "Yes, send the code" moves to the code screen, which is what it
 *   does in the product.
 * - `state` and `set`, so a checkbox ticks, six digits fill in, and a choice
 *   stays chosen. Local to the flow and reset on restart.
 *
 * It still fetches nothing and reaches no row. That was never the limitation.
 */
type ScreenApi = {
  t: Translate;
  /** Advance one step. The screen's own primary control calls it. */
  next: () => void;
  state: Record<string, string | boolean>;
  set: (key: string, value: string | boolean) => void;
};

type Step = {
  label: MessageKey;
  why: MessageKey;
  screen: (api: ScreenApi) => React.ReactNode;
};

/* ─────────────────────────────────────────────────────── phone furniture ── */

function Screen({
  title,
  children,
  foot,
}: {
  title: string;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-3">
      <p className="text-[15px] font-bold leading-snug text-slate-900">{title}</p>
      <div className="mt-3 flex-1 space-y-2.5">{children}</div>
      {foot ? <div className="pt-3">{foot}</div> : null}
    </div>
  );
}

function Tile({ children, tone }: { children: React.ReactNode; tone?: "brand" | "muted" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-[13px] leading-relaxed",
        tone === "brand"
          ? "border-brand-200 bg-brand-50/70 text-slate-900"
          : tone === "muted"
            ? "border-slate-200 bg-slate-50 text-slate-600"
            : "border-slate-200 bg-white text-slate-800",
      )}
    >
      {children}
    </div>
  );
}

/**
 * 🔴 A LINE FROM THE "NEVER" LIST HAS TO CARRY ITS NEGATION.
 *
 * `consent.neverWhy` is the string "Make you explain why", which is only true
 * under the heading it lives beneath on the real screen. Lifted into a demo
 * tile on its own it reads as a thing this product DOES, which is the exact
 * opposite of the promise it states. The cross is not decoration; it is the
 * other half of the sentence.
 */
function NeverTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">
      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/**
 * 🔴 A BUTTON. It was a `<span>`, nine times over, and that was the defect.
 *
 * `onClick` is required rather than optional on purpose: a control inside this
 * phone that does nothing is the thing being fixed, and an optional handler is
 * an invitation to add another one. A screen with a genuinely terminal control
 * passes `next` and lets the reader loop.
 */
function Tap({
  children,
  onClick,
  variant = "primary",
  pressed = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  /** Drawn as chosen. For a control the reader has already pressed. */
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap-target block w-full rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold transition-colors",
        variant === "primary" && "bg-brand-500 text-navy-600 hover:bg-brand-400",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" && "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        pressed && "ring-2 ring-brand-600 ring-offset-1",
      )}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────── the claim ── */

const CLAIM: Step[] = [
  {
    label: "dfl.claimStep1",
    why: "dfl.claimWhy1",
    screen: ({ t, next }) => (
      <Screen title={t("pclaim.title")}>
        <Tile>
          {t("dfl.recordFound")}
          <p className="mt-1.5 text-lg font-bold tracking-wide text-slate-900">{t("dfl.initials")}</p>
          <p className="mt-1 text-[11px] text-slate-600">{t("pclaim.initialsOnly")}</p>
        </Tile>
        <Tap onClick={next}>{t("pclaim.yesSendCode")}</Tap>
        <Tap variant="secondary" onClick={next}>
          {t("pclaim.notMe")}
        </Tap>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep2",
    why: "dfl.claimWhy2",
    screen: ({ t, next }) => (
      <Screen title={t("pclaim.handleTitle")}>
        <p className="text-[13px] leading-relaxed text-slate-600">
          {t("pclaim.handleBody", { handle: "+20 10 •• •• 41" })}
        </p>
        <Tap onClick={next}>{t("pclaim.sendCode")}</Tap>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep3",
    why: "dfl.claimWhy3",
    /*
     * 🔴 The code is TYPED, not printed.
     *
     * Six boxes with the digits already in them is a photograph of somebody
     * else having entered a code. The reader fills them, the button stays
     * disabled until all six are in, and only then does it move. That is the
     * one screen on this flow where the delay is the point: a number is not a
     * person, and the product makes you prove you hold it.
     */
    screen: ({ t, next, state, set }) => {
      const typed = String(state.code ?? "");
      const CODE = "419026";
      return (
        <Screen title={t("pclaim.checkWhatsapp")}>
          <p className="text-[13px] leading-relaxed text-slate-600">{t("pclaim.codeSent")}</p>
          <div className="flex gap-1.5">
            {CODE.split("").map((digit, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  set("code", typed.length === i ? typed + digit : CODE.slice(0, i));
                }}
                className={cn(
                  "grid h-10 flex-1 place-items-center rounded-lg border text-[15px] font-bold tabular-nums transition-colors",
                  i < typed.length
                    ? "border-brand-300 bg-brand-50 text-slate-900"
                    : i === typed.length
                      ? "border-brand-600 bg-white text-slate-400 ring-2 ring-brand-200"
                      : "border-slate-200 bg-white text-transparent",
                )}
              >
                {digit}
              </button>
            ))}
          </div>
          {typed.length < CODE.length ? (
            <p className="text-[11px] text-slate-600">{t("dfl.tapTheDigits")}</p>
          ) : null}
          <button
            type="button"
            disabled={typed.length < CODE.length}
            onClick={next}
            className="tap-target block w-full rounded-xl bg-brand-500 px-3 py-2.5 text-center text-[13px] font-semibold text-navy-600 transition-colors hover:bg-brand-400 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {t("pclaim.checkCode")}
          </button>
        </Screen>
      );
    },
  },
  {
    label: "dfl.claimStep4",
    why: "dfl.claimWhy4",
    /*
     * 🔴 §3 step 7, drawn as it is: an EMPTY box. Every version of this screen
     * anybody has ever shipped elsewhere has it pre-ticked, which is how
     * consent becomes a thing people forget to withdraw.
     *
     * And it TICKS now. The argument this whole walkthrough makes is that
     * consent is an act rather than a default, and a box that cannot be ticked
     * demonstrates the opposite of that: a decision somebody else already made.
     */
    screen: ({ t, next, state, set }) => (
      <Screen title={t("dfl.claimKeepTitle")}>
        <Tile>
          <button
            type="button"
            onClick={() => {
              set("keep", !state.keep);
            }}
            aria-pressed={Boolean(state.keep)}
            className="flex w-full items-start gap-2.5 text-start"
          >
            <span
              className={cn(
                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2 transition-colors",
                state.keep ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white",
              )}
            >
              {state.keep ? <Check className="h-3 w-3 text-white" aria-hidden /> : null}
            </span>
            {t("pclaim.keepAccess")}
          </button>
        </Tile>
        <Tile tone="muted">{t("consent.mayKeep")}</Tile>
        <Tap onClick={next}>{t("dfl.confirm")}</Tap>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep5",
    why: "dfl.claimWhy5",
    screen: ({ t, next }) => (
      <Screen title={t("pclaim.doneTitle")}>
        <Tile tone="brand">
          <span className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            {t("pclaim.doneDropped")}
          </span>
        </Tile>
        <Tap onClick={next}>{t("pclaim.goToSessions")}</Tap>
      </Screen>
    ),
  },
];

/* ────────────────────────────────────────────────────────── the consent ── */

const CONSENT: Step[] = [
  {
    label: "dfl.consentStep1",
    why: "dfl.consentWhy1",
    screen: ({ t, next }) => (
      <Screen title={t("consent.waiting")}>
        <Tile>
          <span className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
            {t("dfl.askedBy", { name: t("dfl.demoTherapist") })}
          </span>
        </Tile>
        <NeverTile>{t("consent.neverBefore")}</NeverTile>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep2",
    why: "dfl.consentWhy2",
    /*
     * Three answers, and all three are real. "No" advances too: the flow's
     * next screen is the list of who has access, and a reader who said no
     * should be able to see that the answer was taken.
     */
    screen: ({ t, next, state, set }) => (
      <Screen title={t("consent.pageTitle")}>
        {(
          [
            ["day", "consent.yesDay", "primary"],
            ["until", "consent.yesUntil", "secondary"],
            ["no", "consent.no", "secondary"],
          ] as const
        ).map(([key, label, variant]) => (
          <Tap
            key={key}
            variant={variant}
            pressed={state.grant === key}
            onClick={() => {
              set("grant", key);
              next();
            }}
          >
            {t(label)}
          </Tap>
        ))}
        <p className="pt-1 text-[12px] leading-relaxed text-slate-600">{t("consent.noCost")}</p>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep3",
    why: "dfl.consentWhy3",
    screen: ({ t, next }) => (
      <Screen title={t("consent.whoHasAccess")}>
        <Tile tone="brand">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
              {t("dfl.demoTherapist")}
            </span>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-teal-800 uppercase">
              {t("consent.canRead")}
            </span>
          </span>
          <span className="mt-1.5 block text-[11px] text-slate-600">
            {t("consent.untilChange")}
          </span>
        </Tile>
        <Tile tone="muted">{t("consent.mayRead")}</Tile>
        <Tap variant="danger" onClick={next}>
          {t("consent.stop")}
        </Tap>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep4",
    why: "dfl.consentWhy4",
    screen: ({ t, next }) => (
      <Screen title={t("consent.whoHasAccess")}>
        <Tile>
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
            {t("dfl.demoTherapist")}
          </span>
        </Tile>
        {/*
          The tap. No dialog asking why, because the product does not ask, and
          it is a real one now: press it and access ends on the next screen.
          This step exists to show that there is nothing between the press and
          the consequence, which a `<span>` could not show.
        */}
        <button
          type="button"
          onClick={next}
          className="tap-target block w-full rounded-xl bg-red-600 px-3 py-2.5 text-center text-[13px] font-semibold text-white ring-4 ring-red-200 transition-colors hover:bg-red-700"
        >
          {t("consent.stop")}
        </button>
        <NeverTile>{t("consent.neverWhy")}</NeverTile>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep5",
    why: "dfl.consentWhy5",
    screen: ({ t, next }) => (
      <Screen title={t("consent.whoHasAccess")}>
        <Tile>
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
              {t("dfl.demoTherapist")}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-600 uppercase">
              {t("consent.cannotRead")}
            </span>
          </span>
        </Tile>
        <Tile tone="muted">{t("consent.mayKeep")}</Tile>
        <NeverTile>{t("consent.neverAfter")}</NeverTile>
      </Screen>
    ),
  },
];

/* ──────────────────────────────────────────────────────────── the shell ── */

function StepFlow({ steps, title, body }: { steps: Step[]; title: string; body: string }) {
  const t = useT();
  const [at, setAt] = useState(0);
  /*
   * 🔴 The state a screen can change. One object per flow, cleared on restart.
   *
   * It is deliberately a bag of strings and booleans rather than a typed shape
   * per flow: this is a demo with nine controls in it, and a discriminated
   * union per step would be more machinery than the thing it drives. Nothing
   * here reaches a row, so the worst a wrong key can do is fail to tick a box.
   */
  const [state, setState] = useState<Record<string, string | boolean>>({});
  const step = steps[at];
  if (!step) return null;

  /*
   * The last screen's own control loops back to the start rather than dead
   * ending. Every control in this phone does something; a terminal one that
   * did nothing would be the defect coming back in one place.
   */
  const next = () => {
    setAt((i) => {
      if (i >= steps.length - 1) {
        setState({});
        return 0;
      }
      return i + 1;
    });
  };
  const set = (key: string, value: string | boolean) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <h2 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{body}</p>
        </div>

        <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_auto] lg:gap-12">
          <div>
            {/* The rail. Every step is reachable, so a reader who only wants
                the revoke step does not have to click through four others. */}
            <ol className="space-y-1">
              {steps.map((one, i) => {
                const done = i < at;
                const now = i === at;
                return (
                  <li key={one.label}>
                    <button
                      type="button"
                      onClick={() => { setAt(i); }}
                      aria-current={now ? "step" : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                        now ? "bg-brand-50" : "hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                          now
                            ? "bg-brand-500 text-navy-600"
                            : done
                              ? "bg-teal-100 text-teal-700"
                              : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-[14px] font-semibold",
                            now ? "text-brand-800" : "text-slate-900",
                          )}
                        >
                          {t(one.label)}
                        </span>
                        {now ? (
                          <span className="mt-1 block text-[13px] leading-relaxed text-slate-700">
                            {t(one.why)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 flex items-center gap-2 px-3">
              <button
                type="button"
                onClick={() => { setAt((i) => Math.max(0, i - 1)); }}
                disabled={at === 0}
                className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                {t("dfl.back")}
              </button>
              {at === steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => { setAt(0); setState({}); }}
                  className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-navy-500 px-3 py-2 text-[13px] font-semibold text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {t("dfl.restart")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAt((i) => Math.min(steps.length - 1, i + 1)); }}
                  className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-[13px] font-semibold text-navy-600"
                >
                  {t("dfl.next")}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                </button>
              )}
              <span className="ms-auto text-[12px] tabular-nums text-slate-600">
                {t("dfl.stepOf", { n: at + 1, total: steps.length })}
              </span>
            </div>
          </div>

          <DeviceFrame as="phone" nav={false}>
            {step.screen({ t, next, state, set })}
          </DeviceFrame>
        </div>
      </div>
    </section>
  );
}

export function ClaimFlowDemo() {
  const t = useT();
  return <StepFlow steps={CLAIM} title={t("dfl.claimTitle")} body={t("dfl.claimBody")} />;
}

export function ConsentFlowDemo() {
  const t = useT();
  return <StepFlow steps={CONSENT} title={t("dfl.consentTitle")} body={t("dfl.consentBody")} />;
}
