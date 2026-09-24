"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestReset } from "@/app/(clinic)/clinic/forgot-password/actions";
import { setPassword } from "@/app/(clinic)/clinic/set-password/actions";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { CLINIC_SIGN_IN } from "@/lib/routing";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

function Back() {
  const t = useT();
  return (
    <p className="pt-1 text-center text-sm">
      <Link href={CLINIC_SIGN_IN} className="text-slate-500 hover:text-slate-800">
        {t("tauth.backToSignIn")}
      </Link>
    </p>
  );
}

/**
 * 🔴 W2-C05: ask for a reset link. The same words as the clinician's own
 * form, because it is the same act: the dictionary already carries them in
 * both languages.
 */
export function ClinicForgotForm() {
  const t = useT();
  const [state, action] = useActionState(requestReset, {});

  if (state.sent) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">{t("tauth.checkInbox")}</p>
        <p className="text-sm text-slate-600">{t("tauth.checkInboxBody")}</p>
        <Back />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label={t("clinic.email")} htmlFor="clinic-forgot-email">
        <Input
          id="clinic-forgot-email"
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
      <Submit label={t("tauth.sendResetLink")} />
      <Back />
    </form>
  );
}

/** 🔴 W2-C04 / W2-C05: choose your own password, from an invitation or a reset. */
export function ClinicSetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, action] = useActionState(setPassword, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label={t("tauth.newPassword")} htmlFor="clinic-new-password" hint={t("tauth.passwordHint")}>
        <Input
          id="clinic-new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
      <Submit label={t("tauth.updatePassword")} />
    </form>
  );
}
