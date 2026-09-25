import type { Metadata } from "next";
import QRCode from "qrcode";

import { SecondFactorSetup } from "@/components/admin/second-factor-setup";
import { requireStaff } from "@/lib/auth/guard";
import { enrolmentAvailable, pendingEnrolment, secondFactorStatus } from "@/lib/auth/second-factor";

export const metadata: Metadata = { title: "Sign-in security", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 Task 40: each back office member's own second step.
 *
 * Every member's, not the owner's: the thing being set up is how THEY sign
 * in. The QR code is drawn here on the server from the pending, sealed secret
 * and handed down as an image, so the secret never sits in a client bundle
 * or a log, only on the one screen of the person enrolling.
 */
export default async function SecurityPage() {
  const actor = await requireStaff();
  const status = await secondFactorStatus(actor.userId);
  const pending = status.enrolled || !enrolmentAvailable() ? null : await pendingEnrolment(actor);
  const qr = pending
    ? await QRCode.toDataURL(pending.uri, { margin: 1, errorCorrectionLevel: "M", width: 200 })
    : null;

  return (
    <SecondFactorSetup
      enrolled={status.enrolled}
      recoveryLeft={status.recoveryLeft}
      available={enrolmentAvailable()}
      pending={pending ? { key: pending.key, qr: qr! } : null}
    />
  );
}
