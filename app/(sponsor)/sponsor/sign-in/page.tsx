import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SponsorSignInForm } from "@/components/sponsor/sign-in-form";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourOrganisationsAccount"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The sponsor's own door. PLAN.md 53.4, C230, C264.
 *
 * 🔴 Not `/sign-in`, not `/staff/sign-in`, not the patient's. Five doors for
 * five principals, one cookie each, and `lib/routing.ts` is the one table that
 * decides which door a path belongs to. Sharing a door means sharing a cookie,
 * and a cookie that admits an employer to a clinical path is the leak that ends
 * the company.
 *
 * 🔴 Task 154 — the link to the enquiry form is not a footnote any more. It is
 * the "no account yet" line the shell renders under every form, pointing at
 * `SPONSOR_APPLY`, because an organisation account is created from an enquiry
 * and there is no self serve signup to point at instead.
 */
export default async function SponsorSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const { t } = await getI18n();
  const { set } = await searchParams;

  return (
    <AuthShell
      who="company"
      kind="signin"
      title={t("sponsor.signInTitle")}
      promise={t("auth.company.promise")}
      points={[t("auth.company.p1"), t("auth.company.p2"), t("auth.company.p3")]}
    >
      <SponsorSignInForm passwordSet={set === "1"} />
    </AuthShell>
  );
}
