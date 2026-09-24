"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInSponsor } from "@/app/(sponsor)/sponsor/sign-in/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * The sponsor's sign-in. PLAN.md 53.4.
 *
 * 🔴 Email and password, and no sign-up link beside it. A portal user is created
 * by an admin after a phone call (53.5, 53.6), so an organisation that arrives
 * here without an account is sent to the enquiry form rather than offered a
 * self-serve account that would then have to be held.
 */
export function SponsorSignInForm({ passwordSet = false }: { passwordSet?: boolean }) {
  const t = useT();
  const [state, formAction] = useActionState(signInSponsor, {});

  return (
    <Card className="p-5">
      {/* W2-S05 — arriving from a reset or invite link. */}
      {passwordSet ? (
        <p role="status" className="mb-4 text-sm font-semibold text-brand-700">
          {t("sponsor.passwordSet")}
        </p>
      ) : null}
      <form action={formAction} className="space-y-4">
        <Field label={t("sponsor.email")} htmlFor="sponsor-email">
          <Input
            id="sponsor-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field label={t("sponsor.password")} htmlFor="sponsor-password">
          <Input
            id="sponsor-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("sponsor.signIn")} />
      </form>
      {/* W2-S05 — there was no way back in but a call to us. */}
      <Link
        href="/sponsor/forgot-password"
        className="mt-3 inline-block text-xs font-semibold text-slate-600 underline"
      >
        {t("sponsor.forgotLink")}
      </Link>
    </Card>
  );
}
