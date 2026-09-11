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
import { useT } from "@/lib/i18n/client";

const INITIAL: ActionState = {};

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" full disabled={pending}>
      {pending ? t("tauth.oneMoment") : children}
    </Button>
  );
}

/**
 * A sentence with links inside it, as one dictionary row. 37L.2.
 *
 * Two half-sentences either side of an anchor is a translation nobody can do:
 * Arabic does not put the clause where English does. So the row carries named
 * slots and this splits on them, which keeps the order the translator chose.
 */
function withLinks(text: string, links: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/(\{\w+\})/g).map((part, index) => {
    const name = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null;
    return name && name in links ? (
      <span key={index}>{links[name]}</span>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}

/**
 * 🔴 21R.2 / C94 — the other door, named from the reader's side.
 *
 * These four pages are the *clinician's* door. A patient who lands here is
 * looking for their own notes, their homework and the list of who can read
 * their record — not for a practice account — and "Sign in" on a page headed
 * "your practice" tells them nothing. So every one of them carries the way
 * out, in the words the person would use about themselves.
 */
function PatientDoor() {
  const t = useT();
  return (
    <p className="border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
      {t("tauth.patientDoor")}{" "}
      <Link href="/patient/login" className="font-medium text-brand-600 hover:text-brand-700">
        {t("tauth.patientDoorLink")}
      </Link>
    </p>
  );
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, INITIAL);
  const t = useT();

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("tauth.welcomeBack")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t("tauth.signInPractice")}</p>
      </div>

      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{notice}</p>
      ) : null}
      <ErrorNote message={state.error} />

      <input type="hidden" name="next" value={next ?? ""} />

      <Field label={t("tauth.email")} htmlFor="email">
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

      <Field label={t("tauth.password")} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Submit>{t("tauth.signIn")}</Submit>

      <div className="flex items-center justify-between pt-1 text-sm">
        <Link href="/forgot-password" className="text-slate-500 hover:text-slate-800">
          {t("tauth.forgot")}
        </Link>
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          {t("tauth.createAccount")}
        </Link>
      </div>

      <PatientDoor />
    </form>
  );
}

/**
 * 🔴 21R.1 / C94 — the back office has its own door.
 *
 * Same action, same lockout, same timing-equal failure; a different audience,
 * a different landing page, and — the part that matters — **no link to it from
 * the public site**. A console that can suspend a clinician or read the payout
 * queue should not be one tab away from the marketing homepage for anybody who
 * has never worked here.
 *
 * It is not a secret, and nothing here pretends it is: knowing the URL buys an
 * attacker nothing that /login did not already offer. What it buys us is that
 * the admin form is not the form a hundred thousand strangers a month are
 * looking at, and that a phishing page copying our sign-in gets the wrong one.
 */
export function StaffSignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, INITIAL);
  const t = useT();

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("tauth.staffConsole")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {withLinks(t("tauth.staffBody"), {
            link: (
              <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
                /login
              </Link>
            ),
          })}
        </p>
      </div>

      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{notice}</p>
      ) : null}
      <ErrorNote message={state.error} />

      <input type="hidden" name="audience" value="staff" />
      <input type="hidden" name="next" value={next ?? ""} />

      <Field label={t("tauth.workEmail")} htmlFor="email">
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

      <Field label={t("tauth.password")} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Submit>{t("tauth.signIn")}</Submit>

      {/* 21R.5 — this door carries its reset too. It is the same one. */}
      <p className="pt-1 text-center text-sm">
        <Link href="/forgot-password" className="text-slate-500 hover:text-slate-800">
          {t("tauth.forgot")}
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, INITIAL);
  const t = useT();

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("tauth.signUpTitle")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("tauth.signUpBody")}
        </p>
      </div>

      <ErrorNote message={state.error} />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("tauth.firstName")} htmlFor="firstName">
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label={t("tauth.lastName")} htmlFor="lastName">
          <Input id="lastName" name="lastName" autoComplete="family-name" />
        </Field>
      </div>

      <Field label={t("tauth.workEmail")} htmlFor="email">
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

      <Field label={t("tauth.password")} htmlFor="password" hint={t("tauth.passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Submit>{t("tauth.createAccount")}</Submit>

      <p className="pt-1 text-center text-sm text-slate-500">
        {t("tauth.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          {t("tauth.signIn")}
        </Link>
      </p>

      <PatientDoor />

      <p className="text-center text-xs leading-relaxed text-slate-400">
        {withLinks(t("tauth.terms"), {
          terms: (
            <Link href="/terms" className="underline">
              {t("tauth.termsWord")}
            </Link>
          ),
          privacy: (
            <Link href="/privacy" className="underline">
              {t("tauth.privacyWord")}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL);
  const t = useT();

  if (state.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("tauth.checkInbox")}
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          {t("tauth.checkInboxBody")}
        </p>
        <Link href="/login">
          <Button variant="secondary" full>
            {t("tauth.backToSignIn")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("tauth.resetTitle")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t("tauth.resetBody")}</p>
      </div>

      <ErrorNote message={state.error} />

      <Field label={t("tauth.email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Submit>{t("tauth.sendResetLink")}</Submit>

      <p className="pt-1 text-center text-sm">
        <Link href="/login" className="text-slate-500 hover:text-slate-800">
          {t("tauth.backToSignIn")}
        </Link>
      </p>

      <PatientDoor />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, INITIAL);
  const t = useT();

  return (
    <form action={action} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("tauth.chooseNew")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("tauth.chooseNewBody")}
        </p>
      </div>

      <ErrorNote message={state.error} />

      <input type="hidden" name="token" value={token} />

      <Field label={t("tauth.newPassword")} htmlFor="password" hint={t("tauth.passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Submit>{t("tauth.updatePassword")}</Submit>

      <p className="pt-1 text-center text-sm">
        <Link href="/login" className="text-slate-500 hover:text-slate-800">
          {t("tauth.backToSignIn")}
        </Link>
      </p>

      <PatientDoor />
    </form>
  );
}
