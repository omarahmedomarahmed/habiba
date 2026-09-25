import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { coverWithBenefit, declareSessionTransfer, openSessionPayment, payByCard } from "./actions";
import { PaymentPopup } from "@/components/billing/payment-popup";
import { Button } from "@/components/ui";
import { PayFlow } from "@/components/pay/pay-flow";
import {
  manualEntry,
  organizationNeedsTransfer,
  sessionTransferMoney,
} from "@/lib/billing/manual-entry";
import { patientOwesFor, sessionLines } from "@/lib/billing/session-owed";
import { benefitShortfall } from "@/lib/billing/pot";
import { BenefitNote } from "@/components/patient/benefit-note";
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
import { SosOrbServer } from "@/components/patient/sos-orb-server";

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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ gateway?: string; card?: string; benefit?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  /*
   * 🔴 64.1: back from the card gateway. Ask it what happened before reading
   * the session, so a payment that settled is seen as paid on this request
   * rather than after the callback arrives.
   */
  if (query.gateway && /^[0-9a-f-]{36}$/.test(query.gateway)) {
    const { confirmGatewayReturn } = await import("@/lib/billing/gateway/session");
    await confirmGatewayReturn(query.gateway);
  }
  const session = await resolveJoinToken(token);
  if (!session) notFound();

  /*
   * Nothing to pay: send them where they were actually going.
   *
   * 🔴 `booked=1`, WHICH THE STRIPE RAIL HAS AND THIS ONE DID NOT.
   *
   * Stripe comes back to `/join/<token>?checkout=<id>` and the join page
   * treats that as "this person has been through the flow, do not start them
   * at the beginning". The Egyptian transfer rail landed here instead and
   * redirected to a bare `/join/<token>`, so a patient who had just paid, and
   * whose name was already on the session row, was asked for their first name
   * again as though they had never been seen.
   *
   * Measured on production: the admin confirms, and 5.9 seconds later this
   * page moves by itself, which is the right behaviour and the thing that was
   * asked for. It just moved them to a form instead of into the session.
   *
   * `booked=1` is the flag that already means exactly this, and paying IS
   * having been through the flow.
   */
  /*
   * 🔴 IN PERSON, PAID: there is no room to join. The patient is already with
   * their therapist, whose screen unlocked Start the moment this landed.
   */
  const inPerson = session.modality === "in_person";
  if (inPerson && session.paymentStatus === "paid") {
    const { t: tt } = await getI18n();
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 py-8 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{tt("pay.inPersonPaid")}</h1>
        <p className="text-sm text-slate-600">{tt("pay.inPersonPaidBody")}</p>
      </main>
    );
  }
  if (session.priceCents <= 0 || session.paymentStatus === "paid") {
    redirect(`/join/${token}?booked=1`);
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
  /*
   * 🔴 76.27 — WHAT THEY STILL OWE, not what the session cost.
   *
   * This read `session.priceCents`, and `payFromPot` had already debited the
   * employer's half at booking. So a company covering 50% of a $20 session paid
   * $10 and their employee was asked for $20: the benefit was spent and the
   * patient was billed as though it had not been. There is no processor on this
   * rail, so that is money taken twice with nothing to reverse it.
   *
   * `patientOwesFor` reads the share `payFromPot` froze onto `session_payments`
   * at booking, which is the row built to answer exactly this and was read by
   * nobody.
   */
  const owed = await patientOwesFor(session.id);
  /* 🔴 W2-P15 / E5: if a benefit should have paid and did not, who to ask. */
  const shortfall = await benefitShortfall(session.id);

  const money = await sessionTransferMoney({
    organizationId: session.organizationId,
    priceCents: owed.grossCents,
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
    /*
     * 🔴 AND THE SPLIT IS PRINTED, because a patient looking at 570 EGP for a
     * session priced at 1,000 has a question, and an unanswered question about
     * money is a payment that does not happen. Empty when nothing covered it.
     */
    lines: sessionLines({
      owed,
      vatCents: money.vatCents,
      sessionLabel: therapistName
        ? t("transfer.subjectSessionWith", { name: therapistName })
        : t("transfer.subjectSession"),
      benefitLabel: t("pay.benefitPaid"),
      vatLabel: t("topup.vat"),
    }),
    locale: tag,
  });

  const { railIsReady } = await import("@/lib/billing/egypt");
  /*
   * 🔴 NOT BOTH. Once a transfer is declared the card button goes: a patient
   * who paid by card as well would have paid twice.
   */
  const cardReady = (await railIsReady()) && rail.live.state !== "submitted";

  /*
   * 🔴 RULING 12: BY CARD, THE PATIENT ALSO PAYS THE CARD FEE, and it is shown
   * as its own line where the VAT line used to be, before they press. Worked
   * out by the same function and from the same figure the checkout charges
   * (`gateway/session.ts`): what they owe after any benefit, VAT included, in
   * pounds at the operator's rate. A transfer carries no fee, so the popup's
   * figure below is untouched.
   */
  const cardQuote = cardReady ? await cardFeeQuote(money.settlesCents, tag) : null;

  /*
   * 🔴 PAY BEFORE START, IN PERSON (docs/IN-PERSON-PAID.md): card or company
   * benefit only. A bank transfer takes hours to confirm and the patient is in
   * the room, so it is not offered here; bookings made in advance keep it.
   * "In the room" is a session with no time, or one under two hours away.
   */
  const inRoom =
    inPerson && (!session.scheduledAt || session.scheduledAt.getTime() - Date.now() < 2 * 60 * 60 * 1000);
  if (inRoom) {
    return (
      <>
        <SosOrbServer country={sosCountry} />
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
          <form action={coverWithBenefit.bind(null, token)}>
            <Button type="submit" variant="secondary" full>
              {t("pay.useBenefit")}
            </Button>
            {query.benefit ? <p className="mt-2 text-sm text-slate-600">{t("pay.benefitNot")}</p> : null}
          </form>
          {cardReady ? (
            <form action={payByCard.bind(null, token)}>
              <Button type="submit" full>
                {t("pay.byCard")}
              </Button>
              {cardQuote && cardQuote.feeLabel ? (
                <dl className="mt-2 space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>{t("pay.cardFee")}</dt>
                    <dd className="tabular-nums">{cardQuote.feeLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3 font-semibold text-slate-900">
                    <dt>{t("pay.cardTotal")}</dt>
                    <dd className="tabular-nums">{cardQuote.totalLabel}</dd>
                  </div>
                </dl>
              ) : null}
              {query.card === "unavailable" ? (
                <p className="mt-2 text-sm text-rose-600">{t("pay.cardFailed")}</p>
              ) : null}
            </form>
          ) : (
            <p className="text-sm text-slate-600">{t("pay.inPersonNoCard")}</p>
          )}
        </main>
      </>
    );
  }

  if (rail.needed) {
    return (
      <>
        {/* 51.4 — a payment screen is a patient screen, on both rails. */}
        <SosOrbServer country={sosCountry} />
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
          <BenefitNote shortfall={shortfall} />
          {/*
            🔴 An in-person booking made ahead: the benefit waits for the
            patient to say yes, so the button is here, not spent at booking.
          */}
          {inPerson ? (
            <form action={coverWithBenefit.bind(null, token)}>
              <Button type="submit" variant="secondary" full>
                {t("pay.useBenefit")}
              </Button>
              {query.benefit ? <p className="mt-2 text-sm text-slate-600">{t("pay.benefitNot")}</p> : null}
            </form>
          ) : null}
          {/* 🔴 64.1: by card through the Egyptian gateway, once it is contracted. */}
          {cardReady ? (
            <form action={payByCard.bind(null, token)}>
              <Button type="submit" full>
                {t("pay.byCard")}
              </Button>
              {cardQuote && cardQuote.feeLabel ? (
                <dl className="mt-2 space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>{t("pay.cardFee")}</dt>
                    <dd className="tabular-nums">{cardQuote.feeLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3 font-semibold text-slate-900">
                    <dt>{t("pay.cardTotal")}</dt>
                    <dd className="tabular-nums">{cardQuote.totalLabel}</dd>
                  </div>
                </dl>
              ) : null}
              {query.card === "unavailable" ? (
                <p className="mt-2 text-sm text-rose-600">{t("pay.cardFailed")}</p>
              ) : null}
            </form>
          ) : null}
          {/*
            🔴 76.4 — THE POPUP, OPEN ON ARRIVAL, because this person followed
            a link whose entire purpose was to pay. Everywhere else it opens on
            a button; here the screen IS the payment.
          */}
          <PaymentPopup
            openInitially={!cardReady}
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
                ? t("transfer.subjectSessionWith", { name: therapistName })
                : t("transfer.subjectSession"),
            }}
            details={rail.details}
            amountLabel={rail.amountLabel}
            taxNote={rail.taxNote}
            /* 🔴 76.27 — the session, the benefit's share, and the tax. */
            lines={rail.lines}
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
    <SosOrbServer country={sosCountry} />
    <LanguageCorner />
    {shortfall ? (
      <div className="mx-auto max-w-md px-4 pt-8">
        <BenefitNote shortfall={shortfall} />
      </div>
    ) : null}
    {inPerson ? (
      <form action={coverWithBenefit.bind(null, token)} className="mx-auto max-w-md px-4 pt-8">
        <Button type="submit" variant="secondary" full>
          {t("pay.useBenefit")}
        </Button>
        {query.benefit ? <p className="mt-2 text-sm text-slate-600">{t("pay.benefitNot")}</p> : null}
      </form>
    ) : null}
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

/**
 * The card fee line and the total by card, formatted on the server (C84), or
 * no fee label when the rule is off or nothing is owed.
 */
async function cardFeeQuote(settlesCents: number, locale: string): Promise<{ feeLabel: string; totalLabel: string }> {
  const [{ cardFeeMinorFor, getSettings }, { egpMinorFor, egpRateMicro }, { formatMoney }] = await Promise.all([
    import("@/lib/settings"),
    import("@/lib/billing/manual"),
    import("@/lib/billing/plans"),
  ]);
  const sessionMinor = egpMinorFor(settlesCents, await egpRateMicro());
  const fee = cardFeeMinorFor((await getSettings()).rules, sessionMinor);
  return {
    feeLabel: fee > 0 ? formatMoney(fee, "EGP", locale) : "",
    totalLabel: formatMoney(sessionMinor + fee, "EGP", locale),
  };
}
