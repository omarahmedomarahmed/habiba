import type { Metadata } from "next";

import { ConfirmDomain } from "@/components/sponsor/confirm-domain";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Confirm your domain", robots: { index: false } };
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
  const { t } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <PageHeader
        title="Confirm your domain"
        subtitle="One of the two things we need before your organisation can issue joining codes."
      />
      <ConfirmDomain domainId={id} token={t ?? ""} />
    </main>
  );
}
