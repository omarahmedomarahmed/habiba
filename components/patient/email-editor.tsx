"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  askForEmailCode,
  confirmEmail,
  type EmailState,
} from "@/app/(patient)/patient/account/actions";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

/**
 * 🔴 W2-P03: adding an address, or proving the one given at signup.
 *
 * Two steps, the address and then the code sent to it, because the address
 * becomes a way into this record and is only written once it is proved.
 */
export function EmailEditor({
  current,
  verified,
}: {
  current: string | null;
  verified: boolean;
}) {
  const t = useT();
  const [asked, ask] = useActionState<EmailState, FormData>(askForEmailCode, {});
  const [confirmed, confirm] = useActionState<EmailState, FormData>(confirmEmail, {});

  if (confirmed.added) {
    return (
      <p role="status" className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-900">
        {t("paccount.emailAdded")}
      </p>
    );
  }

  const sentTo = confirmed.sentTo ?? asked.sentTo;
  if (sentTo) {
    return (
      <form action={confirm} className="mt-3 space-y-3">
        <input type="hidden" name="email" value={sentTo} />
        <p className="text-xs text-slate-600">{t("paccount.emailCodeSent", { email: sentTo })}</p>
        <Field label={t("pfield.sixDigitCode")} htmlFor="email-code">
          <Input
            id="email-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </Field>
        {confirmed.error ? (
          <p role="alert" className="text-sm text-red-600">
            {confirmed.error}
          </p>
        ) : null}
        <Submit label={t("pfield.checkTheCode")} />
      </form>
    );
  }

  return (
    <form action={ask} className="mt-3 space-y-3">
      {!current || !verified ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          {t("paccount.addEmailBody")}
        </p>
      ) : null}
      <Field label={t("pfield.email")} htmlFor="account-email">
        <Input
          id="account-email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          defaultValue={current && !verified ? current : ""}
          required
        />
      </Field>
      {asked.error ? (
        <p role="alert" className="text-sm text-red-600">
          {asked.error}
        </p>
      ) : null}
      <Submit label={t("pfield.sendMeACode")} />
    </form>
  );
}
