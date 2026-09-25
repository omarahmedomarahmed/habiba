"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { chooseWelcomePassword, type WelcomeState } from "@/app/welcome/[token]/actions";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL: WelcomeState = {};

function Submit({ first }: { first: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? t("common.working") : first ? t("welcome.save") : t("tauth.updatePassword")}
    </Button>
  );
}

/**
 * W2-A06: the one field an invitation asks for. Its owner types it; nobody else ever does.
 *
 * 🔴 B29 / B48: `minimum` is the portal's own floor, from the server, so the
 * hint, the browser's check and the server's refusal state one rule.
 */
export function WelcomeForm({ token, first, minimum }: { token: string; first: boolean; minimum: number }) {
  const t = useT();
  const [state, action] = useActionState(chooseWelcomePassword, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p role="alert" className="text-sm text-rose-600">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <Field
        label={first ? t("welcome.password") : t("tauth.newPassword")}
        htmlFor="password"
        hint={t("welcome.hintMin", { count: minimum })}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minimum}
        />
      </Field>
      <Submit first={first} />
    </form>
  );
}
