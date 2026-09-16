import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { declareSessionTransfer, openSessionPayment } from "./actions";
import { PaymentPopup } from "@/components/billing/payment-popup";
import { PayFlow } from "@/components/pay/pay-flow";
import {
  manualEntry,
  organizationNeedsTransfer,
  sessionTransferMoney,
} from "@/lib/billing/manual-entry";
import { resolveJoinToken } from "@/lib/data/sessions";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { getCountries } from "@/lib/settings";
import { crisisCountryFor } from "@/lib/crisis/line";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { organizations, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LanguageCorner } from "@/components/i18n/language-corner";
import { SosOrb } from "@/components/patient/sos-orb";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/pay/[token]/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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

  // 19.4 — resolved on the server, handed down, never read from the runtime.
  const { locale, t } = await getI18n();
  const tag = localeTag(locale);

  /*
   * 🔴 74.1 — WHICH RAIL, ASKED ONCE, OF THE PRACTICE'S REGION.
   *
   * An Egyptian practice cannot take a card, so `PayFlow` would walk a patient
   * through a country, a currency and a VAT rate and then hand them a checkout
   * that refuses. The two forms are never both on the page.
   */
  const needsTransfer = await organizationNeedsTransfer(session.organizationId);

  /*
   * 🔴 75.4 — THE CRISIS LINE FOR A PERSON WITH NO ACCOUNT.
   *
   * `needsTransfer` is true exactly when the practice is on the Egyptian
   * entity, which is the strongest signal this page has about where the payer
   * is. The language they chose is the fallback.
   */
  const sosCountry = crisisCountryFor({
    region: needsTransfer ? "eg" : null,
    locale: tag,
  });
  /*
   * 🔴 75.7 — THE POUNDS THEY ARE ASKED FOR INCLUDE VAT, AND THEY DID NOT.
   *
   * The card branch has always charged `patientTotalCents`, VAT on top. This
   * branch quoted the bare price, and every Egyptian practice takes this branch,
   * so the only rail in the launch market collected none of the 14% the country
   * row says is owed. One helper now derives it for both the quote and the
   * declare, because two places computing one number is how a payer is shown
   * one amount and charged another.
   */
  const money = await sessionTransferMoney({
    organizationId: session.organizationId,
    priceCents: session.priceCents,
  });

  const therapistName = [therapist?.firstName, therapist?.lastName].filter(Boolean).join(" ");

  /* The practice the money is going to, which is also the name on their statement. */
  const [practice] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);
  const practiceName = practice?.name ?? null;

  const rail = await manualEntry({
    audience: "patient",
    purpose: "session",
    refId: session.id,
    payer: { kind: "session", organizationId: session.organizationId },
    needed: needsTransfer,
    settlesCents: money.settlesCents,
    vatCents: money.vatCents,
    locale: tag,
  });

  if (rail.needed) {
    return (
      <>
        {/* 51.4 — a payment screen is a patient screen, on both rails. */}
        <SosOrb country={sosCountry} />
        {/* 🔴 75.3 — and the one where reading the wrong language costs money. */}
        <LanguageCorner />
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pay.title")}</h1>
            {therapist ? (
              <p className="mt-1 text-sm text-slate-500">
                {[therapist.firstName, therapist.lastName].filter(Boolean).join(" ")}
              </p>
            ) : null}
          </div>
          {/*
            🔴 76.4 — THE POPUP, OPEN ON ARRIVAL, because this person followed
            a link whose entire purpose was to pay. Everywhere else it opens on
            a button; here the screen IS the payment.
          */}
          <PaymentPopup
            openInitially
            /*
              🔴 76.9 — an orb, not a bar. A patient who minimises is going back
              to the app, and a bar across the top would follow them into a
              session. It sits below the SOS orb's layer on purpose.
            */
            minimised="orb"
            storageKey={session.id}
            onOpen={openSessionPayment.bind(null, token)}
            subject={{
              viewerName: session.guestName || t("pay.title"),
              /*
                🔴 The PRACTICE, not the clinician. The clinician is already
                named in the heading above, and repeating them there reads as a
                rendering bug rather than as context. What a payer needs
                underneath is who the money is going to as an organisation,
                which is also the name that will be on their bank statement.
              */
              orgName: practiceName,
              payerType: "patient",
              what: therapistName
                ? t("transfer.forSessionWith", { name: therapistName })
                : t("transfer.forSession"),
            }}
            details={rail.details}
            amountLabel={rail.amountLabel}
            taxNote={rail.taxNote}
            live={rail.live}
            action={declareSessionTransfer.bind(null, token)}
            /*
              🔴 No onward link here, and that is not an omission. This page
              REDIRECTS to the join link the moment the session reads paid
              (see the guard at the top), so a button offering the same thing
              could only ever render in a state this route does not have. The
              success state with its way onward belongs to the bar, which is
              what a payer sees when they are somewhere else in the product.
            */
          />
        </main>
      </>
    );
  }

  return (
    <>
    {/*
      🔴 51.4 — a payment screen is a patient screen.

      Somebody paying for a session they booked off the radar is often
      somebody who needed one an hour ago, and the orb is never conditional on
      having paid: 🔴 the crisis path does not depend on money.
    */}
    <SosOrb country={sosCountry} />
    <LanguageCorner />
    <PayFlow
      locale={tag}
      token={token}
      therapistName={therapistName}
      knownName={session.guestName ?? ""}
      /*
        Only countries an admin has actually configured.
        A dropdown of every country on earth, where all but two produce "we
        cannot take payments there", is a list of ways to be disappointed.
        `country_settings` is the list of places this works.
      */
      countries={countries.map((c) => ({ code: c.code, name: c.name, currency: c.currency }))}
    />
    </>
  );
}
