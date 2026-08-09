"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signUp,
  type ActionState,
} from "@/lib/auth/actions";
import { Button, Field, Input } from "@/components/ui";

const INITIAL: ActionState = {};

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending}>
      {pending ? "One moment…" : children}
    </Button>
  );
}

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your practice.</p>
      </div>

      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{notice}</p>
      ) : null}
      <ErrorNote message={state.error} />

      <input type="hidden" name="next" value={next ?? ""} />

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Submit>Sign in</Submit>

      <div className="flex items-center justify-between pt-1 text-sm">
        <Link href="/forgot-password" className="text-slate-500 hover:text-slate-800">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Create account
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Start your first session
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Four fields, then you are in. Your first session is free.
        </p>
      </div>

      <ErrorNote message={state.error} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" autoComplete="family-name" />
        </Field>
      </div>

      <Field label="Work email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Submit>Create account</Submit>

      <p className="pt-1 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs leading-relaxed text-slate-400">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        . You are responsible for obtaining your patients&rsquo; consent to recording.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check your inbox</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          If an account exists for that address, a reset link is on its way. It works once and
          expires in an hour.
        </p>
        <Link href="/login">
          <Button variant="secondary" full>
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">We will email you a link.</p>
      </div>

      <ErrorNote message={state.error} />

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Submit>Send reset link</Submit>

      <p className="pt-1 text-center text-sm">
        <Link href="/login" className="text-slate-500 hover:text-slate-800">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500">
          This will sign you out everywhere else.
        </p>
      </div>

      <ErrorNote message={state.error} />

      <input type="hidden" name="token" value={token} />

      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Submit>Update password</Submit>
    </form>
  );
}
