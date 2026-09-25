import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { PatientAuthForm } from "@/components/patient/auth-form";
import { resolveInvite } from "@/lib/data/claims";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.createAnAccount"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function PatientSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  /*
   * 13.4 — an invite is for the number the record holds.
   *
   * 🔴 Asked for, never shown. This page used to print that number, locked, to
   * whoever opened the link, which told a stranger holding a forwarded link
   * the patient's phone number. The person types it; `inviteFits` compares it
   * at signup and again when the link is spent.
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
        invitePhone={Boolean(invited?.phone)}
      />
    </AuthShell>
  );
}
