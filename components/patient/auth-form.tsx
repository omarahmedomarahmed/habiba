"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { patientSignIn, patientSignUp } from "@/lib/patient-auth/actions";
import { Button, Card, Field, Input } from "@/components/ui";

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
export function PatientAuthForm({ mode }: { mode: "signin" | "signup" }) {
  const action = mode === "signup" ? patientSignUp : patientSignIn;
  const [state, formAction] = useActionState(action, {});

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        {mode === "signup" ? (
          <>
            <Field label="First name" htmlFor="firstName">
              <Input id="firstName" name="firstName" autoComplete="given-name" required />
            </Field>
            <Field label="Last name (optional)" htmlFor="lastName">
              <Input id="lastName" name="lastName" autoComplete="family-name" />
            </Field>
          </>
        ) : null}

        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>

        {mode === "signup" ? (
          <Field label="Phone (optional)" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" autoComplete="tel" />
            <p className="mt-1 text-xs text-slate-500">
              We can send your verification code here instead of by email.
            </p>
          </Field>
        ) : null}

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
        </Field>

        {state.error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={mode === "signup" ? "Create account" : "Sign in"} />
      </form>
    </Card>
  );
}
