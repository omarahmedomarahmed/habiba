"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  askToChangeNumber,
  finishNumberChange,
  type AccountState,
} from "@/app/(patient)/patient/account/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL: AccountState = {};

/**
 * Changing your number. PLAN.md 20.13–20.16.
 *
 * The screen says what will happen, in order, before asking for anything: a
 * person checks, and then a code goes to the **new** number. Somebody whose
 * phone has been stolen needs to know this takes a day, and somebody trying to
 * take an account needs to know it will not work.
 */
function Ask() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? t("common.sending") : t("pnum.askToChange")}
    </Button>
  );
}

export function ChangeNumber({
  current,
  countries,
  lockedUntilLabel,
  awaitingCode = false,
}: {
  current: string | null;
  countries: { code: string; name: string }[];
  /** Null when it can be changed today. 20.14's ninety days. */
  lockedUntilLabel: string | null;
  /**
   * 🔴 W2-P07: a person approved the change and a code went to the new
   * number. The screen that takes it did not exist, so every change stalled.
   */
  awaitingCode?: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState(askToChangeNumber, INITIAL);
  const [finished, finish] = useActionState(finishNumberChange, INITIAL);

  if (finished.ok) {
    return (
      <Card className="border-brand-200 bg-brand-50 p-4">
        <p className="text-sm font-semibold text-brand-900">{t("pnumber.changed")}</p>
      </Card>
    );
  }

  if (awaitingCode) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{t("pnumber.yours")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("pnumber.requestedBody")}</p>
        <form action={finish} className="mt-3 space-y-3">
          <Field label={t("pfield.sixDigitCode")} htmlFor="number-code">
            <Input
              id="number-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </Field>
          {finished.error ? (
            <p role="alert" className="text-sm text-rose-600">
              {finished.error}
            </p>
          ) : null}
          <Button type="submit" full>
            {t("pfield.checkTheCode")}
          </Button>
        </form>
      </Card>
    );
  }

  if (state.ok) {
    return (
      <Card className="border-brand-200 bg-brand-50 p-4">
        <p className="text-sm font-semibold text-brand-900">{t("pnumber.requested")}</p>
        <p className="mt-1 text-sm leading-relaxed text-brand-900/90">
          {t("pnumber.requestedBody")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">{t("pnumber.yours")}</p>
      <p className="mt-1 font-mono text-sm text-slate-700">{current ?? "-"}</p>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {t("pnumber.body")}
      </p>

      {lockedUntilLabel ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          {t("pnumber.locked", { date: lockedUntilLabel })}
        </p>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <Field label={t("pnumber.newNumber")}>
            <div className="flex gap-2">
              <select
                name="country"
                aria-label={t("pnumber.country")}
                defaultValue=""
                className="h-12 w-32 rounded-xl border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">{t("pnumber.country")}</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <Input name="newPhone" type="tel" required className="flex-1" />
            </div>
          </Field>

          <Field label={t("pnum.whyLabel")} hint={t("pnum.whyHint")}>
            <Textarea name="reason" rows={3} required minLength={10} />
          </Field>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="consent" className="mt-1" required />
            {t("pnumber.mayCall")}
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-rose-600">
              {state.error}
            </p>
          ) : null}
          <Ask />
        </form>
      )}
    </Card>
  );
}
