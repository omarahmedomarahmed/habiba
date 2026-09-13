"use client";

import { useState, useTransition } from "react";

import {
  activateBenefit,
  checkCode,
  choosePrimary,
  confirmCode,
  type BenefitState,
} from "@/app/(patient)/patient/benefit/actions";
import { Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

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
  /**
   * 🔴 53.19 — a `domain_email` enrolment is not proof until the code is answered,
   * and `payFromPot` has `last_verified_at IS NOT NULL` in its WHERE clause. So an
   * unverified row is shown as waiting rather than as active, because telling
   * somebody their sessions are paid for when they are not is the one lie this
   * screen must not tell.
   */
  verified: boolean;
};

export function BenefitForm({ benefits }: { benefits: Benefit[] }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [identifier, setIdentifier] = useState("");
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
      const result = await activateBenefit(code, identifier);
      setState(result);
      if (result.ok) {
        setCode("");
        setIdentifier("");
      }
    });

  const confirm = (enrolmentId: string) =>
    startTransition(async () => {
      const result = await confirmCode(enrolmentId, codes[enrolmentId] ?? "");
      setState(result);
      if (result.ok) setCodes((current) => ({ ...current, [enrolmentId]: "" }));
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
          {benefits.map((benefit) => (
            <Card key={benefit.enrolmentId} className="p-4">
              <p className="text-sm font-semibold text-slate-900">
                {benefit.paused
                  ? t("benefit.paused")
                  : !benefit.verified
                    ? t("benefit.unverified")
                    : t("benefit.active", { name: benefit.sponsorName })}
              </p>

              {benefit.paused ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("benefit.pausedBody")}
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
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs leading-relaxed text-slate-500">
                    {benefit.paused ? t("benefit.resendPrompt") : t("benefit.codeSent")}
                  </p>
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
                    className="tap-target h-10 rounded-xl bg-teal-500 px-4 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
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
                  <p className="mt-1.5 text-xs font-medium text-teal-700">
                    {t("benefit.primary")}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => pick(benefit.enrolmentId)}
                    className="tap-target mt-2 h-10 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    {t("benefit.makePrimary")}
                  </button>
                )
              ) : null}
            </Card>
          ))}

          {benefits.length > 1 ? (
            <p className="text-xs leading-relaxed text-slate-500">
              {t("benefit.choosePrimaryBody")}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------- activating a new one -- */}

      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {t("benefit.title")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("benefit.body")}</p>

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
                hint={state.found.fields[0]?.shapeHint ?? undefined}
              >
                <Input
                  id="benefit-identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoCapitalize="none"
                  autoComplete="off"
                />
              </Field>

              {/*
                🔴 53.18b — the sentence somebody hesitating over this field
                actually needs, beside the field rather than on a help page.
              */}
              <p className="text-xs leading-relaxed text-slate-500">
                {t("benefit.identifierNeverShared")}
              </p>

              <button
                type="button"
                disabled={pending || !identifier}
                onClick={activate}
                className="tap-target h-12 w-full rounded-2xl bg-teal-500 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {pending ? t("benefit.activating") : t("benefit.activate")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending || !code}
              onClick={look}
              className="tap-target h-12 w-full rounded-2xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-50"
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
        <p className="text-sm font-semibold text-slate-900">{t("benefit.whatTheySee")}</p>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
          <li>{t("benefit.theySeeName")}</li>
          <li>{t("benefit.theyNeverSee")}</li>
          <li>{t("benefit.ifRemoved")}</li>
        </ul>
        {/* 🔴 C250 — somebody who enrolled yesterday will ask about last week. */}
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          {t("benefit.startsNow")}
        </p>
      </Card>
    </div>
  );
}
