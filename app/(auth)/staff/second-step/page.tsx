import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { SecondStepForm } from "@/components/auth/second-step-form";
import { landingFor, mayOpen } from "@/lib/admin/access";
import { secondFactorStatus } from "@/lib/auth/second-factor";
import { getSessionState } from "@/lib/auth/session";
import { needsSecondFactor } from "@/lib/auth/totp";
import { STAFF_SIGN_IN } from "@/lib/routing";

/** W3: the tab title in the reader's language. A join or pay link is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.oneMoreStep"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 Task 40: the back office's second step.
 *
 * The one page a back office session reaches with only its password. It reads
 * the PENDING session directly (`getSessionState`), because `getActor` and
 * every guard call that session signed out, which is the point. Everybody who
 * does not owe the step is sent on: no session to the staff door, a clinician
 * to their dashboard, a member who already passed to where they were going.
 */
export default async function SecondStepPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "" } = await searchParams;
  const state = await getSessionState();

  if (!state) redirect(`${STAFF_SIGN_IN}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (!needsSecondFactor(state.actor.role)) redirect("/dashboard");
  if (!state.pendingSecondFactor) {
    redirect(next.startsWith("/admin") && mayOpen(state.actor.role, next) ? next : landingFor(state.actor.role));
  }

  const status = await secondFactorStatus(state.actor.userId);

  return (
    <QuietAuthShell title="">
      <SecondStepForm enrolled={status.enrolled} email={state.actor.email} next={next} />
    </QuietAuthShell>
  );
}
