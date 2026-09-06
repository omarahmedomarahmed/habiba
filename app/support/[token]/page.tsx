import type { Metadata } from "next";

import { TicketReader } from "@/components/support/ticket-reader";

export const metadata: Metadata = { title: "Your message", robots: { index: false } };
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your message to us</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Enter the code we sent you. We keep the conversation here rather than putting it in an
          email — an email is not a safe place for what people tell us.
        </p>
      </div>

      <TicketReader token={token} />
    </main>
  );
}
