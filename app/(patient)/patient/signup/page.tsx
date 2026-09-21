import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { PatientAuthForm } from "@/components/patient/auth-form";
import { resolveInvite } from "@/lib/data/claims";
import { getI18n } from "@/lib/i18n/server";

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
  const [invited, { t }] = await Promise.all([
    invite ? resolveInvite(invite) : Promise.resolve(null),
    getI18n(),
  ]);

  return (
    <AuthShell
      who="patient"
      kind="signup"
      title={t("pauth.signUpTitle")}
      subtitle={
        invited ? t("pauth.signUpInvited", { name: invited.therapistName }) : t("pauth.signUpBody")
      }
      promise={t("auth.patient.promise")}
      points={[t("auth.patient.p1"), t("auth.patient.p2"), t("auth.patient.p3")]}
    >
      <PatientAuthForm
        mode="signup"
        inviteToken={invited ? invite! : null}
        lockedPhone={invited?.phone ?? null}
      />
    </AuthShell>
  );
}
