import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { Suspense } from "react";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { StaffSignInForm } from "@/components/auth/forms";

/**
 * 21R.1 / C94 — the back-office door.
 *
 * `noindex, nofollow`, and nothing on the public site links here: the header,
 * the footer and every marketing page point clinicians at /login and patients
 * at /patient/login. A verifier asserts that (see `verify:sprint21r`), because
 * "not linked" is the kind of property that decays the first time somebody adds
 * a helpful shortcut.
 *
 * 🔴 Task 154 nearly was that shortcut. The new sign in menu lists four doors
 * and a first draft put this one at the bottom of it, on every page of the
 * site. It carries the site chrome now, like every other door, but it is
 * reached by URL and by nothing else. `QuietAuthShell` has no switcher for the
 * same reason.
 */
/** W3: the tab title in the reader's language. A join or pay link is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.staffSignIn"), robots: { index: false, follow: false } };
}

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const [params, { t }] = await Promise.all([searchParams, getI18n()]);

  /*
   * No title: the form's own heading is the page's h1 (AE57). Arriving from
   * /session-expired (AE56) says so, as the practice door does.
   */
  return (
    <QuietAuthShell>
      <Suspense>
        <StaffSignInForm next={params.next} notice={params.expired ? t("tauth.noticeExpired") : undefined} />
      </Suspense>
    </QuietAuthShell>
  );
}
