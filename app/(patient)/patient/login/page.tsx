import type { Metadata } from "next";
import Link from "next/link";

import { getI18n } from "@/lib/i18n/server";

import { Card } from "@/components/ui";
import { PatientAuthForm } from "@/components/patient/auth-form";
import { CodeSignInForm } from "@/components/patient/code-signin-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientLoginPage() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pauth.signInTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("pauth.signInBody")}
        </p>
      </div>
      {/*
        🔴 51.3 — two ways in, presented as two, not as a queue.

        This page stacked a bare form, a Card, and then three identical grey
        centred sentences in a row: forgot your password, create an account,
        are you a therapist. A person arriving at two in the morning met a wall
        of near-identical links and had to read all three to find theirs.

        The form now sits in a Card of its own, so the two routes read as equal
        alternatives rather than a first choice and a fallback, and the divider
        says so in one word. The recovery link moved INSIDE the card it
        recovers, because "forgot your password" belongs to the thing with the
        password field in it and to nothing else on this page.
      */}
      <Card className="space-y-4 p-5">
        <PatientAuthForm mode="signin" />

        {/*
          🔴 21R.5 / C94 — every door carries the way back in.

          A reset that exists and is not linked is a reset nobody has, which is
          how this one went eight sprints without being noticed at all.
        */}
        <p className="text-center text-sm text-slate-500">
          <Link href="/patient/forgot-password" className="hover:text-slate-800">
            {t("pauth.forgot")}
          </Link>
        </p>
      </Card>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">{t("common.or")}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/*
        🔴 25.11 / C119 — the other way in, offered to everybody.

        A guest who joined a session on a phone number has no password and
        never chose one, and a page that offered the code route only to those
        accounts would be answering, to anybody holding a number, whether it
        belongs to a guest.
      */}
      <CodeSignInForm />

      {/*
        The two remaining destinations, with the hierarchy they actually have.
        Creating an account is what most people on this page need next; the
        therapist door is a correction for somebody in the wrong place, so it
        is quieter and separated rather than a third identical line.
      */}
      <div className="space-y-3 pt-2">
        <p className="text-center text-sm text-slate-600">
          {t("pauth.newHere")}{" "}
          <Link href="/patient/signup" className="font-semibold text-brand-600 hover:underline">
            {t("pauth.createAccount")}
          </Link>
        </p>

        {/* 21R.2 — somebody at the wrong door is told where their own one is. */}
        <p className="border-t border-slate-100 pt-3 text-center text-xs text-slate-400">
          {t("pauth.areYouTherapist")}{" "}
          <Link href="/login" className="font-medium text-slate-500 hover:text-slate-700">
            {t("pauth.practiceSignIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
