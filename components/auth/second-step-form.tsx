"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, Input } from "@/components/clinician/kit";
import { signOut } from "@/lib/auth/actions";
import {
  sendSecondStepCode,
  verifySecondStep,
  type SecondStepState,
} from "@/lib/auth/second-step-actions";
import { useT } from "@/lib/i18n/client";

const INITIAL: SecondStepState = {};

function Submit({ children, quiet }: { children: React.ReactNode; quiet?: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" full variant={quiet ? "secondary" : undefined} disabled={pending}>
      {pending ? t("tauth.oneMoment") : children}
    </Button>
  );
}

/**
 * 🔴 Task 40: one code, from whichever place this member has.
 *
 * With an app enrolled, one box takes either the app's six digits or a
 * recovery code, and the server tells them apart. Without one, the box waits
 * for a code this page asks the server to email, and nothing is emailed until
 * they ask, so opening the page twice does not send two.
 */
export function SecondStepForm({ enrolled, email, next }: { enrolled: boolean; email: string; next: string }) {
  const t = useT();
  const [sendState, sendAction] = useActionState(sendSecondStepCode, INITIAL);
  const [state, action] = useActionState(verifySecondStep, INITIAL);

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">{t("tauth.secondTitle")}</h1>
        <p className="mt-1 text-sm text-navy-400">
          {enrolled ? t("tauth.secondAppBody") : t("tauth.secondEmailBody", { email })}
        </p>
      </div>

      {!enrolled ? (
        <form action={sendAction} className="space-y-2">
          {sendState.sent ? (
            <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">{t("tauth.secondSent")}</p>
          ) : null}
          {sendState.error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {sendState.error}
            </p>
          ) : null}
          <Submit quiet>{t("tauth.secondSend")}</Submit>
        </form>
      ) : null}

      <form action={action} className="space-y-4">
        {state.error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <input type="hidden" name="next" value={next} />
        <Field label={t("tauth.secondCode")} htmlFor="code">
          <Input
            id="code"
            name="code"
            autoComplete="one-time-code"
            inputMode={enrolled ? "text" : "numeric"}
            autoCapitalize="none"
            maxLength={40}
            required
          />
        </Field>
        <Submit>{t("tauth.secondVerify")}</Submit>
      </form>

      {!enrolled ? <p className="text-xs text-navy-400">{t("tauth.secondEnrolHint")}</p> : null}

      <form action={signOut} className="pt-1 text-center">
        <button type="submit" className="text-sm text-navy-400 hover:text-navy-700">
          {t("tauth.secondSignOut")}
        </button>
      </form>
    </div>
  );
}
