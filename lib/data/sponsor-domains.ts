import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sponsorDomains } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Proving a company is a company. PLAN.md 61.1 to 61.6, C318, C319, C348, C349.
 *
 * ## 🔴 THE SENTENCE THIS MODULE EXISTS FOR
 *
 * A joining code funds therapy out of somebody's pot. Until sprint 61 the only
 * thing between a stranger and a corporate account was an operator reading an
 * application form and pressing activate.
 */

/** The TXT record an operator asks IT to publish. Per domain, never per sponsor. */
export const DNS_RECORD_NAME = "_24therapy";

/**
 * 🔴 C318 — IS THIS DOMAIN PROVED? Two facts, and neither alone is enough.
 *
 * An email code proves somebody holds a mailbox at the domain. A DNS TXT record
 * proves somebody controls the domain. Each is individually forgeable by the
 * wrong person: an employee with a mailbox is not authorised to commit their
 * employer to anything, and a contractor who can add a DNS record may never
 * have had an address there.
 *
 * 🔴 C348's agreement is the OR, not a third thing to have as well. University
 * IT does not always add a record this quarter, and a countersigned contract is
 * a stronger proof than either of the two when a person has actually read it.
 *
 * Pure, so the rule can be read and tested without a database, and exported so
 * a verifier can assert that neither half alone passes.
 */
export function domainProved(row: {
  mailboxProvedAt: Date | null;
  dnsProvedAt: Date | null;
  agreementApprovedAt: Date | null;
}): boolean {
  if (row.agreementApprovedAt) return true;
  return Boolean(row.mailboxProvedAt && row.dnsProvedAt);
}

/**
 * 🔴 WHY A SPONSOR MAY NOT HAVE A CODE YET, in words an operator can act on.
 *
 * Returned rather than thrown, and phrased for the person setting it up rather
 * than for us: "prove the domain" is not actionable, "publish this record and
 * click the link we sent" is.
 */
export function domainProblem(row: {
  domain: string;
  mailboxProvedAt: Date | null;
  dnsProvedAt: Date | null;
  agreementApprovedAt: Date | null;
}): string | null {
  if (domainProved(row)) return null;

  if (!row.mailboxProvedAt && !row.dnsProvedAt) {
    return `${row.domain} is not proved yet. We need two things: somebody at that domain clicks the code we email, and your IT team publishes the record below.`;
  }
  if (!row.mailboxProvedAt) {
    return `${row.domain}: the DNS record is published. We still need somebody at that domain to click the code we emailed, which proves a person there asked for this.`;
  }
  return `${row.domain}: somebody at that domain answered our code. We still need the DNS record published, which proves whoever runs the domain agreed to it.`;
}

/** Add a domain to a sponsor, with the token IT will be asked to publish. */
export async function addDomain(input: {
  sponsorId: string;
  domain: string;
}): Promise<{ id?: string; token?: string; error?: string }> {
  const domain = input.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  /*
   * Shape only. A domain we cannot resolve is a domain whose DNS proof will
   * simply never land, which is a better failure than refusing something real
   * because our regular expression was strict about a valid TLD.
   */
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { error: "That does not look like a domain. Enter it without https:// or a path." };
  }

  const token = `24t-verify=${randomBytes(16).toString("base64url")}`;

  try {
    const [created] = await controlDb
      .insert(sponsorDomains)
      .values({ sponsorId: input.sponsorId, domain, dnsToken: token })
      .returning({ id: sponsorDomains.id });

    /*
     * 🔴 61.4 / C320 — THE CODE GOES OUT HERE OR THE PROOF NEVER STARTS.
     *
     * Setup is not complete until a code has been received, and a code nobody
     * sent is a setup that stays unfinished with nothing saying why. Sent to
     * the ADMIN addresses a domain is required to carry, because we have no
     * other address at a domain we have just been told about and asking the
     * sponsor to name one would let them name their own.
     *
     * Best effort: a mail provider having a bad afternoon must not lose the
     * domain row, and the operator can resend from their own screen.
     */
    if (created) {
      const { notify } = await import("@/lib/notify");
      const link = `${env.appUrl}/sponsor/domains/confirm/${created.id}?t=${mailboxToken(created.id)}`;

      await notify(
        { email: `postmaster@${domain}`, phone: null },
        {
          kind: "sponsor.domain_confirm",
          subject: `Confirm ${domain} for your organisation's mental health cover`,
          /*
           * 🔴 NOT ONE WORD ABOUT THERAPY FOR ANY INDIVIDUAL. This lands in a
           * shared mailbox read by whoever runs IT. It says an organisation
           * asked, and it names no person, because 53.2's rule about enrolment
           * strings applies with more force to a message nobody chose to get.
           */
          body: `Somebody at your organisation asked us to set up mental health cover for your people. Confirming this address is one of two checks we do before any joining code works. It commits you to nothing.`,
          link: { label: "Confirm this domain", url: link },
        },
      );
    }

    return { id: created?.id, token };
  } catch {
    /*
     * 🔴 ONE MESSAGE, and it names no other customer.
     *
     * The unique index means this domain belongs to somebody. Saying "acme.com
     * is already registered to another organisation" tells whoever typed it
     * that we have that company as a customer, which is C319's whole point one
     * table over: whether a company buys therapy for its staff is theirs to
     * publish.
     */
    return {
      error:
        "We cannot add that domain here. If your organisation already has an account, talk to whoever set it up.",
    };
  }
}

/** Every domain on this account, proved or not, for their own setup screen. */
export async function domainsFor(sponsorId: string) {
  return controlDb
    .select({
      id: sponsorDomains.id,
      domain: sponsorDomains.domain,
      mailboxProvedAt: sponsorDomains.mailboxProvedAt,
      dnsProvedAt: sponsorDomains.dnsProvedAt,
      agreementApprovedAt: sponsorDomains.agreementApprovedAt,
      dnsToken: sponsorDomains.dnsToken,
    })
    .from(sponsorDomains)
    .where(eq(sponsorDomains.sponsorId, sponsorId))
    .orderBy(sponsorDomains.createdAt);
}

/**
 * 🔴 THE LINK IN THE EMAIL, AND WHY IT IS NOT THE DOMAIN ID.
 *
 * The mailbox proof is a link somebody clicks from an inbox, so the link IS the
 * authorisation: whoever holds it is whoever received the mail. A link carrying
 * the raw row id would let anybody who can guess a uuid prove any domain's
 * mailbox, which is one half of C318 handed away.
 *
 * 🔴 And it cannot be the DNS token either, for the same reason in reverse:
 * that one is published in DNS on purpose, so it is public by construction.
 *
 * An HMAC over the id with `AUTH_SECRET` is unguessable, needs no column, and
 * cannot be minted outside this process. Single use comes from
 * `markMailboxProved` being guarded on the column already being null.
 *
 * 🔴 NOT EXPORTED. `mailboxTokenMatches` is the public surface and `addDomain`
 * is the only thing that mints one. A token generator reachable from outside is
 * a token generator somebody calls to build a second link with different
 * assumptions, and this repository has the same note on `foldArabizi` for the
 * same reason.
 */
function mailboxToken(domainId: string): string {
  return createHmac("sha256", env.authSecret).update(`domain-mailbox:${domainId}`).digest("hex");
}

/** 🔴 Constant time, because a comparison that returns early leaks the prefix. */
export function mailboxTokenMatches(domainId: string, token: string): boolean {
  const expected = Buffer.from(mailboxToken(domainId), "utf8");
  const given = Buffer.from((token ?? "").trim(), "utf8");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/**
 * 🔴 61.4 / C320 — SETUP IS NOT COMPLETE UNTIL A CODE HAS BEEN RECEIVED.
 *
 * Stamped by whatever confirms the mailbox, guarded so a second confirmation
 * does not move the date and rewrite when this happened.
 */
export async function markMailboxProved(domainId: string): Promise<{ ok: boolean }> {
  const [row] = await controlDb
    .update(sponsorDomains)
    .set({ mailboxProvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sponsorDomains.id, domainId), sql`mailbox_proved_at IS NULL`))
    .returning({ id: sponsorDomains.id });

  if (row) log.info("sponsor domain mailbox proved");
  return { ok: Boolean(row) };
}

/** The other half. Stamped when the TXT record is found and matches the token. */
export async function markDnsProved(domainId: string): Promise<{ ok: boolean }> {
  const [row] = await controlDb
    .update(sponsorDomains)
    .set({ dnsProvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sponsorDomains.id, domainId), sql`dns_proved_at IS NULL`))
    .returning({ id: sponsorDomains.id });

  if (row) log.info("sponsor domain dns proved");
  return { ok: Boolean(row) };
}

/**
 * 🔴 61.6 / C349 — "IS MY EMPLOYER HERE" ANSWERS IDENTICALLY EITHER WAY.
 *
 * The obvious build looks the domain up and says yes or no. That turns this
 * product into an oracle for "which companies buy therapy for their staff",
 * answerable by anybody with a list of domains and an afternoon — which is the
 * fact C319 says a company gets to publish or not.
 *
 * So: one message, always, and the work is done whether or not there is
 * anything to find, because a lookup that returns early is a timing side
 * channel that answers the question the message refuses to.
 *
 * 🔴 THE REAL ANSWER REACHES THE PERSON THROUGH THEIR EMPLOYER, which is where
 * it was always going to come from: a joining code on a poster, an intranet
 * page, an HR email. Nothing is lost by refusing here except the oracle.
 */
export async function employerLookup(domain: string): Promise<{ message: string }> {
  const wanted = domain.trim().toLowerCase();

  /*
   * Done unconditionally, and the result deliberately unused. Returning early
   * on an empty string would make a blank submission measurably faster than a
   * real one, which is the same leak in a smaller costume.
   */
  await controlDb
    .select({ id: sponsorDomains.id })
    .from(sponsorDomains)
    .where(sql`lower(${sponsorDomains.domain}) = ${wanted}`)
    .limit(1);

  return {
    message:
      "If your employer or university offers this, they will have given you a joining code: on a poster, an intranet page, or an email from HR. Ask them for it. You can use 24Therapy either way, and nothing about your account depends on having one.",
  };
}
