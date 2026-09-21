import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Start documenting sessions in under a minute. Your first session is free.",
};

/**
 * The clinician's signup, and the only one of the four that creates an account
 * on the spot. Task 154.
 *
 * The switcher above the form is the whole point of this page's rebuild: a
 * clinic owner used to arrive here from "Start free" and create a personal
 * practice account, because nothing on the page told them a clinic is a
 * different kind of thing. Now the four are side by side and the two that need
 * an enquiry say so.
 */
export default async function SignUpPage() {
  const { t } = await getI18n();

  return (
    <AuthShell
      who="therapist"
      kind="signup"
      title={t("tauth.signUpTitle")}
      subtitle={t("tauth.signUpBody")}
      promise={t("auth.therapist.promise")}
      points={[t("auth.therapist.p1"), t("auth.therapist.p2"), t("auth.therapist.p3")]}
      belowForm={
        <p className="text-xs leading-relaxed text-slate-500">
          {t("tauth.terms")
            .split(/(\{terms\}|\{privacy\})/g)
            .map((part, index) =>
              part === "{terms}" ? (
                <Link key={index} href="/terms" className="underline">
                  {t("tauth.termsWord")}
                </Link>
              ) : part === "{privacy}" ? (
                <Link key={index} href="/privacy" className="underline">
                  {t("tauth.privacyWord")}
                </Link>
              ) : (
                <span key={index}>{part}</span>
              ),
            )}
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
