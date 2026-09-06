"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { patientSignIn, patientSignUp } from "@/lib/patient-auth/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { PhoneField } from "@/components/forms/phone-field";
import { TimezoneField } from "@/components/forms/timezone-field";
import { countryFromLocale } from "@/lib/phone/e164";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * One form, two modes.
 *
 * Signing up asks for a name because a person needs one — the `people` row is
 * created here and `firstName` is NOT NULL. Phone is optional and asked for
 * because it is the second channel a verification code can go to (§3 step 5),
 * and because for a great many patients in this product it is the only contact
 * detail that exists.
 */
export function PatientAuthForm({
  mode,
  inviteToken = null,
  lockedPhone = null,
}: {
  mode: "signin" | "signup";
  /** Carried through signup so the claim can be bound to the invited record. */
  inviteToken?: string | null;
  /** 13.4 — E.164, pre-filled and **not editable**. */
  lockedPhone?: string | null;
}) {
  const action = mode === "signup" ? patientSignUp : patientSignIn;
  const [state, formAction] = useActionState(action, {});

  // 11R.12 — a number with no country beside it is one we can never send a
  // verification code to. The locale picks the default; the person picks the
  // answer.
  const [phone, setPhone] = useState(lockedPhone ?? "");
  const [phoneCountry, setPhoneCountry] = useState(
    () =>
      countryFromLocale(
        typeof navigator === "undefined" ? null : navigator.language,
      ) ?? "EG",
  );

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        {inviteToken ? (
          <input type="hidden" name="inviteToken" value={inviteToken} />
        ) : null}

        {mode === "signup" ? (
          <>
            <Field label="First name" htmlFor="firstName">
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
              />
            </Field>
            <Field label="Last name (optional)" htmlFor="lastName">
              <Input id="lastName" name="lastName" autoComplete="family-name" />
            </Field>
          </>
        ) : null}

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>

        {mode === "signup" ? (
          <>
            <Field label="Phone" htmlFor="phone">
              {lockedPhone ? (
                <>
                  {/*
                  13.4 — shown, readable, and not editable. A disabled input
                  submits nothing, so the value travels in a hidden field: the
                  server checks it against the invite either way.
                */}
                  <input type="hidden" name="phone" value={lockedPhone} />
                  <p className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-700">
                    {lockedPhone}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    The number your therapist sent this invite to. Your
                    verification code goes here.
                  </p>
                </>
              ) : (
                <>
                  <PhoneField
                    value={phone}
                    country={phoneCountry}
                    onValueChange={setPhone}
                    onCountryChange={setPhoneCountry}
                    name="phone"
                    countryName="phoneCountry"
                    placeholder="Phone or WhatsApp"
                  />
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    This is how you sign in and how your therapist finds you.
                    Your verification code goes to it.
                  </p>
                </>
              )}
            </Field>

            {/*
            13.11 / 13.12 — where they are. Detected, **shown, and editable**.
            §3b's whole shape is telling somebody what we are about to do with
            their number; where we think they are gets the same courtesy.
          */}
            <TimezoneField />
          </>
        ) : null}

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
          />
        </Field>

        {state.error ? (
          <p
            role="alert"
            aria-live="assertive"
            className="text-sm text-red-600"
          >
            {state.error}
          </p>
        ) : null}

        <Submit label={mode === "signup" ? "Create account" : "Sign in"} />
      </form>
    </Card>
  );
}
