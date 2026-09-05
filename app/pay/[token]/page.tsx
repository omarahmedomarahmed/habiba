import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PayFlow } from "@/components/pay/pay-flow";
import { resolveJoinToken } from "@/lib/data/sessions";
import { getCountries } from "@/lib/settings";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Pay for your session",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The pay page. PLAN.md 4.2: **country first**, then currency, rate and methods.
 *
 * Country before anything else because everything downstream depends on it —
 * the VAT rate, the currency, the exchange rate and which payment methods
 * exist. Showing a price before knowing the country means showing a price in
 * the wrong currency and then changing it, which is exactly the moment a person
 * in distress decides they are being messed about.
 *
 * Deliberately its own route rather than a step inside `/join/[token]`. The
 * join page is about consent and a name; this one is about money, and a patient
 * who abandons a payment should be able to come back to the payment without
 * being asked again whether they consent to being recorded.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await resolveJoinToken(token);
  if (!session) notFound();

  // Nothing to pay: send them where they were actually going.
  if (session.priceCents <= 0 || session.paymentStatus === "paid") {
    redirect(`/join/${token}`);
  }

  const [[therapist], countries] = await Promise.all([
    db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, session.therapistId))
      .limit(1),
    getCountries(),
  ]);

  return (
    <PayFlow
      token={token}
      therapistName={[therapist?.firstName, therapist?.lastName].filter(Boolean).join(" ")}
      knownName={session.guestName ?? ""}
      /*
        Only countries an admin has actually configured.
        A dropdown of every country on earth, where all but two produce "we
        cannot take payments there", is a list of ways to be disappointed.
        `country_settings` is the list of places this works.
      */
      countries={countries.map((c) => ({ code: c.code, name: c.name, currency: c.currency }))}
    />
  );
}
