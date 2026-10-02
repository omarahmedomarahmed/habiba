import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { QuietAuthShell } from "@/components/auth/auth-shell";
import { SecondStepForm, StepEnrolment } from "@/components/auth/second-step-form";
import { staffDestination } from "@/lib/admin/access";
import { safeNext } from "@/lib/auth/safe-redirect";
import { enrolmentAvailable, pendingEnrolment } from "@/lib/auth/second-factor";
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
 * 🔴 Task 40: the second step.
 *
 * The one page a session that owes the step reaches with only its password.
 * It reads the PENDING session directly (`getSessionState`), because
 * `getActor` and every guard call that session signed out, which is the point.
 *
 * DD-2 B2.3: a back office member with no authenticator app enrols one here,
 * before anything else; there is no emailed code. DD-2 B2.4: a clinician who
 * added an app is asked for it here too.
 */
export default async function SecondStepPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: raw = "" } = await searchParams;
  const next = safeNext(raw, "");
  const state = await getSessionState();

  if (!state) redirect(`${STAFF_SIGN_IN}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (!state.pendingSecondFactor) {
    redirect(needsSecondFactor(state.actor.role) ? staffDestination(state.actor.role, next) : safeNext(next, "/dashboard"));
  }

  if (state.secondFactorEnrolled) {
    return (
      <QuietAuthShell>
        <SecondStepForm next={next} />
      </QuietAuthShell>
    );
  }

  const available = enrolmentAvailable();
  const pending = available ? await pendingEnrolment(state.actor, state.sessionId) : null;
  const qr = pending
    ? await QRCode.toDataURL(pending.uri, { margin: 1, errorCorrectionLevel: "M", width: 200 })
    : null;

  return (
    <QuietAuthShell>
      <StepEnrolment next={next} available={available} pending={pending ? { key: pending.key, qr: qr! } : null} />
    </QuietAuthShell>
  );
}
