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

type Step = {
  label: MessageKey;
  why: MessageKey;
  screen: (t: Translate) => React.ReactNode;
};

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

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
      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function FakeButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <span
      className={cn(
        "block rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold",
        variant === "primary" && "bg-brand-600 text-white",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-700",
        variant === "danger" && "border border-red-200 bg-red-50 text-red-700",
      )}
    >
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────── the claim ── */

const CLAIM: Step[] = [
  {
    label: "dfl.claimStep1",
    why: "dfl.claimWhy1",
    screen: (t) => (
      <Screen title={t("pclaim.title")}>
        <Tile>
          {t("dfl.recordFound")}
          <p className="mt-1.5 text-lg font-bold tracking-wide text-slate-900">{t("dfl.initials")}</p>
          <p className="mt-1 text-[11px] text-slate-500">{t("pclaim.initialsOnly")}</p>
        </Tile>
        <FakeButton>{t("pclaim.yesSendCode")}</FakeButton>
        <FakeButton variant="secondary">{t("pclaim.notMe")}</FakeButton>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep2",
    why: "dfl.claimWhy2",
    screen: (t) => (
      <Screen title={t("pclaim.handleTitle")}>
        <p className="text-[13px] leading-relaxed text-slate-600">
          {t("pclaim.handleBody", { handle: "+20 10 •• •• 41" })}
        </p>
        <FakeButton>{t("pclaim.sendCode")}</FakeButton>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep3",
    why: "dfl.claimWhy3",
    screen: (t) => (
      <Screen title={t("pclaim.checkWhatsapp")}>
        <p className="text-[13px] leading-relaxed text-slate-600">{t("pclaim.codeSent")}</p>
        <div className="flex gap-1.5">
          {["4", "1", "9", "0", "2", "6"].map((digit, i) => (
            <span
              key={i}
              className="grid h-10 flex-1 place-items-center rounded-lg border border-slate-200 bg-white text-[15px] font-bold tabular-nums text-slate-900"
            >
              {digit}
            </span>
          ))}
        </div>
        <FakeButton>{t("pclaim.checkCode")}</FakeButton>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep4",
    why: "dfl.claimWhy4",
    screen: (t) => (
      <Screen title={t("dfl.claimKeepTitle")}>
        {/*
         * 🔴 §3 step 7, drawn as it is: an EMPTY box. Every version of this
         * screen anybody has ever shipped elsewhere has it pre-ticked, which is
         * how consent becomes a thing people forget to withdraw.
         */}
        <Tile>
          <span className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2 border-slate-300 bg-white" />
            {t("pclaim.keepAccess")}
          </span>
        </Tile>
        <Tile tone="muted">{t("consent.mayKeep")}</Tile>
        <FakeButton>{t("dfl.confirm")}</FakeButton>
      </Screen>
    ),
  },
  {
    label: "dfl.claimStep5",
    why: "dfl.claimWhy5",
    screen: (t) => (
      <Screen title={t("pclaim.doneTitle")}>
        <Tile tone="brand">
          <span className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            {t("pclaim.doneDropped")}
          </span>
        </Tile>
        <FakeButton>{t("pclaim.goToSessions")}</FakeButton>
      </Screen>
    ),
  },
];

/* ────────────────────────────────────────────────────────── the consent ── */

const CONSENT: Step[] = [
  {
    label: "dfl.consentStep1",
    why: "dfl.consentWhy1",
    screen: (t) => (
      <Screen title={t("consent.waiting")}>
        <Tile>
          <span className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
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
    screen: (t) => (
      <Screen title={t("consent.pageTitle")}>
        <FakeButton>{t("consent.yesDay")}</FakeButton>
        <FakeButton variant="secondary">{t("consent.yesUntil")}</FakeButton>
        <FakeButton variant="secondary">{t("consent.no")}</FakeButton>
        <p className="pt-1 text-[12px] leading-relaxed text-slate-600">{t("consent.noCost")}</p>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep3",
    why: "dfl.consentWhy3",
    screen: (t) => (
      <Screen title={t("consent.whoHasAccess")}>
        <Tile tone="brand">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
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
        <FakeButton variant="danger">{t("consent.stop")}</FakeButton>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep4",
    why: "dfl.consentWhy4",
    screen: (t) => (
      <Screen title={t("consent.whoHasAccess")}>
        <Tile>
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {t("dfl.demoTherapist")}
          </span>
        </Tile>
        {/* The tap. No dialog asking why, because the product does not ask. */}
        <span className="block rounded-xl bg-red-600 px-3 py-2.5 text-center text-[13px] font-semibold text-white ring-4 ring-red-200">
          {t("consent.stop")}
        </span>
        <NeverTile>{t("consent.neverWhy")}</NeverTile>
      </Screen>
    ),
  },
  {
    label: "dfl.consentStep5",
    why: "dfl.consentWhy5",
    screen: (t) => (
      <Screen title={t("consent.whoHasAccess")}>
        <Tile>
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
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
  const step = steps[at];
  if (!step) return null;

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
                            ? "bg-brand-600 text-white"
                            : done
                              ? "bg-teal-100 text-teal-700"
                              : "bg-slate-100 text-slate-500",
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
                  onClick={() => { setAt(0); }}
                  className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-navy-500 px-3 py-2 text-[13px] font-semibold text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {t("dfl.restart")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAt((i) => Math.min(steps.length - 1, i + 1)); }}
                  className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white"
                >
                  {t("dfl.next")}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                </button>
              )}
              <span className="ms-auto text-[12px] tabular-nums text-slate-500">
                {t("dfl.stepOf", { n: at + 1, total: steps.length })}
              </span>
            </div>
          </div>

          <DeviceFrame as="phone" nav={false}>
            {step.screen(t)}
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
