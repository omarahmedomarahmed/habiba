import type { Metadata } from "next";
import Link from "next/link";

import { getI18n } from "@/lib/i18n/server";
import { PatientAuthForm } from "@/components/patient/auth-form";
import { resolveInvite } from "@/lib/data/claims";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  /*
   * 13.4 — an invite pre-fills the number and **locks** it.
   *
   * Locked rather than merely pre-filled: the link was sent to that number, and
   * letting whoever opens it substitute their own would register a stranger
   * against somebody else's record — the exact collision §3b's unique index
   * exists to prevent, arriving through the one door that bypasses it.
   */
  const invited = invite ? await resolveInvite(invite) : null;
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pauth.signUpTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {invited
            ? t("pauth.signUpInvited", { name: invited.therapistName })
            : t("pauth.signUpBody")}
        </p>
      </div>
      <PatientAuthForm
        mode="signup"
        inviteToken={invited ? invite! : null}
        lockedPhone={invited?.phone ?? null}
      />
      <p className="text-center text-sm text-slate-500">
        {t("pauth.alreadyHaveOne")}{" "}
        <Link href="/patient/login" className="font-semibold text-brand-600 hover:underline">
          {t("pauth.signIn")}
        </Link>{" "}
        ·{" "}
        <Link href="/patient/forgot-password" className="hover:text-slate-800">
          {t("pauth.forgot")}
        </Link>
      </p>

      {/* 21R.2 — three audiences, three doors, each pointing at the others. */}
      <p className="text-center text-sm text-slate-500">
        {t("pauth.areYouTherapist")}{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
          {t("pauth.practiceSignUp")}
        </Link>
      </p>
    </main>
  );
}
