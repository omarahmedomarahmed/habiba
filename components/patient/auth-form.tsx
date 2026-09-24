"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { patientSignIn, patientSignUp } from "@/lib/patient-auth/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { PhoneField } from "@/components/forms/phone-field";
import { TimezoneField } from "@/components/forms/timezone-field";
import { countryFromLocale } from "@/lib/phone/e164";
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
  invitePhone = false,
  next = null,
  wallCode = null,
}: {
  mode: "signin" | "signup";
  /** 🔴 W2-P13: the clinic wall code this signup came from, so it connects them. */
  wallCode?: string | null;
  /** 🔴 W2-P02: where sign-in returns them to. */
  next?: string | null;
  /** Carried through signup so the claim can be bound to the invited record. */
  inviteToken?: string | null;
  /**
   * The invited record holds a number, and signup must use that one. Never
   * the number itself: whoever holds a forwarded link has proven nothing, so
   * they type it and the server compares (`inviteFits`).
   */
  invitePhone?: boolean;
}) {
  const t = useT();
  const action = mode === "signup" ? patientSignUp : patientSignIn;
  const [state, formAction] = useActionState(action, {});

  // 11R.12 — a number with no country beside it is one we can never send a
  // verification code to. The locale picks the default; the person picks the
  // answer.
  const [phone, setPhone] = useState("");
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
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {wallCode ? <input type="hidden" name="wallCode" value={wallCode} /> : null}

        {mode === "signup" ? (
          <>
            <Field label={t("pfield.firstName")} htmlFor="firstName">
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
              />
            </Field>
            <Field label={t("pfield.lastNameOptional")} htmlFor="lastName">
              <Input id="lastName" name="lastName" autoComplete="family-name" />
            </Field>
          </>
        ) : null}

        {mode === "signin" ? (
          /*
           * 13R.9 — one field, either handle.
           *
           * Asking somebody to remember *which* handle they signed up with is
           * asking them to remember a decision they made once on a form months
           * ago. The server decides by shape and fails identically either way.
           */
          <Field label={t("pfield.handle")} htmlFor="handle">
            <Input id="handle" name="handle" autoComplete="username" required />
            <input type="hidden" name="handleCountry" value={phoneCountry} />
          </Field>
        ) : null}

        {mode === "signup" ? (
          <>
            <Field label={t("pfield.phone")} htmlFor="phone">
              <>
                <PhoneField
                  value={phone}
                  country={phoneCountry}
                  onValueChange={setPhone}
                  onCountryChange={setPhoneCountry}
                  name="phone"
                  countryName="phoneCountry"
                  placeholder={t("pauth.phonePlaceholder")}
                />
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {t(invitePhone ? "pauth.invitePhoneNote" : "pauth.phoneNote")}
                </p>
              </>
            </Field>

            {/*
              🔴 W2-P03: the server always read an address and the form never
              asked for one. Optional, and proved later from the account page.
            */}
            <Field label={t("pfield.emailOptional")} htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
              />
            </Field>

            {/*
            13.11 / 13.12 — where they are. Detected, **shown, and editable**.
            §3b's whole shape is telling somebody what we are about to do with
            their number; where we think they are gets the same courtesy.
          */}
            <TimezoneField />
          </>
        ) : null}

        {/*
          25.12 — optional on signup, because one handle is enough to be a
          full patient user. The hint says what happens if it is left empty
          rather than leaving somebody to guess whether the form will refuse.
        */}
        <Field
          label={
            mode === "signup"
              ? t("pfield.passwordOptional")
              : t("pfield.password")
          }
          htmlFor="password"
          hint={
            mode === "signup" ? t("pfield.passwordOptionalHint") : undefined
          }
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required={mode === "signin"}
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

        <Submit
          label={
            mode === "signup" ? t("pauth.createAccount") : t("pauth.signIn")
          }
        />
      </form>
    </Card>
  );
}
