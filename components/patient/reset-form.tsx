"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { completePatientReset, requestPatientReset } from "@/lib/patient-auth/reset";
import { Button, Card, Field, Input } from "@/components/ui";
import { countryFromLocale } from "@/lib/phone/e164";
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
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function PatientResetForm() {
  const t = useT();
  const [country] = useState(
    () =>
      countryFromLocale(typeof navigator === "undefined" ? null : navigator.language) ?? "EG",
  );

  const [asked, request] = useActionState(requestPatientReset, {});
  const [done, complete] = useActionState(completePatientReset, {});

  const [handle, setHandle] = useState("");

  if (done.sent) {
    return (
      <Card className="space-y-4 p-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("preset.changed")}</h1>
        <p className="text-sm leading-relaxed text-slate-600">
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pcode.title")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
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

          <Field label="New password" htmlFor="password" hint="At least 10 characters.">
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

          <Submit label="Set my new password" />
        </form>

        <p className="text-center text-sm text-slate-500">
          <Link href="/patient/forgot-password" className="hover:text-slate-800">
            {t("preset.askAnother")}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("preset.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {t("preset.body")}
        </p>
      </div>

      <form action={request} className="space-y-4">
        <Field label={t("preset.handleLabel")} htmlFor="handle">
          <Input
            id="handle"
            name="handle"
            autoComplete="username"
            value={handle}
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

      <p className="text-center text-sm text-slate-500">
        <Link href="/patient/login" className="hover:text-slate-800">
          {t("preset.backToSignIn")}
        </Link>
      </p>
    </Card>
  );
}
