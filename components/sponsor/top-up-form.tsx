"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { addToPot } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button, Card, Field, Input } from "@/components/ui";
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
 * Adding to the pot. PLAN.md 53.11, 53.12, 53.13, C233.
 *
 * ## 🔴 C233 — THE TERMS ARE BESIDE THE BUTTON, NOT ON A LATER PAGE
 *
 * *"Refund and expiry terms shown on the top-up screen with the button, decided
 * before any deal."* So the refund policy and the expiry date are rendered inside
 * this card, above the submit, and `terms` is a REQUIRED prop rather than an
 * optional one: a page cannot render this form without having the terms to hand.
 *
 * That is the same construction `EgpSettlement` uses for C76's rate, and for the
 * same reason. Making it impossible to show the amount without the terms is
 * stronger than remembering to show both.
 *
 * ## 🔴 53.12 — spendable on sessions here and nothing else, said plainly
 *
 * No cash out, no transfer, no other product. It is on the screen where the money
 * goes in, because "we did tell you" on a terms page is not telling anybody.
 */
export function TopUpForm({
  minimumLabel,
  terms,
}: {
  minimumLabel: string;
  /** 🔴 Required. A top-up screen without the terms is the thing C233 forbids. */
  terms: { refundPolicy: string; expiresLabel: string };
}) {
  const t = useT();
  const [state, formAction] = useActionState(addToPot, {});

  return (
    <Card className="p-5">
      <p className="text-base font-bold tracking-tight text-slate-900">{t("sponsor.topUp")}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("sponsor.topUpBody", { min: minimumLabel })}
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        <Field label={t("sponsor.amount")} htmlFor="top-up-amount">
          <Input id="top-up-amount" name="amount" inputMode="decimal" autoComplete="off" required />
        </Field>

        {/* 🔴 C233 — above the button. Not a link, not a tooltip, not a footer. */}
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-slate-700">{t("sponsor.refundTerms")}</p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
            {terms.refundPolicy}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {t("sponsor.expiresOn", { date: terms.expiresLabel })}
          </p>
        </div>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("sponsor.topUpSubmit")} />
      </form>
    </Card>
  );
}
