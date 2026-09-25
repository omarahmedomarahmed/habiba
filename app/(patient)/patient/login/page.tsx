import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { CodeSignInForm } from "@/components/patient/code-signin-form";
import { PatientAuthForm } from "@/components/patient/auth-form";
import { getI18n } from "@/lib/i18n/server";
import { patientLanding } from "@/lib/routing";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.signIn"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The patient's door. Task 154.
 *
 * 🔴 51.3 — two ways in, presented as two, not as a queue. A person arriving at
 * two in the morning used to meet three near-identical grey sentences in a row
 * and had to read all of them to find theirs. The password form and the code
 * form are equal alternatives with one word between them, and everything that
 * is not a way in has moved into the shell: the four doors above the form, the
 * way to signup below it.
 *
 * 🔴 21R.5 / C94 — the reset link stays INSIDE the card with the password field
 * in it, because it belongs to that form and to nothing else on the page. A
 * reset that exists and is not linked is a reset nobody has, which is how this
 * one went eight sprints unnoticed.
 */
export default async function PatientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { t } = await getI18n();
  /* 🔴 W2-P02: carried by both forms, checked again by `patientLanding` on the server. */
  const next = patientLanding((await searchParams).next);

  return (
    <AuthShell
      who="patient"
      kind="signin"
      title={t("pauth.signInTitle")}
      subtitle={t("pauth.signInBody")}
      promise={t("auth.patient.promise")}
      points={[t("auth.patient.p1"), t("auth.patient.p2"), t("auth.patient.p3")]}
    >
      <div className="space-y-4">
        <PatientAuthForm mode="signin" next={next} />
        <p className="text-sm text-slate-600">
          <Link href="/patient/forgot-password" className="hover:text-navy-500">
            {t("pauth.forgot")}
          </Link>
        </p>
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-500">{t("common.or")}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/*
        🔴 25.11 / C119 — the other way in, offered to everybody. A guest who
        joined a session on a phone number has no password and never chose one,
        and a page that offered the code route only to those accounts would be
        answering, to anybody holding a number, whether it belongs to a guest.
      */}
      <CodeSignInForm next={next} />
    </AuthShell>
  );
}
