"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { accept, joinWithAccount } from "@/app/(clinic)/clinic/join/[token]/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { SeesWhat } from "@/components/visual/primitives";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * 🔴 63.9 / C328 / 65.11 — THE TWO LISTS, AND THEY ARE ON THE SCREEN THAT DECIDES.
 *
 * > *The inviting therapist gains sight of a colleague's earnings and calendar, and
 * > the colleague has to understand that before, not after.*
 *
 * A component rather than a paragraph, rendered in BOTH branches of this screen, so
 * a person joining with a new account and a person joining with an existing one read
 * the same thing. A sentence copied into two forms is a sentence that ends up in one.
 *
 * ## 🔴 65.4 / 65.11 — AND THE ONE-OFF CARD IS NOW THE SHARED COMPARISON.
 *
 * > *What a clinic can and cannot see is the single most important thing on it, and it
 * > becomes the "who sees what" comparison, on the acceptance screen 63.9 already
 * > requires.*
 *
 *
 * This screen had the right IDEA before 65 and the wrong build: a bespoke card with two
 * bullet lists and two uppercase headings, rendered once, here. 65.4's rule is that the
 * same rule on two screens has to look like the same rule, and this one is also on the
 * clinic's own chrome, on the patient's record page and on the sponsor's portal. Four
 * copies of a disclosure is four places a fix has to land.
 *
 * 🔴 THE BULLET IN THE "NEVER" LIST WAS TEAL, which is the colour this product uses for
 * yes. `SeesWhat` uses a cross, because the list is of things that do not happen, and it
 * keeps the rule above: the never column is the same size as the will-see column.
 */
function WhatTheySee({ clinicName }: { clinicName: string }) {
  const t = useT();

  return (
    <div className="space-y-3">
      <SeesWhat
        who={t("clinic.join.seesTitle", { name: clinicName })}
        can={[
          t("clinic.join.sees.calendar"),
          t("clinic.join.sees.radar"),
          t("clinic.join.sees.prices"),
          t("clinic.join.sees.earnings"),
          t("clinic.join.sees.withdrawals"),
        ]}
        cannot={[
          t("clinic.join.never.notes"),
          t("clinic.join.never.risk"),
          t("clinic.join.never.copilot"),
          t("clinic.join.never.consent"),
        ]}
      />

      {/* 🔴 63.10 — and the invitation does nothing until they are verified. */}
      <p className="text-xs leading-relaxed text-slate-500">{t("clinic.join.verifyFirst")}</p>
    </div>
  );
}

/**
 * Accepting a practice's invitation. PLAN.md 54.5, 54.6, C261, C267.
 *
 * ## 🔴 C261 — THE SENTENCE IS ABOVE THE BUTTON, NOT ON A LATER PAGE
 *
 * > *A therapist under a clinic has no private patients on that account. It is stated in
 * > the invitation, before they accept, not discovered afterwards.*
 *
 * So the two sentences that decide whether somebody should accept are between the form
 * and the submit: what belongs to the practice, and what to do if you also want private
 * patients. Not a link, not a tooltip, not a checkbox nobody reads. And the server
 * refuses an acceptance on an invitation whose terms were never served, so this is the
 * rule rather than the rendering of it.
 *
 * ## 🔴 AND IT SAYS WHAT THE PRACTICE WILL NEVER SEE
 *
 * A clinician deciding whether to join needs to know the limit as well as the cost. "They
 * see each patient's name and appointment time and never a note" is the honest version of
 * both halves, and it is the same sentence the practice was shown before buying.
 */
export function ClinicJoinForm({
  token,
  clinicName,
  firstName,
  lastName,
}: {
  token: string;
  clinicName: string;
  firstName: string | null;
  lastName: string | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState(accept, {});
  const [existingState, existingAction] = useActionState(joinWithAccount, {});
  const [existing, setExisting] = useState(false);

  /*
   * 🔴 W2-T08: the actions sign them in and go to their dashboard, so this is
   * seen only if that redirect is lost. It still leads somewhere.
   */
  if (state.ok || existingState.ok) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("clinic.join.done")}</p>
        <Link href="/onboarding" className="mt-3 inline-flex text-sm font-semibold text-brand-700">
          {t("portal.nav.finishVerification")}
        </Link>
      </Card>
    );
  }

  /*
   * 🔴 62.6 / 62.7 — THE SECOND PATH, and it is a path rather than a detail.
   *
   * Somebody who bought Practice last week and is now being invited by a clinic
   * is the person C355 and C329 are about. Without this they would create a
   * second account, pay for two things, and find out later.
   *
   * The sentence above the button says what happens to the month they have
   * already paid for, because that is the question they are actually asking.
   */
  if (existing) {
    return (
      <Card className="p-5">
        <form action={existingAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <p className="text-sm leading-relaxed text-slate-600">
            {t("clinic.join.signInBody", { name: clinicName })}
          </p>

          <Field label={t("clinic.email")} htmlFor="join-email">
            <Input
              id="join-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field label={t("clinic.password")} htmlFor="join-existing-password">
            <Input
              id="join-existing-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <WhatTheySee clinicName={clinicName} />

          <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <p>{t("clinic.join.noPrivate", { name: clinicName })}</p>
            <p>{t("clinic.join.keepSolo")}</p>
          </div>

          {existingState.error ? (
            <p role="alert" className="text-xs text-red-600">
              {existingState.error}
            </p>
          ) : null}

          <Submit label={t("clinic.join.signIn")} />

          <button
            type="button"
            onClick={() => setExisting(false)}
            className="w-full text-center text-xs font-medium text-brand-700 underline"
          >
            {t("clinic.join.newHere")}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <p className="text-sm leading-relaxed text-slate-600">{t("clinic.join.body")}</p>

        <Field label={t("clinic.firstName")} htmlFor="join-first">
          <Input id="join-first" name="firstName" defaultValue={firstName ?? ""} required />
        </Field>
        <Field label={t("clinic.lastName")} htmlFor="join-last">
          <Input id="join-last" name="lastName" defaultValue={lastName ?? ""} />
        </Field>
        <Field label={t("clinic.password")} htmlFor="join-password">
          <Input
            id="join-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        {/*
          🔴 C261 — SAID BEFORE THEY ACCEPT. Two sentences, above the button:
          what belongs to the practice, and the honest alternative if they want
          private patients too.
        */}
        <WhatTheySee clinicName={clinicName} />

        <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <p>{t("clinic.join.noPrivate", { name: clinicName })}</p>
          <p>{t("clinic.join.keepSolo")}</p>
        </div>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("clinic.join.accept")} />

        <button
          type="button"
          onClick={() => setExisting(true)}
          className="w-full text-center text-xs font-medium text-brand-700 underline"
        >
          {t("clinic.join.haveAccount")}
        </button>
      </form>
    </Card>
  );
}
