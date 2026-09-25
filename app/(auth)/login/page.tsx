import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/forms";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.signIn"), robots: { index: false } };
}

const NOTICES = {
  reset: "tauth.noticeReset",
  changed: "tauth.noticeChanged",
  // Arriving from /session-expired, which has already revoked the session and
  // deleted the cookie. Saying so is the difference between "the app is broken"
  // and "I have been away a while".
  expired: "tauth.noticeExpired",
} as const satisfies Record<string, MessageKey>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; changed?: string; expired?: string }>;
}) {
  const [params, { t }] = await Promise.all([searchParams, getI18n()]);
  const notice = params.reset
    ? t(NOTICES.reset)
    : params.changed
      ? t(NOTICES.changed)
      : params.expired
        ? t(NOTICES.expired)
        : undefined;

  return (
    <AuthShell
      who="therapist"
      kind="signin"
      title={t("tauth.welcomeBack")}
      subtitle={t("tauth.signInPractice")}
      promise={t("auth.therapist.promise")}
      points={[t("auth.therapist.p1"), t("auth.therapist.p2"), t("auth.therapist.p3")]}
      belowForm={
        <p className="text-sm text-slate-600">
          <Link href="/forgot-password" className="hover:text-navy-500">
            {t("tauth.forgot")}
          </Link>
        </p>
      }
    >
      <Suspense>
        <SignInForm next={params.next} notice={notice} />
      </Suspense>
    </AuthShell>
  );
}
