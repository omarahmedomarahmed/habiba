"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { askForReset, setPasswordFromLink } from "@/app/(sponsor)/sponsor/sign-in/actions";
import { Button, Card, Field, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 W2-S05: the two doors a company user who cannot sign in comes through:
 * asking for a link, and setting a password from one (a reset, or an invite
 * from a colleague). Both were missing, so the only way back in was a call.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {label}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const t = useT();
  const [state, formAction] = useActionState(askForReset, {});

  if (state.sent) {
    return (
      <Card className="p-5">
        <p role="status" className="text-sm leading-relaxed text-navy-600">
          {t("sponsor.forgotSent")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <Field label={t("sponsor.email")} htmlFor="forgot-email">
          <Input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </Field>
        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}
        <Submit label={t("sponsor.forgotSend")} />
      </form>
    </Card>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, formAction] = useActionState(setPasswordFromLink, {});

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label={t("sponsor.newPassword")} htmlFor="set-password">
          <Input
            id="set-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}{" "}
            <Link href="/sponsor/forgot-password" className="underline">
              {t("sponsor.forgotLink")}
            </Link>
          </p>
        ) : null}
        <Submit label={t("sponsor.save")} />
      </form>
    </Card>
  );
}
