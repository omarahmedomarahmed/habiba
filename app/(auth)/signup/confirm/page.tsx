import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/clinician/kit";
import { getI18n } from "@/lib/i18n/server";

import { continueSignup } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  /* The token is in this page's address: no index, and no referrer carrying it on. */
  return { title: t("tauth.confirm.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}
export const dynamic = "force-dynamic";

/**
 * F14, review fix: the welcome email's link lands HERE and spends nothing.
 *
 * Opening the page only shows a "Continue" button. Pressing it posts the token
 * to `continueSignup`, which signs the new clinician in once and goes on to
 * verification. A mail scanner that opens the link first leaves the token
 * untouched, because it does not submit forms.
 */
export default async function SignupConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token }, { t }] = await Promise.all([searchParams, getI18n()]);
  if (!token) redirect("/login?link=1");

  const points = [t("auth.therapist.p1"), t("auth.therapist.p2"), t("auth.therapist.p3")];

  return (
    <AuthShell
      who="therapist"
      kind="signin"
      title={t("tauth.confirm.title")}
      subtitle={t("tauth.confirm.body")}
      promise={t("auth.therapist.promise")}
      points={points}
    >
      <form action={continueSignup}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" full>
          {t("tauth.confirm.button")}
        </Button>
      </form>
    </AuthShell>
  );
}
