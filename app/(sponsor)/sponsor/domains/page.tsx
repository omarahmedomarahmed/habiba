import type { Metadata } from "next";

import { DomainList } from "@/components/sponsor/domain-list";
import { SponsorHeading } from "@/components/sponsor/heading";
import { DNS_RECORD_NAME, domainProblem, domainsFor } from "@/lib/data/sponsor-domains";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourDomains"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Proving the company is the company. PLAN.md 61.1 to 61.4, C318, C320, C348.
 *
 * ## 🔴 WHY THIS IS A PAGE AND NOT A FIELD ON THE SETTINGS SCREEN
 *
 * Proving a domain is a conversation with somebody else: an IT team publishes a
 * record, a person at the domain clicks a code, and the two land days apart.
 * A field on a settings page implies a thing you type and save. This is a
 * checklist with a state, and it stays visibly unfinished until it is finished
 * (C320: setup is not complete until a code has been received).
 *
 * ## What is not on this page
 *
 * Anybody's name. Proving a domain is a fact about an organisation, and C227
 * says a sponsor performs no act about any individual except removal.
 */
export default async function SponsorDomainsPage() {
  const actor = await requireSponsor();
  const { t } = await getI18n();
  const domains = await domainsFor(actor.sponsorId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SponsorHeading
        title={t("sponsor.domains.title")}
        subtitle={t("sponsor.domains.subtitle")}
      />

      <div>
        <DomainList
          canEdit={actor.role === "admin"}
          recordName={DNS_RECORD_NAME}
          rows={domains.map((row) => ({
            id: row.id,
            domain: row.domain,
            mailboxProved: row.mailboxProvedAt !== null,
            dnsProved: row.dnsProvedAt !== null,
            byAgreement: row.agreementApprovedAt !== null,
            dnsToken: row.dnsToken,
            /*
             * 🔴 The refusal is computed on the server, from the same function
             * the money path reads. A second copy of "what is still missing"
             * written in the component is a second copy that drifts.
             */
            problem: domainProblem({
              domain: row.domain,
              mailboxProvedAt: row.mailboxProvedAt,
              dnsProvedAt: row.dnsProvedAt,
              agreementApprovedAt: row.agreementApprovedAt,
            }, t),
          }))}
        />
      </div>
    </div>
  );
}
