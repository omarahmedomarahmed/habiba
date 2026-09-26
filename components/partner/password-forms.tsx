"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { choosePassword, requestReset } from "@/app/(partner)/partner/sign-in/actions";
import { Button, Field, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

function Submit({ labelKey }: { labelKey: MessageKey }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {t(labelKey)}
    </Button>
  );
}

/**
 * 🔴 W2-X06: A LOCKED-OUT DEVELOPER ASKS FOR A LINK. There was no way back in: no
 * reset existed, and only an operator could set a partner password.
 */
export function PartnerForgotForm() {
  const t = useT();
  const [state, formAction] = useActionState(requestReset, {});

  return (
    <div>
      {state.sent ? (
        <p role="status" className="text-sm text-navy-600">
          {t("dev.linkSent")}
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <Field label={t("dev.email")} htmlFor="partner-forgot-email">
            <Input
              id="partner-forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              required
            />
          </Field>
          {state.error ? (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          <Submit labelKey="dev.sendLink" />
        </form>
      )}
    </div>
  );
}

/**
 * 🔴 W2-X06: CHOOSE A PASSWORD from the signed link: a reset, or a colleague's first
 * password. Pasting is allowed and the field names itself for a password manager
 * (WCAG 3.3.8).
 */
export function PartnerChoosePasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, formAction] = useActionState(choosePassword, {});

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label={t("dev.newPassword")} htmlFor="partner-new-password">
          <Input
            id="partner-new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        {state.error ? (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <Submit labelKey="dev.setPassword" />
      </form>
    </div>
  );
}
