/**
 * Sprint 66 acceptance: the sponsor's own HR connection.
 *
 *   npm run verify:sprint66
 *
 * ## 🔴 The sentence this sprint exists for
 *
 * > **`employment:verify` came home.** It was a partner scope: a third party held a
 * > key and asked us about a company's staff. The company is right here, signed in,
 * > and it is their staff. The organisation an identity question is about should be
 * > the portal somebody is signed into, not a field on a form.
 *
 * ## 🔴 AND THE RULING THAT SURVIVES THE MOVE
 *
 * > **C265 is inherited, not re-implemented.**
 *
 * `verifyEmployment` is byte for byte the function it was when a partner held the
 * key. The checks below assert that rather than trusting it: moving a ruling between
 * portals is exactly the move under which a ruling quietly loses a defence.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { stubModules } from "./_render";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `verify66-${Date.now().toString(36)}`;

async function main() {
  await stubModules();
  writesTo();

  const { API_SCOPES, SPONSOR_SCOPES } = await import("../lib/db/schema");

  /* ================================================================== */
  /*  66.3 / 66.4 · the scope came home, and did not come back           */
  /* ================================================================== */

  check(
    "🔴 66.3 `employment:verify` is a SPONSOR scope",
    (SPONSOR_SCOPES as readonly string[]).includes("employment:verify"),
    SPONSOR_SCOPES.join(", "),
  );

  check(
    "🔴 66.3 …and it is NOT in the partner list, which is what sprint 55 cut",
    !(API_SCOPES as readonly string[]).includes("employment:verify"),
    "the partner key form draws its checkboxes from API_SCOPES; putting it back would offer a third party a scope about somebody else's employees",
  );

  check(
    "🔴 66.4 a sponsor holds exactly ONE scope, so there is nothing to choose",
    SPONSOR_SCOPES.length === 1,
    `${SPONSOR_SCOPES.length} sponsor scopes`,
  );

  const integrations = readSource("lib/data/sponsor-integrations.ts");

  /*
   * 🔴 66.4 — STRUCTURAL RATHER THAN A CHECK, and this is what that means in code.
   *
   * `mintSponsorKey` takes a sponsor id and a label. There is no `scopes` parameter
   * and no second id, so there is no field a form could fill with somebody else's
   * organisation. A validation could be relaxed; an absent parameter cannot.
   */
  const mintBody = (() => {
    const start = integrations.indexOf("export async function mintSponsorKey");
    if (start === -1) return "";
    const end = integrations.indexOf("\n}\n", start);
    return end === -1 ? "" : integrations.slice(start, end);
  })();

  check(
    "🔴 66.4 CONTROL the body extraction found a body, not a signature",
    mintBody.length > 500,
    `${mintBody.length} characters`,
  );

  check(
    "🔴 66.4 the scope is not a parameter: there is no way to name a different one",
    (() => {
      const signature = mintBody.slice(0, mintBody.indexOf("}): Promise"));
      return (
        signature.length > 0 &&
        !/\bscopes\b/.test(signature) &&
        /scopes: \[\.\.\.SPONSOR_SCOPES\]/.test(mintBody)
      );
    })(),
    "a `scopes` argument is a field a form could fill",
  );

  check(
    "🔴 66.4 …and no function in this module takes an organisation it does not own",
    !/partnerId: input\./.test(integrations),
    "a caller who could name the organisation could walk every organisation we have",
  );

  check(
    "🔴 66.2 a key before the switch is refused, because a key that works IS the feature on",
    /Turn employment verification on first/.test(integrations),
    "a key minted while the feature is off answers questions nobody enabled",
  );

  /* ================================================================== */
  /*  66.3 · C265 is inherited, and its four defences are still there    */
  /* ================================================================== */

  const employment = readSource("lib/partner/employment.ts");

  check(
    "🔴 C265 defence 1: the key's OWN sponsor, and there is no parameter for another",
    /const sponsorId = input\.key\.sponsorId/.test(employment) &&
      !/sponsorId: string/.test(employment),
    "a caller who could name the organisation could walk every organisation with one key",
  );

  check(
    "🔴 C265 defence 2: only an identifier somebody typed into their OWN enrolment",
    /enrolmentAttestations/.test(employment),
    "the endpoint is not a directory and never reads one",
  );

  check(
    "🔴 C265 defence 3: the attestation is CLAIMED with a conditional update",
    /\.update\(enrolmentAttestations\)/.test(employment) &&
      /isNull\(enrolmentAttestations\.answeredAt\)/.test(employment),
    "two calls racing on one attestation must not both be answered, so the claim is an UPDATE guarded on the column being null rather than a read then a write",
  );

  const keys = readSource("lib/partner/keys.ts");
  check(
    "🔴 C265 defence 4: an abnormal rate SUSPENDS the key, on the same code path",
    /suspendedAt: new Date\(\)/.test(keys),
    "a limiter that only refuses the surplus call lets an attacker continue at the permitted speed",
  );

  /* ================================================================== */
  /*  66.7 · connected means a call SUCCEEDED                            */
  /* ================================================================== */

  const route = readSource("app/api/hr/v1/employment/route.ts");

  check(
    "🔴 66.7 the success stamp is past EVERY refusal, on the line that answers",
    route.indexOf("stampSuccess") > route.indexOf('"error" in result'),
    "an indicator stamped before the refusals goes green for a key that answered nothing",
  );

  check(
    "🔴 66.7 …and the page's indicator reads lastSuccessAt, never lastUsedAt",
    (() => {
      const page = readSource("app/(sponsor)/sponsor/integrations/page.tsx");
      return /lastSuccessAt/.test(page) && !/lastUsedAt/.test(page);
    })(),
    "lastUsedAt is stamped by the limiter on calls that then fail",
  );

  const component = readSource("components/sponsor/integrations.tsx");
  check(
    "🔴 66.7 …and 'connected' requires a success, not merely an unrevoked key",
    /!key\.revoked && !key\.suspendedReason && key\.lastSuccessAt/.test(component),
    "a green dot that means 'we saved your settings' is the thing this ticket forbids",
  );

  /* ================================================================== */
  /*  66.9 · the log names no employee, ever                             */
  /* ================================================================== */

  /*
   * 🔴 THE SELECT LIST IS THE RULING, and this reads it rather than the paragraph
   * above it. A connection log that named the person each call was about would
   * rebuild the roster C227 removed, inside the audit trail, one row at a time.
   */
  const deliveriesBody = (() => {
    const start = integrations.indexOf("export async function deliveriesFor");
    if (start === -1) return "";
    const end = integrations.indexOf("\n}\n", start);
    return end === -1 ? "" : integrations.slice(start, end);
  })();

  const NAMES = /identifier|employee|staffNumber|subjectRef|payload|body|email|name/i;

  check(
    "🔴 66.9 the delivery log selects nothing that could name an employee",
    deliveriesBody.length > 200 && !NAMES.test(deliveriesBody),
    deliveriesBody.length > 200
      ? "an event, a status, a time and an error"
      : "the body extraction failed",
  );

  check(
    "🔴 66.9 CONTROL the same scan CATCHES a column somebody would add",
    ["identifier", "employeeEmail", "payload", "subjectRef"].every((column) =>
      NAMES.test(column),
    ),
    "identifier · employeeEmail · payload · subjectRef",
  );

  check(
    "🔴 66.11 the spike is a COUNT and never a list of what people typed",
    /count\(\*\)::int/.test(integrations) && !/select identifier/i.test(integrations),
    "a list of failed attempts is a list of guesses at staff numbers, and tells somebody which were close",
  );

  /* ================================================================== */
  /*  66.2 · the sentence is in front of the switch                      */
  /* ================================================================== */

  const { DICTIONARIES } = await import("../lib/i18n/messages");

  for (const locale of ["en", "ar"] as const) {
    const dict = DICTIONARIES[locale];
    check(
      `🔴 66.2 / 66.12 the "we never read your directory" sentence exists in ${locale.toUpperCase()}`,
      typeof dict["sint.neverBody"] === "string" && dict["sint.neverBody"].length > 40,
      dict["sint.neverBody"]?.slice(0, 60) ?? "missing",
    );
  }

  check(
    "🔴 66.2 …and it is rendered ABOVE the control rather than below it",
    component.indexOf("sint.neverBody") < component.indexOf("sint.turnOn"),
    "a sentence under a switch is a footnote, and this one is the reason to press it",
  );

  /* ================================================================== */
  /*  the database, as it actually is                                    */
  /* ================================================================== */

  const { pool, db } = connect();

  try {
    const columns = await db.execute(sql`
      SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'partner_api_keys'
         AND column_name IN ('partner_id', 'sponsor_id', 'last_success_at')`);

    const byName = new Map(
      columns.rows.map((row) => {
        const r = row as { column_name: string; is_nullable: string };
        return [r.column_name, r.is_nullable];
      }),
    );

    check(
      "🔴 H1 66.4 `partner_id` is nullable, so a sponsor's key can exist at all",
      byName.get("partner_id") === "YES" && byName.has("last_success_at"),
      JSON.stringify([...byName]),
    );

    const owner = await db.execute(sql`
      SELECT convalidated FROM pg_constraint WHERE conname = 'partner_api_keys_one_owner'`);

    check(
      "🔴 H1 …and a key with NO owner is refused by a validated constraint",
      owner.rows.length === 1 &&
        (owner.rows[0] as { convalidated: boolean }).convalidated === true,
      JSON.stringify(owner.rows),
    );

    /* 🔴 AND THE CONSTRAINT ACTUALLY REFUSES ONE. */
    let refused = false;
    try {
      await db.execute(sql`
        INSERT INTO partner_api_keys (label, key_hash, prefix, scopes, environment)
        VALUES (${fixture}, ${fixture}, '24t_x', '[]'::jsonb, 'sandbox')`);
    } catch {
      refused = true;
    }

    check(
      "🔴 66.4 CONTROL the database refuses a key belonging to nobody",
      refused,
      "a key nobody owns should not be storable, not merely unfindable",
    );

    /* 🔴 AND A REAL SPONSOR KEY CAN BE MINTED AND REVOKED. */
    const [row] = (
      await db.execute(sql`
        INSERT INTO sponsors (name, kind, state, entity, currency,
                              employment_verification_enabled_at)
        VALUES (${fixture}, 'company', 'active', 'us', 'usd', now()) RETURNING id`)
    ).rows as { id: string }[];
    const sponsor = required(row, "a sponsor");

    const { mintSponsorKey, revokeSponsorKey, integrationFor } = await import(
      "../lib/data/sponsor-integrations"
    );

    const minted = await mintSponsorKey({ sponsorId: sponsor.id, label: "HR" });
    check(
      "🔴 66.4 a sponsor mints a key from their own session, with the one scope",
      Boolean(minted.raw) && minted.raw!.startsWith("24t_hr_"),
      minted.error ?? minted.prefix ?? "no key",
    );

    const before = await integrationFor(sponsor.id);
    check(
      "🔴 66.7 CONTROL …and it is NOT connected, because nothing has answered yet",
      before.keys.length === 1 && before.keys[0]!.lastSuccessAt === null,
      "a freshly minted key has never answered anything",
    );

    const gone = await revokeSponsorKey({
      sponsorId: sponsor.id,
      keyId: before.keys[0]!.id,
    });
    check("🔴 66.10 …and they can revoke it from the same page", gone.ok, "revoked");

    /*
     * 🔴 66.2 — SWITCHING IT OFF REVOKES THE KEYS, which is the half a toggle misses.
     */
    const second = await mintSponsorKey({ sponsorId: sponsor.id, label: "HR 2" });
    required(second.raw, "a second key");

    const { setEmploymentVerification } = await import("../lib/data/sponsor-integrations");
    await setEmploymentVerification({
      sponsorId: sponsor.id,
      enabled: false,
      hrSystem: null,
    });

    const after = await integrationFor(sponsor.id);
    check(
      "🔴 66.2 switching employment verification OFF revokes every key with it",
      !after.enabled && after.keys.every((key) => key.revokedAt !== null),
      `${after.keys.filter((key) => key.revokedAt === null).length} key(s) still live`,
    );

    const refusedNow = await mintSponsorKey({ sponsorId: sponsor.id, label: "HR 3" });
    check(
      "🔴 66.2 …and a key cannot be minted while it is off",
      Boolean(refusedNow.error),
      refusedNow.error ?? "one was minted",
    );
  } finally {
    await db.execute(sql`DELETE FROM partner_api_keys WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name = ${fixture})`);
    await db.execute(sql`DELETE FROM partner_api_keys WHERE label = ${fixture}`);
    await db.execute(sql`DELETE FROM sponsors WHERE name = ${fixture}`);
    await pool.end();
  }

  finish("sprint 66");
}

main();
