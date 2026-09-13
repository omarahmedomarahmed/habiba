"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { apply } from "@/app/(sponsor)/sponsor/apply/actions";
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
 * 53.5 — the corporate enquiry: name, kind, contact, phone, best time to call.
 *
 * ## 🔴 Company or university is ONE type with two faces (§3e)
 *
 * Asked here because it changes the words and the reporting emphasis and nothing
 * else: same controls, same wall, same everything underneath. `sponsors.kind` is
 * a column on one table, not two tables. A university asks whether the pot is
 * sized for next term and a company asks about spend against budget, and both
 * questions are answered from the same ledger query.
 *
 * ## 🔴 Nothing here implies anybody needs help (53.2)
 *
 * This is a purchasing form. "Cover therapy for your people" is a thing an
 * organisation buys; every screen a PERSON sees says "activate your benefit" and
 * never says why they might want to.
 */
export function SponsorApplyForm() {
  const t = useT();
  const [state, formAction] = useActionState(apply, {});

  if (state.sent) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("sponsor.apply.sent")}</p>
        {/* 🔴 C233 — the terms are agreed before any money, and said here. */}
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t("sponsor.apply.sentBody")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <Field label={t("sponsor.apply.org")} htmlFor="apply-name">
          <Input id="apply-name" name="name" required />
        </Field>

        <fieldset>
          <legend className="text-xs font-semibold text-slate-700">
            {t("sponsor.apply.kind")}
          </legend>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="kind" value="company" defaultChecked />
              {t("sponsor.apply.company")}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="kind" value="university" />
              {t("sponsor.apply.university")}
            </label>
          </div>
        </fieldset>

        <Field label={t("sponsor.apply.contact")} htmlFor="apply-contact">
          <Input id="apply-contact" name="contactName" required />
        </Field>

        <Field label={t("sponsor.email")} htmlFor="apply-email">
          <Input id="apply-email" name="contactEmail" type="email" autoCapitalize="none" required />
        </Field>

        <Field label={t("sponsor.apply.phone")} htmlFor="apply-phone">
          <Input id="apply-phone" name="contactPhone" type="tel" required />
        </Field>

        <Field label={t("sponsor.apply.bestTime")} htmlFor="apply-time">
          <Input id="apply-time" name="contactBestTime" />
        </Field>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("sponsor.apply.submit")} />
      </form>
    </Card>
  );
}
