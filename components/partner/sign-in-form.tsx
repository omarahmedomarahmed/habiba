"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInPartner } from "@/app/(partner)/partner/sign-in/actions";
import { Button, Field, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

/**
 * The developer's sign-in. PLAN.md 55.2.
 *
 * 🔴 No sign-up link beside it. A partner account is created by an operator after a call,
 * because an active partner can hold a key and an employment key is an identity oracle
 * (C265). A company arriving here without an account is sent to the enquiry form.
 */
export function PartnerSignInForm() {
  const t = useT();
  const [state, formAction] = useActionState(signInPartner, {});

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <Field label={t("dev.email")} htmlFor="partner-email">
          <Input
            id="partner-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field label={t("dev.password")} htmlFor="partner-password">
          <Input
            id="partner-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {state.error ? (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("dev.signIn")} />
      </form>
    </div>
  );
}
