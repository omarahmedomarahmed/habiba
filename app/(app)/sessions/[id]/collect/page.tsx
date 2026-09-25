import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { CollectPayment } from "@/components/session/collect-payment";
import { requireVerified } from "@/lib/auth/guard";
import { getSession } from "@/lib/data/sessions";
import { env } from "@/lib/env";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.waitingForPayment"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 PAY BEFORE START (docs/IN-PERSON-PAID.md), the therapist's side.
 *
 * An in-person session the patient pays for through us: a QR code the patient
 * scans on their own phone, the same link sent to them, and a Start button that
 * appears only once the money is in. "They paid me directly" turns it into a
 * cash session while nothing has been paid.
 */
export default async function CollectPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireVerified();
  const { id } = await params;
  const row = await getSession(actor, id);
  if (!row) notFound();

  const s = row.session;
  if (s.modality !== "in_person" || (s.priceCents ?? 0) <= 0 || s.status !== "scheduled") {
    redirect(`/sessions/${id}/room`);
  }
  if (!s.joinToken) redirect(`/sessions/${id}`);

  const url = `${env.appUrl}/pay/${s.joinToken}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const patientName = [row.patient?.firstName, row.patient?.lastName].filter(Boolean).join(" ") || s.guestName || "";

  return (
    <CollectPayment
      sessionId={id}
      svg={svg}
      url={url}
      priceCents={s.priceCents ?? 0}
      paid={s.paymentStatus === "paid"}
      patientName={patientName}
      canSend={Boolean(row.patient?.email || row.patient?.phone || s.guestEmail)}
    />
  );
}
