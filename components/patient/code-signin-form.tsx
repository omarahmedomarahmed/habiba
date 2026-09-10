"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { requestSignInCode, signInWithCode } from "@/lib/patient-auth/code-signin";
import { Button, Card, Field, Input } from "@/components/ui";
import { countryFromLocale } from "@/lib/phone/e164";

/**
 * Signing in with a code. PLAN.md 25.11-25.13, C119.
 *
 * ## Why this is offered to everybody, not only to people without a password
 *
 * Because otherwise the page has to say who has one. "This account has no
 * password" answers, to anybody holding a phone number, whether that number
 * belongs to somebody who joined a session as a guest. So both ways in are on
 * the same screen for everybody, and the one a person uses is their business.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function CodeSignInForm() {
  const router = useRouter();
  const [country] = useState(
    () =>
      countryFromLocale(typeof navigator === "undefined" ? null : navigator.language) ?? "EG",
  );
  const [handle, setHandle] = useState("");

  const [asked, request] = useActionState(requestSignInCode, {});
  const [entered, confirm] = useActionState(signInWithCode, {});

  if (entered.sent) {
    router.replace("/patient");
  }

  if (asked.sent) {
    return (
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Enter your code</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            If that phone number or email has an account, a six-digit code is on its way. It
            expires in fifteen minutes.
          </p>
        </div>

        {asked.channelDown ? (
          <p
            role="status"
            className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800"
          >
            ⚠️ Codes over WhatsApp are not switched on yet, so one may not arrive. If you are
            stuck, ask your therapist for an invite link.
          </p>
        ) : null}

        <form action={confirm} className="space-y-4">
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="handleCountry" value={country} />

          <Field label="Six-digit code" htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </Field>

          {entered.error ? (
            <p role="alert" aria-live="assertive" className="text-sm text-red-600">
              {entered.error}
            </p>
          ) : null}

          <Submit label="Sign in" />
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          Sign in with a code instead
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          No password needed. We send a code to your phone number or your email, whichever you
          use here.
        </p>
      </div>

      <form action={request} className="space-y-4">
        <Field label="Phone number or email" htmlFor="codeHandle">
          <Input
            id="codeHandle"
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

        <Submit label="Send me a code" />
      </form>
    </Card>
  );
}
