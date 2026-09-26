"use client";

import { useState, useTransition } from "react";

import {
  activateBenefit,
  askAboutEmployer,
  checkCode,
  choosePrimary,
  confirmCode,
  reconfirmBenefit,
  type BenefitState,
} from "@/app/(patient)/patient/benefit/actions";
import { Button, Field, Input } from "@/components/ui";
import { Card } from "@/components/patient/kit";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * Activating a benefit. PLAN.md 53.2, 53.18, 53.19c, 53.22, C234, C248, C250.
 *
 * ## 🔴 53.2 — EVERY WORD HERE IS A BENEFIT WORD
 *
 * *Enrolment is eligibility, never therapy. Nothing on any enrolment screen,
 * email or poster implies the person needs help.*
 *
 * That is not squeamishness. A screen headed "get help with your mental health"
 * is an outing risk for whoever is seen using it on a phone in an open-plan
 * office, and a poster that says it is the same risk for whoever is seen
 * photographing it. So: "activate your benefit", and the only thing this screen
 * says about therapy is that sessions become paid for.
 *
 * ## 🔴 C234 / 53.22 — WHAT HAPPENS ON REMOVAL IS SAID BEFORE THEY ENROL
 *
 * *This is the strongest thing we can say to an employee and it should be said
 * before they enrol, not after.* So the three sentences about what the sponsor
 * can see, can never see, and cannot take away are on this screen, above the
 * button, not on a help page.
 *
 * ## 🔴 C248 — the shape, never a specimen
 *
 * The hint comes from the sponsor and the database refuses one containing a run
 * of four digits or an @, because "for example, 20215544" is a working template
 * handed to anybody who walks past a poster.
 */

export type Benefit = {
  enrolmentId: string;
  sponsorName: string;
  isPrimary: boolean;
  paused: boolean;
  /** W2-S11: paused by the organisation. A code does not restart it. */
  held: boolean;
  /**
   * 🔴 53.19 — a `domain_email` enrolment is not proof until the code is answered,
   * and `payFromPot` has `last_verified_at IS NOT NULL` in its WHERE clause. So an
   * unverified row is shown as waiting rather than as active, because telling
   * somebody their sessions are paid for when they are not is the one lie this
   * screen must not tell.
   */
  verified: boolean;
  /** 🔴 W2-P08: a work address gets a new code; an ID number is proof itself. */
  kind: "domain_email" | "id_number" | string;
  /**
   * 🔴 P17: "50%", formatted on the server. How much of each session their
   * company pays, and nothing about the company's balance. Null with no pot.
   */
  coverage: string | null;
};

export function BenefitForm({
  benefits,
  initialCode = "",
}: {
  benefits: Benefit[];
  /** 🔴 W2-P08: the sponsor's QR is `/patient/benefit?code=`, and the page ignored it. */
  initialCode?: string;
}) {
  const t = useT();
  const [code, setCode] = useState(initialCode.toUpperCase());
  /** What each paused row was enrolled with, typed again. Never stored. */
  const [again, setAgain] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [identifier, setIdentifier] = useState("");
  /* 🔴 Ruling 15: asked only when the company also asks for an employee ID. */
  const [employeeId, setEmployeeId] = useState("");
  const [state, setState] = useState<BenefitState>({});
  /** One code per enrolment row, because several may be waiting at once. */
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const look = () =>
    startTransition(async () => {
      setState(await checkCode(code));
    });

  const activate = () =>
    startTransition(async () => {
      const result = await activateBenefit(code, identifier, employeeId);
      setState(result);
      if (result.ok) {
        setCode("");
        setIdentifier("");
        setEmployeeId("");
      }
    });

  const confirm = (enrolmentId: string) =>
    startTransition(async () => {
      const result = await confirmCode(enrolmentId, codes[enrolmentId] ?? "");
      setState(result);
      if (result.ok) setCodes((current) => ({ ...current, [enrolmentId]: "" }));
    });

  const reconfirm = (enrolmentId: string) =>
    startTransition(async () => {
      const result = await reconfirmBenefit(enrolmentId, again[enrolmentId] ?? "");
      setState(result.needsCode ? { error: undefined } : result);
      if (result.needsCode) setSentTo((current) => ({ ...current, [enrolmentId]: true }));
    });

  const pick = (enrolmentId: string) =>
    startTransition(async () => {
      setState(await choosePrimary(enrolmentId));
    });

  return (
    <div className="space-y-4">
      {/* ------------------------------------------- what they already have -- */}

      {benefits.length > 0 ? (
        <div className="space-y-2">
          {benefits.map((benefit) => {
            /* The sample's benefit card: dark, with the teal light, while it is working. */
            const working = benefit.verified && !benefit.paused && !benefit.held;
            return (
            <Card
              key={benefit.enrolmentId}
              className={cn("p-4", working && "relative overflow-hidden border-0 bg-navy-900 p-5 text-white")}
            >
              {working ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full blur-3xl"
                  style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
                />
              ) : null}
              <p className={cn("relative", working ? "text-[18px] font-bold text-white" : "text-sm font-semibold text-navy-700")}>
                {benefit.paused || benefit.held
                  ? t("benefit.paused")
                  : !benefit.verified
                    ? t("benefit.unverified")
                    : t("benefit.active", { name: benefit.sponsorName })}
              </p>

              {benefit.paused ? (
                <p className="mt-1 text-sm leading-relaxed text-navy-400">
                  {t("benefit.pausedBody")}
                </p>
              ) : benefit.held ? (
                /* W2-S11: the organisation paused it; a code cannot restart it. */
                <p className="mt-1 text-sm leading-relaxed text-navy-400">
                  {t("benefit.heldBody")}
                </p>
              ) : benefit.verified && benefit.coverage ? (
                /* 🔴 P17: what it pays, so the rest of a session is not a surprise. */
                <p className="relative mt-1.5 text-[15px] leading-relaxed text-white/80">
                  {t("benefit.covers", { percent: benefit.coverage })}
                </p>
              ) : null}

              {/*
                🔴 53.19 — the code, typed in here, on the row it belongs to.

                Shown for an unverified row and for a paused one alike, because
                C247's remedy is the same act: answer the code. A paused person
                whose only instruction was "contact us" is a person whose funding
                stopped and who cannot restart it.
              */}
              {!benefit.verified || benefit.paused ? (
                <div className="mt-3 space-y-2 border-t border-navy-100 pt-3">
                  <p className="text-xs leading-relaxed text-navy-400">
                    {benefit.paused && !sentTo[benefit.enrolmentId]
                      ? t("benefit.resendPrompt")
                      : t("benefit.codeSent")}
                  </p>
                  {/*
                    🔴 W2-P08: the sentence above asked for the address again,
                    and there was nowhere to type it. Checked against their own
                    enrolment's hash, never stored.
                  */}
                  {benefit.paused && !sentTo[benefit.enrolmentId] ? (
                    <>
                      <Field
                        label={t("benefit.identifierLabel", { name: benefit.sponsorName })}
                        htmlFor={`again-${benefit.enrolmentId}`}
                      >
                        <Input
                          id={`again-${benefit.enrolmentId}`}
                          value={again[benefit.enrolmentId] ?? ""}
                          onChange={(event) =>
                            setAgain((current) => ({
                              ...current,
                              [benefit.enrolmentId]: event.target.value,
                            }))
                          }
                          autoCapitalize="none"
                          autoComplete="off"
                        />
                      </Field>
                      <button
                        type="button"
                        disabled={pending || !again[benefit.enrolmentId]}
                        onClick={() => reconfirm(benefit.enrolmentId)}
                        className="tap-target h-10 rounded-2xl bg-navy-900 px-4 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {benefit.kind !== "id_number" ? t("pfield.sendMeACode") : t("benefit.confirm")}
                      </button>
                    </>
                  ) : null}
                  <Field
                    label={t("benefit.codeLabel2")}
                    htmlFor={`confirm-${benefit.enrolmentId}`}
                  >
                    <Input
                      id={`confirm-${benefit.enrolmentId}`}
                      value={codes[benefit.enrolmentId] ?? ""}
                      onChange={(event) =>
                        setCodes((current) => ({
                          ...current,
                          [benefit.enrolmentId]: event.target.value,
                        }))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </Field>
                  <button
                    type="button"
                    disabled={pending || !codes[benefit.enrolmentId]}
                    onClick={() => confirm(benefit.enrolmentId)}
                    className="tap-target h-10 rounded-2xl bg-brand-500 px-4 text-xs font-semibold text-navy-600 hover:bg-brand-400 disabled:opacity-50"
                  >
                    {t("benefit.confirm")}
                  </button>
                </div>
              ) : null}

              {/*
                🔴 C249 — more than one list, and the patient chooses which
                pays. Neither organisation is told the other exists, which
                follows from C227 rather than needing enforcement here.
              */}
              {benefits.length > 1 ? (
                benefit.isPrimary ? (
                  <p className={cn("relative mt-1.5 text-xs font-semibold", working ? "text-brand-300" : "text-brand-700")}>
                    {t("benefit.primary")}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => pick(benefit.enrolmentId)}
                    className="tap-target relative mt-2 h-10 rounded-xl bg-navy-50 px-3 text-xs font-semibold text-navy-600 hover:bg-navy-100 disabled:opacity-50"
                  >
                    {t("benefit.makePrimary")}
                  </button>
                )
              ) : null}
            </Card>
            );
          })}

          {benefits.length > 1 ? (
            <p className="text-xs leading-relaxed text-navy-400">
              {t("benefit.choosePrimaryBody")}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------- activating a new one -- */}

      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-navy-700">
          {t("benefit.title")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("benefit.body")}</p>

        <div className="mt-4 space-y-4">
          <Field label={t("benefit.codeLabel")} htmlFor="benefit-code">
            <Input
              id="benefit-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </Field>

          {state.found ? (
            <>
              <Field
                label={t("benefit.identifierLabel", { name: state.found.sponsorName })}
                htmlFor="benefit-identifier"
                /*
                  🔴 C248 / 53.19c — the sponsor's own description of the shape.
                  The domain may be named, because a domain is public. A sample
                  local part may not, and the database refuses one.
                */
                hint={state.found.fields.find((field) => field.kind === "domain_email")?.shapeHint ?? undefined}
              >
                <Input
                  id="benefit-identifier"
                  type="email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </Field>

              {state.found.fields.some((field) => field.kind === "id_number") ? (
                <Field
                  label={t("benefit.employeeIdLabel")}
                  htmlFor="benefit-employee-id"
                  hint={state.found.fields.find((field) => field.kind === "id_number")?.shapeHint ?? undefined}
                >
                  <Input
                    id="benefit-employee-id"
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                </Field>
              ) : null}

              {/*
                🔴 53.18b — the sentence somebody hesitating over this field
                actually needs, beside the field rather than on a help page.
              */}
              <p className="text-xs leading-relaxed text-navy-400">
                {t("benefit.identifierNeverShared")}
              </p>

              <button
                type="button"
                disabled={pending || !identifier}
                onClick={activate}
                className="tap-target h-12 w-full rounded-2xl bg-brand-500 text-sm font-semibold text-navy-600 hover:bg-brand-400 disabled:opacity-50"
              >
                {pending ? t("benefit.activating") : t("benefit.activate")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending || !code}
              onClick={look}
              className="tap-target h-12 w-full rounded-2xl bg-navy-900 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? t("benefit.activating") : t("benefit.activate")}
            </button>
          )}
        </div>

        {state.error ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {state.error}
          </p>
        ) : null}
      </Card>

      {/*
        🔴 C234 / 53.22 — SAID BEFORE THEY ENROL, NOT AFTER.

        Three sentences: what the organisation sees, what it never sees, and what
        it cannot take away. The last one is the strongest thing this product can
        say to an employee, and the cheap implementation says it on a help page
        nobody opens.
      */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-navy-700">{t("benefit.whatTheySee")}</p>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-navy-400">
          <li>{t("benefit.theySeeName")}</li>
          <li>{t("benefit.theyNeverSee")}</li>
          <li>{t("benefit.ifRemoved")}</li>
        </ul>
        {/* 🔴 C250 — somebody who enrolled yesterday will ask about last week. */}
        <p className="mt-3 border-t border-navy-100 pt-3 text-xs leading-relaxed text-navy-400">
          {t("benefit.startsNow")}
        </p>
      </Card>
    </div>
  );
}


/**
 * 🔴 61.6 / C349 — "IS MY EMPLOYER HERE?", AND WHY THE ANSWER NEVER VARIES.
 *
 * People ask this, so refusing to have the question on the screen does not make
 * it go away: it makes somebody email support, who then answers it by hand and
 * becomes the oracle themselves.
 *
 * So the question is here and the answer is a constant. `askAboutEmployer` does
 * the lookup either way and returns one message, so neither the words nor the
 * timing say whether a domain is a customer. Whether a company buys therapy for
 * its staff is a fact that company publishes or does not (C319), and the
 * patient-app banner already shows opted-in sponsors only for the same reason.
 *
 * 🔴 Nothing is lost. The real answer always reached somebody through their
 * employer: a code on a poster, an intranet page, an email from HR. What is
 * lost is a stranger with a domain list and an afternoon.
 */
export function AskAboutEmployer() {
  const t = useT();
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState<MessageKey | null>(null);
  const [domain, setDomain] = useState("");

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-navy-700">{t("benefit.notSure")}</p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder={t("benefit.domainHint")}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className="h-12"
          onClick={() => {
            start(async () => {
              const result = await askAboutEmployer(domain);
              setAnswer(result.message);
            });
          }}
        >
          {pending ? "…" : t("benefit.ask")}
        </Button>
      </div>

      {answer ? (
        <p className="mt-3 text-sm leading-relaxed text-navy-400">{t(answer)}</p>
      ) : null}
    </Card>
  );
}
