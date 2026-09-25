import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ClinicSignInForm } from "@/components/clinic/sign-in-form";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourPractice"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The clinic's own door. PLAN.md 54.2, C259, C264.
 *
 * 🔴 Its own cookie and its own sign-in even though a clinic IS an organisation.
 * Sharing the clinician cookie would be the one shortcut that undoes that
 * sprint: the clinician principal's routes ARE the clinical product, and a
 * practice manager holding that cookie would be inside it.
 */
export default async function ClinicSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const [{ t }, { set }] = await Promise.all([getI18n(), searchParams]);

  return (
    <AuthShell
      who="clinic"
      kind="signin"
      title={t("clinic.signInTitle")}
      promise={t("auth.clinic.promise")}
      points={[t("auth.clinic.p1"), t("auth.clinic.p2"), t("auth.clinic.p3")]}
      /* 🔴 W2-C05: there was no way back in for a forgotten password. */
      belowForm={
        <p className="text-center text-sm">
          <Link href="/clinic/forgot-password" className="font-medium text-brand-700">
            {t("tauth.forgot")}
          </Link>
        </p>
      }
    >
      {set === "1" ? <PasswordSet text={t("auth.passwordSet")} /> : null}
      <ClinicSignInForm />
    </AuthShell>
  );
}

/** 🔴 B29 / B43: `/welcome` lands here with `set=1` once the password is chosen. */
function PasswordSet({ text }: { text: string }) {
  return (
    <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
      {text}
    </p>
  );
}
