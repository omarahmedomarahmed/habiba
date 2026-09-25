import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { Button } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.resetPassword"), robots: { index: false } };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token }, { t }] = await Promise.all([searchParams, getI18n()]);

  const points = [t("auth.therapist.p1"), t("auth.therapist.p2"), t("auth.therapist.p3")];

  if (!token) {
    return (
      <AuthShell
        who="therapist"
        kind="signin"
        title={t("tauth.linkInvalid")}
        subtitle={t("tauth.linkInvalidBody")}
        promise={t("auth.therapist.promise")}
        points={points}
      >
        <Link href="/forgot-password">
          <Button full>{t("tauth.requestNew")}</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      who="therapist"
      kind="signin"
      title={t("tauth.chooseNew")}
      subtitle={t("tauth.chooseNewBody")}
      promise={t("auth.therapist.promise")}
      points={points}
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
