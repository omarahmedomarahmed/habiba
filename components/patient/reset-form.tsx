"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { completePatientReset, requestPatientReset } from "@/lib/patient-auth/reset";
import { Button, Field, Input } from "@/components/ui";
import { Card } from "@/components/patient/kit";
import { readerCountry } from "@/lib/phone/e164";
import { useT } from "@/lib/i18n/client";

/**
 * A patient setting a new password. PLAN.md 21R.4, C94.
 *
 * ## One field, either handle
 *
 * The same shape as signing in (13R.9): asking somebody to remember *which*
 * handle they used is asking them to remember a decision they made once on a
 * form. Most of them have only a phone number anyway.
 *
 * ## ⚠️ The page says when the channel is not live
 *
 * The code goes over WhatsApp, and the template is waiting on Meta's approval.
 * Until it is approved nothing arrives — so the page says that, in those words,
 * with the way to get help beside it. "Check your phone" shown to somebody
 * whose phone is never going to buzz is the cruellest kind of interface.
 */

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

export function PatientResetForm() {
  const t = useT();
  const [country] = useState(
    () => readerCountry(),
  );

  const [asked, request] = useActionState(requestPatientReset, {});
  const [done, complete] = useActionState(completePatientReset, {});

  const [handle, setHandle] = useState("");
  /*
   * 🔴 B53: uncontrolled, and read back once hydrated. A controlled input is
   * reset to state on hydration, so a number typed while the page was still
   * loading was wiped and "Send me a code" then submitted an empty field and
   * sent nothing. The DOM keeps what was typed; this copies it into state for
   * the second step's hidden field.
   */
  const handleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (handleInput.current?.value) setHandle(handleInput.current.value);
  }, []);

  if (done.sent) {
    return (
      <Card className="space-y-4 p-5">
        <h1 className="text-xl font-bold tracking-tight text-navy-700">{t("preset.changed")}</h1>
        <p className="text-sm leading-relaxed text-navy-400">
          {t("preset.changedBody")}
        </p>
        <Link href="/patient/login">
          <Button full size="lg">
            {t("pauth.signIn")}
          </Button>
        </Link>
      </Card>
    );
  }

  if (asked.sent) {
    return (
      <Card className="space-y-4 p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-700">{t("pcode.title")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-navy-400">
            {t("pcode.body")} {t("pcode.expires")}
          </p>
        </div>

        {asked.channelDown ? (
          <p
            role="status"
            className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800"
          >
            ⚠️ {t("preset.channelDownLead")}{" "}
            <Link href="/contact" className="font-semibold underline">
              {t("preset.tellUs")}
            </Link>{" "}
            {t("preset.channelDownTail")}
          </p>
        ) : null}

        <form action={complete} className="space-y-4">
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="handleCountry" value={country} />

          <Field label={t("preset.codeLabel")} htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </Field>

          <Field label={t("pfield.newPassword")} htmlFor="password" hint={t("pfield.passwordLengthHint")}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          {done.error ? (
            <p role="alert" aria-live="assertive" className="text-sm text-red-600">
              {done.error}
            </p>
          ) : null}

          <Submit label={t("pfield.setNewPassword")} />
        </form>

        <p className="text-center text-sm text-navy-400">
          <Link href="/patient/forgot-password" className="hover:text-navy-700">
            {t("preset.askAnother")}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-700">
          {t("preset.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">
          {t("preset.body")}
        </p>
      </div>

      <form action={request} className="space-y-4">
        <Field label={t("preset.handleLabel")} htmlFor="handle">
          <Input
            id="handle"
            name="handle"
            autoComplete="username"
            ref={handleInput}
            defaultValue={handle}
            onChange={(event) => setHandle(event.target.value)}
            required
          />
          <input type="hidden" name="handleCountry" value={country} />
        </Field>

        {asked.error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-red-600">
            {asked.error}
          </p>
        ) : null}

        <Submit label={t("preset.sendCode")} />
      </form>

      <p className="text-center text-sm text-navy-400">
        <Link href="/patient/login" className="hover:text-navy-700">
          {t("preset.backToSignIn")}
        </Link>
      </p>
    </Card>
  );
}
