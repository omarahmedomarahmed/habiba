"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import {
  addDomain,
  domainsFor,
  markDnsProved,
  markMailboxProved,
} from "@/lib/data/sponsor-domains";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type DomainState = { error?: string; ok?: boolean; token?: string };

/**
 * 🔴 61.1 to 61.4 / C318 — a domain to prove, and the record to publish.
 *
 * `requireSponsorAdmin`, like every other consequential door in this portal. A
 * proved domain is what issues an enrolment code, and an enrolment code funds
 * therapy out of this account's pot.
 *
 * 🔴 Adding a domain proves nothing. It creates the thing to be proved and
 * hands back the record IT publishes, which is why the state carries a token
 * rather than a success message.
 */
export async function addSponsorDomain(
  _prev: DomainState,
  formData: FormData,
): Promise<DomainState> {
  const actor = await requireSponsorAdmin();

  const result = await addDomain({
    sponsorId: actor.sponsorId,
    domain: String(formData.get("domain") ?? ""),
  });

  if (result.error) return { error: result.error };

  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "domain.added",
    resourceType: "sponsor_domain",
    resourceId: result.id ?? null,
  });

  revalidatePath("/sponsor/domains");
  return { ok: true, token: result.token };
}


/**
 * 🔴 61.4 / C320 — CHECK THE RECORD NOW, rather than waiting for a sweep.
 *
 * IT publishes a TXT record and then wants to know it worked. A page that says
 * "we will check within an hour" is a page somebody reloads for an hour.
 *
 * 🔴 The DNS lookup is the proof: we ask the resolver, and the token has to
 * match the one generated for THIS domain. A record copied from another
 * organisation's setup page proves that organisation's domain and not this one,
 * which is why the token is per domain rather than per sponsor.
 */
export async function checkDnsRecord(domainId: string): Promise<DomainState> {
  const actor = await requireSponsorAdmin();

  const rows = await domainsFor(actor.sponsorId);
  const row = rows.find((r) => r.id === domainId);

  /*
   * Scoped to their own account by finding it in their own list rather than by
   * checking afterwards. A borrowed id resolves to nothing.
   */
  if (!row) return { error: "That domain is not on your account." };

  const { resolveTxt } = await import("node:dns/promises");
  const { DNS_RECORD_NAME } = await import("@/lib/data/sponsor-domains");

  let found = false;
  try {
    const records = await resolveTxt(`${DNS_RECORD_NAME}.${row.domain}`);
    found = records.some((chunks) => chunks.join("").trim() === row.dnsToken);
  } catch {
    /*
     * NXDOMAIN, a timeout, a resolver that is having a bad afternoon: all of
     * them mean "we cannot see it", which is what the message says. Treating a
     * resolver failure as a proof would be the one direction that matters.
     */
    found = false;
  }

  if (!found) {
    return {
      error:
        "We cannot see that record yet. DNS changes can take a few minutes to an hour to spread. Check the name and the value match exactly, then try again.",
    };
  }

  await markDnsProved(domainId);

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "domain.dns_proved",
    resourceType: "sponsor_domain",
    resourceId: domainId,
  });

  revalidatePath("/sponsor/domains");
  return { ok: true };
}

/**
 * 🔴 61.4 / C318 — the OTHER proof: somebody at that domain answered our code.
 *
 * Called from the link in the email, which is why it takes the raw token rather
 * than a signed-in actor: the person clicking it is an IT contact who may have
 * no account here at all, and requiring one would make the proof impossible for
 * exactly the organisations that most need it.
 *
 * 🔴 The token is the whole authorisation and it is single use, so this reads
 * like every other one-time link in this product.
 */
export async function confirmDomainMailbox(
  domainId: string,
  token: string,
): Promise<{ ok: boolean }> {
  /*
   * 🔴 THE TOKEN IS THE WHOLE AUTHORISATION, and it is checked in constant time.
   *
   * Taking the raw row id would let anybody who can guess a uuid prove any
   * domain's mailbox, which hands away one half of C318. The DNS token cannot
   * stand in for it either: that one is published in DNS on purpose.
   */
  const { mailboxTokenMatches } = await import("@/lib/data/sponsor-domains");
  if (!mailboxTokenMatches(domainId, token)) return { ok: false };

  const result = await markMailboxProved(domainId);
  revalidatePath("/sponsor/domains");
  return result;
}
