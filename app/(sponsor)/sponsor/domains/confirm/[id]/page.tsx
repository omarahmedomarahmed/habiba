import type { Metadata } from "next";

import { ConfirmDomain } from "@/components/sponsor/confirm-domain";
import { SponsorHeading } from "@/components/sponsor/heading";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.confirmYourDomain"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The other half of C318, clicked from an inbox. PLAN.md 61.4, C320.
 *
 * ## 🔴 NO GUARD, AND THE TOKEN IS WHY
 *
 * The person clicking this is an IT contact at the domain. They may have no
 * account here at all, and requiring one would make the mailbox proof
 * impossible for exactly the organisations that most need it: a university
 * where the person who can answer an address is not the person who signed a
 * contract.
 *
 * So the link IS the authorisation, which is how every one-time link in this
 * product works. The token is an HMAC over the row id with `AUTH_SECRET`:
 * unguessable, mintable only in this process, and compared in constant time.
 * Single use comes from the update being guarded on the column already being
 * null.
 *
 * 🔴 THE PAGE SAYS NOTHING ABOUT WHICH ORGANISATION until the token checks out,
 * and then says only the domain. A page that named a customer to whoever opened
 * a guessed URL would be C319's oracle with a different front door.
 */
export default async function ConfirmDomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t: token } = await searchParams;
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 py-6">
      <SponsorHeading
        title={t("sponsor.confirm.title")}
        subtitle={t("sponsor.confirm.subtitle")}
      />
      <ConfirmDomain domainId={id} token={token ?? ""} />
    </main>
  );
}
