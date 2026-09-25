import type { Metadata } from "next";

import { listConnections } from "@/lib/data/meeting-connections";
import { PROVIDERS } from "@/lib/meetings/providers";
import { NewSessionForm } from "@/components/session/new-session-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getConnectAccount } from "@/lib/billing/connect";
import { organizationNeedsTransfer } from "@/lib/billing/manual-entry";
import { listPatients } from "@/lib/data/patients";
import { getCountrySettings, getSettings, sessionVatBpsFor } from "@/lib/settings";
import { fullName } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.newSession"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { t } = await getI18n();
  const actor = await requireUser();
  /*
   * W2-T05 (words): `?welcome=1` was read here and nothing ever sent it
   * (signup lands on /onboarding), so its banner never rendered.
   */
  const [, patients, connect, settings, connections, onTransferRail] =
    await Promise.all([
      searchParams,
      listPatients(actor),
      getConnectAccount(actor.userId),
      getSettings(),
      listConnections(actor),
      organizationNeedsTransfer(actor.organizationId),
    ]);

  /*
   * 🔴 76.3 — AN EGYPTIAN CLINICIAN COULD NOT PUT A PRICE ON A BOOKED SESSION.
   *
   * The charge control was offered only when Stripe would accept the money.
   * No Egyptian practice has Stripe: `topUpPot` refuses the entity,
   * `collectionProblem` refuses the gateway, and the whole reason the transfer
   * rail exists is that there is no card rail in this market at all. So the
   * launch market's clinicians opened this form and were shown no price field,
   * and every session they booked was free.
   *
   * 🔴 THE RADAR ALREADY SETTLED THIS ARGUMENT, in its own words, and this file
   * did not get the message: *"The payment now goes through either way; if
   * their account is not ready to receive it, the platform holds their share
   * and releases it on verification. What is left is a disclosure, not a
   * block."* A clinician on the radar with no Stripe charges their standing
   * rate and we hold it. The same clinician booking the same patient an hour
   * later could not name a figure.
   *
   * Two ways to be payable now, and the manual one is not a lesser case: it is
   * the only one this market has.
   */
  const payable = connect.chargesEnabled || onTransferRail;

  /*
   * Read from `country_settings` rather than a constant, because that row is
   * what every other part of this product charges from. A rate hardcoded here
   * would be a second opinion about the tax, and two opinions about a tax is
   * how a clinician is shown one patient total and the patient is asked another.
   */
  const egyptVatBps = onTransferRail
    ? sessionVatBpsFor((await getSettings()).rules, (await getCountrySettings("eg"))?.vatBps ?? 0)
    : 0;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title={t("portal.sessions.newTitle")}
        subtitle={t("portal.sessions.newSubtitle")}
      />
      <div className="px-4 pb-10 sm:px-6">
        <NewSessionForm
          /*
            41.2 — only the providers this clinician has actually connected.
            An option they cannot use is a session that quietly falls back to
            the 24Therapy room, discovered when the patient is already in the
            wrong place.
          */
          connectedProviders={connections.map((connection) => ({
            provider: connection.provider,
            name: PROVIDERS[connection.provider].name,
          }))}
          // 🔴 76.3 — offered when the money can REACH us, by either rail.
          // It used to require Stripe, which no Egyptian practice has, so the
          // launch market could not price a booked session at all.
          payments={
            payable
              ? {
                  defaultRateCents: connect.sessionRateCents,
                  feeBps: settings.session.platformFeeBps,
                  minPriceCents: settings.session.minPriceCents,
                  maxPriceCents: settings.session.maxPriceCents,
                  /*
                   * 🔴 76.3 — WHAT THE PATIENT WILL ACTUALLY BE ASKED FOR.
                   *
                   * The note here used to say only that the patient "also pays
                   * VAT, set by their country", because on the card rail nobody
                   * knows the country until the patient picks one on the pay
                   * page. On the transfer rail that is not true: the rail exists
                   * BECAUSE the practice is Egyptian, so the country is known
                   * before the price is typed, and the exact figure can be shown
                   * while the clinician is still deciding it.
                   */
                  vatBps: egyptVatBps,
                  /* Held rather than paid out, exactly as the radar discloses. */
                  held: !connect.chargesEnabled,
                }
              : undefined
          }
          patients={patients.map((p) => ({
            id: p.id,
            name: fullName(p.firstName, p.lastName, "Unnamed"),
            email: p.email,
          }))}
        />
      </div>
    </div>
  );
}
