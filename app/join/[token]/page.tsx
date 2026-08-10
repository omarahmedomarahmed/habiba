import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { JoinFlow } from "@/components/join/join-flow";
import { confirmCheckout } from "@/lib/billing/stripe";
import { feedbackContext } from "@/lib/data/feedback";
import { releaseClaim } from "@/lib/data/radar";
import { resolveJoinToken } from "@/lib/data/sessions";
import { callerKey, releaseHold } from "@/lib/rate-limit";

export const metadata: Metadata = {
  title: "Join your session",
  // A join link must never be indexed, and the page must never be cached.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string; booked?: string }>;
}) {
  const { token } = await params;
  const { checkout, booked } = await searchParams;

  // Settle on the redirect as well as by webhook. Stripe cannot reach a preview
  // deployment, and a patient who has just paid must not be told to pay again.
  if (checkout && checkout !== "cancelled") {
    await confirmCheckout(checkout);
  }

  const session = await resolveJoinToken(token);

  // Abandoning the checkout puts a radar clinician straight back on the board
  // rather than holding them for the full claim window. The patient can still
  // try again from this page; if someone else has taken the slot by then, the
  // claim they lose is one they had already walked away from.
  if (checkout === "cancelled" && session) {
    await releaseClaim(session.id);
    // And give this address its booking slot back, so they can pick someone
    // else without waiting out the hold they just walked away from.
    await releaseHold(await callerKey("radar:hold"));
  }

  if (!session) {
    /*
     * A finished session is not a dead link.
     *
     * `resolveJoinToken` returns nothing once a session ends, so a patient who
     * closed the tab and came back used to be told the link was broken. It is
     * not broken — it is now the way to their summary, and it is the only
     * moment we will ever get their rating.
     */
    const feedback = await feedbackContext(token);
    if (feedback) redirect(`/feedback/${token}`);

    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">This link is no longer active</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Session links expire after 12 hours and stop working once the session has finished. Ask
          your therapist to send you a new one.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <JoinFlow
        token={token}
        modality={session.modality}
        priceCents={session.priceCents}
        paymentStatus={session.paymentStatus}
        // Skip the form only for someone who has already been through it —
        // arriving back from Stripe, or straight off the radar. Anyone opening
        // a bare link still types their name, and a priced session that has not
        // settled still gets the paywall.
        resumeAfterPayment={
          Boolean(session.guestName) &&
          (session.priceCents === 0 || session.paymentStatus === "paid") &&
          (Boolean(checkout) || booked === "1")
        }
        cancelled={checkout === "cancelled"}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="px-4 py-5 sm:px-6">
        <span className="text-[15px] font-bold tracking-tight text-navy-500">24Therapy</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center sm:px-6">
        <p className="text-xs text-slate-400">
          If you need urgent help, call or text 988 at any time.
        </p>
      </footer>
    </div>
  );
}
