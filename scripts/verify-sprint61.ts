/**
 * Sprint 61 acceptance: proving a company is a company.
 *
 *   npm run verify:sprint61
 *
 * ## 🔴 The two sentences this sprint is subordinate to
 *
 * > **Two proofs, and neither alone issues an enrolment code.** (C318)
 * >
 * > **"Is my employer here" answers identically whether or not a domain is a
 * > customer.** (C349)
 *
 * The first is about a stranger funding therapy out of somebody else's pot. The
 * second is about this product becoming an oracle for "which companies buy
 * therapy for their staff", which C319 says is a fact a company publishes or
 * does not.
 */
import { readSource, reporter } from "./_verify";
import { stubModules } from "./_render";

const { check, finish } = reporter();

async function main() {
  /*
   * 🔴 `stubModules` FIRST, before any dynamic import, for the reason sprint 53
   * and 55 both record: `server-only` throws on require outside a Server
   * Component and takes `lib/db` down with it.
   */
  await stubModules();

  const { domainProved, domainProblem } = await import("../lib/data/sponsor-domains");
  const { SETTINGS_DEFAULTS } = await import("../lib/settings/defs");

  const none = { mailboxProvedAt: null, dnsProvedAt: null, agreementApprovedAt: null };
  const at = new Date("2026-06-01T00:00:00Z");

  /* ================================================================== */
  /*  61.1 · two proofs, and neither alone                               */
  /* ================================================================== */

  check(
    "🔴 61.1 / C318 a mailbox code ALONE does not prove a domain",
    !domainProved({ ...none, mailboxProvedAt: at }),
    "an employee with a mailbox is not authorised to commit their employer to anything",
  );

  check(
    "🔴 61.1 / C318 …and a DNS record ALONE does not either",
    !domainProved({ ...none, dnsProvedAt: at }),
    "a contractor who can add a DNS record may never have had an address there",
  );

  check(
    "🔴 61.1 CONTROL both together DO prove it, so the rule is a rule and not a refusal",
    domainProved({ ...none, mailboxProvedAt: at, dnsProvedAt: at }),
    "an absence assertion over a gate that refuses everybody passes",
  );

  check(
    "🔴 61.2 / C348 a countersigned agreement is the OR, for IT that cannot move this quarter",
    domainProved({ ...none, agreementApprovedAt: at }),
    "a contract somebody read is a stronger proof than either half when it exists",
  );

  check(
    "🔴 61.2 …and it names the human who approved it",
    /agreement_approved_by/.test(readSource("drizzle/0091_proving_a_company.sql")) &&
      /sponsor_domains_agreement_pair/.test(readSource("drizzle/0091_proving_a_company.sql")),
    "an admin decision recorded with no admin on it is a decision nobody made",
  );

  check(
    "🔴 61.4 / C320 the refusal tells IT what is still missing, not that it is 'unproved'",
    (domainProblem({ domain: "acme.com", ...none, mailboxProvedAt: at }) ?? "").includes(
      "DNS record",
    ) &&
      (domainProblem({ domain: "acme.com", ...none, dnsProvedAt: at }) ?? "").includes("code"),
    "'prove the domain' is not actionable; 'publish this record' is",
  );

  {
    const { translator } = await import("../lib/i18n/server");
    const arabic = domainProblem({ domain: "example.com", ...none, mailboxProvedAt: at }, translator("ar")) ?? "";
    check(
      "🔴 Board 711 the domain's status sentence is in the reader's language",
      arabic.includes("example.com") && /[؀-ۿ]/.test(arabic) && !/somebody|still need/i.test(arabic),
      "an Arabic company read an English sentence under an Arabic heading",
    );
  }

  /* ================================================================== */
  /*  61.5, 61.6 · what a stranger can learn                             */
  /* ================================================================== */

  const domainsSource = readSource("lib/data/sponsor-domains.ts");

  check(
    "🔴 61.6 / C349 the employer lookup returns ONE message, whatever it finds",
    /export async function employerLookup/.test(domainsSource) &&
      !/found \?|exists \?|row \?/.test(
        domainsSource.slice(domainsSource.indexOf("export async function employerLookup")),
      ),
    "a yes or no here is an oracle for which companies buy therapy for their staff",
  );

  /*
   * 🔴 READ THE CODE, NOT THE PROSE. `readSource` strips comments (C205), so a
   * check matching a sentence in a docblock finds nothing — and if it did find
   * something, it would be asserting that somebody wrote a promise rather than
   * that the code keeps one.
   *
   * The property is that the body has NO BRANCH after the query: no early
   * return, no conditional, no ternary choosing a message. A lookup that
   * returns early when there is nothing to find is a timing side channel
   * answering the exact question the constant message refuses to.
   */
  const lookupBody = (() => {
    const start = domainsSource.indexOf("export async function employerLookup");
    if (start === -1) return "";
    const end = domainsSource.indexOf("\n}", start);
    return end === -1 ? "" : domainsSource.slice(start, end);
  })();

  check(
    "🔴 61.6 …and it does the work either way, so timing answers nothing the message refuses",
    lookupBody.length > 0 &&
      !/\bif\s*\(/.test(lookupBody) &&
      !/\breturn\s+\{[^}]*\}\s*;[\s\S]*return/.test(lookupBody),
    lookupBody.length === 0
      ? "employerLookup not found"
      : "no branch after the query: one path, one message, one shape of work",
  );

  check(
    "🔴 61.3 a domain belongs to ONE sponsor, in the database",
    /sponsor_domains_domain_unique/.test(readSource("drizzle/0091_proving_a_company.sql")),
    "two companies both proving acme.com means the second enrols the first one's staff",
  );

  check(
    "🔴 C319 …and the collision message names no other customer",
    /talk to whoever set it up/.test(domainsSource) &&
      !/already registered to/.test(domainsSource),
    "'acme.com belongs to another organisation' is the oracle again, in a smaller costume",
  );

  check(
    "🔴 61.5 / C319 public listing is still off by default",
    /listed_publicly.*DEFAULT false|listedPublicly.*default\(false\)/.test(
      readSource("lib/db/schema.ts"),
    ),
    "proving a domain is not consenting to be named on a patient's screen",
  );

  /* ================================================================== */
  /*  61.8, 61.9 · provisional, and what it may spend                    */
  /* ================================================================== */

  const potSource = readSource("lib/billing/pot.ts");

  check(
    "🔴 61.8 / C321 a provisional enrolment FUNDS, which is the whole point of it",
    /inArray\(enrolments\.state, \["active", "provisional"\]\)/.test(potSource),
    "making somebody wait for an email means they pay for the first session and never come back",
  );

  check(
    "🔴 61.9 / C350 …and the cap is CLAIMED with a conditional update, not read then written",
    /provisionalSessionsUsed\} \+ 1/.test(potSource) &&
      /provisionalSessionsUsed\} < \$\{cap\}/.test(potSource),
    "two bookings arriving together both read 'none used', both pass a check, and both spend",
  );

  check(
    "🔴 61.9 …and a claim that does not end in a funded session is GIVEN BACK",
    /releaseProvisional/.test(potSource) &&
      (potSource.match(/await releaseProvisional\(\)/g) ?? []).length >= 3,
    "an allowance consumed by a booking that never happened is lost to our bookkeeping",
  );

  check(
    "🔴 61.9 the cap is a setting with a real ceiling",
    SETTINGS_DEFAULTS.sponsor.provisionalSessions === 1 &&
      /max: 10/.test(readSource("lib/settings/defs.ts")),
    "'unlimited until they confirm' must not be typeable by somebody who has not thought about an HR feed",
  );

  check(
    "🔴 61.9 the count is ON THE ROW, not derived from sessions",
    /provisional_sessions_used/.test(readSource("drizzle/0091_proving_a_company.sql")),
    "deriving it means joining the money path to sessions, which is the join C244 exists to prevent",
  );

  /*
   * 🔴 AND THE RULING IS WIRED, which is the check that matters most.
   *
   * "Neither proof alone issues an enrolment code" is a sentence about the
   * enrolment path, not about a helper. A `domainProved` that nothing calls is
   * C318 written down and not enforced, which is the shape C246 spent a whole
   * sprint being.
   */
  const enrolSource = readSource("lib/data/enrolment.ts");

  check(
    "🔴 61.1 / C318 the enrolment path REFUSES an unproved domain",
    /domainProved\(row\)/.test(enrolSource) && /crossed\.kind === "domain_email"/.test(enrolSource),
    "a helper nothing calls is the ruling written down and not enforced",
  );

  check(
    "🔴 61.1 …and only for a domain gate, because an id_number never claimed to prove one",
    /crossed\.kind === "domain_email"/.test(enrolSource),
    "C246 already says a shape is a weak gate, permitted, and the sponsor was told",
  );

  check(
    "🔴 61.1 …and the refusal to the person names no proof and no configuration",
    /That does not match what your organisation asks for/.test(enrolSource),
    "somebody reading a poster in a corridor configured nothing and can fix nothing",
  );

  finish("sprint 61");
}

main();
