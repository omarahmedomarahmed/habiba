import type { Metadata } from "next";

import { TicketReader } from "@/components/support/ticket-reader";
import { getI18n } from "@/lib/i18n/server";
import { crisisCountryFor } from "@/lib/crisis/line";
import { SosOrbServer } from "@/components/patient/sos-orb-server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourMessage"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 20.22 / 20.26 — the page a closed ticket links to.
 *
 * The email that brought somebody here carried a link and a six-digit code and
 * **not one word of the ticket**: not the topic, not the reply, not their own
 * message quoted back. An email carrying the conversation is patient data
 * leaving the building (§6), and one carrying the conversation but not the
 * attachments is the half-measure that drifts back to "just include the
 * summary" the first time somebody finds the link inconvenient.
 *
 * So the link identifies the ticket and the code proves the reader holds the
 * handle it was sent to. Neither alone shows anything, the failure message is
 * the same for a wrong code and an unknown token, and every successful read is
 * audited — the reader is not staff, but the material is the same material.
 */
export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { t, locale } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("ttk.title")}</h1>
        {/* Board 588: "Enter the code" lives with the code field, and goes when the code is accepted. */}
      </div>

      <TicketReader token={token} />

      {/*
        🔴 51.4 — somebody writing to support is often somebody in distress,
        and this page is reached from an email at the moment they decided to
        tell us something. The orb is two taps and a `tel:` link away.
      */}
      <SosOrbServer country={crisisCountryFor({ locale })} />
    </main>
  );
}
