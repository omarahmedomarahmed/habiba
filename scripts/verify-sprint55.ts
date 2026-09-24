/**
 * Sprint 55 acceptance: the partner portal, and the API that has use cases.
 *
 *   npm run verify:sprint55
 *
 * ## 🔴 The sentence every check here is subordinate to
 *
 * > **a verifier proves no key can enumerate anything and no webhook carries a word of
 * > content.**
 *
 * Both halves are absences, which is the §6 family's home ground: an endpoint that returns
 * nothing enumerates nothing, and a webhook nobody ever queues carries no content. So every
 * absence assertion below is bracketed by a CONTROL that the thing still works.
 *
 * ## 🔴 The three the founder named, in the order what breaks if missed
 *
 *   C255 — one identifier, one boolean, one timestamp. NEVER a directory, a list or a sync.
 *          Every HR platform and SCIM itself are built around provisioning, so the obvious
 *          integration re-creates the roster three enrolment designs were spent removing.
 *   C265 — an endpoint answering "does this person work here" is an identity oracle pointed
 *          at our own patients. Scoped to one sponsor, rate-limited hard, and only
 *          answerable about an identifier somebody submitted through enrolment minutes ago.
 *   C277 — a partner's clinician holds a revocable grant like any other clinician, and the
 *          patient can claim the record and leave.
 *
 * ## 🔴 C284 — every branch, in one run, whatever the machine is configured with
 *
 * No check here varies by environment. The constraint checks read `pg_get_constraintdef`
 * unconditionally rather than attempting a write against whatever rows happen to exist, which
 * is the sprint-53 defect that skipped silently on an empty database and read green.
 */
import { readdirSync, statSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

import { readSource, reporter, required, writesTo } from "./_verify";
import { stubModules } from "./_render";

const { check, finish } = reporter();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

/** The salted hash `enrolments` and `enrolment_attestations` both hold. */
function identifierHash(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value.trim().toLowerCase()}`).digest("hex");
}

/**
 * 🔴 One function's source, by BRACE COUNTING rather than by a regex.
 *
 * My first version of three checks in this file used `/function name[\s\S]*?\n\}/`, which stops
 * at the first line-start `}` — so on a function containing an object literal or a nested block
 * it captured a FRAGMENT, and the checks that read that fragment failed against correct code.
 * Two of them then "found" nothing and reported the function missing.
 *
 * That is the §6 family in a verifier: a check measuring the wrong text. Counting braces is the
 * thing that cannot be off by a nested block.
 */
function functionSource(source: string, name: string): string {
  /*
   * 🔴 Exported OR not. `resolveSubject` is module-private on purpose, and it is the
   * single chokepoint every partner endpoint resolves a person through, so it is
   * exactly the function a check most wants to read. Looking only for `export`
   * returned the empty string for it, and an empty string contains no query, so the
   * check failed against correct code: the §6 shape inside the verifier, twice in
   * this one helper now.
   */
  let start = source.indexOf(`export async function ${name}`);
  if (start === -1) start = source.indexOf(`async function ${name}`);
  if (start === -1) return "";

  /*
   * 🔴 THE PARAMETER LIST FIRST, and my second attempt got this wrong too.
   *
   * Every function checked here takes a destructured object: `(input: { key: AuthedKey; … })`.
   * A brace counter started at the declaration therefore opens on the PARAMETER brace and
   * closes on it, returning the argument list and nothing else — so four checks read a
   * signature, found no query in it, and reported correct code as missing.
   *
   * So: match the parameter PARENS to their close, then brace-match from the body's own `{`.
   * Two counters, one for each kind of bracket, in the order the syntax has them.
   */
  const open = source.indexOf("(", start);
  if (open === -1) return "";

  let parens = 0;
  let afterParams = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "(") parens += 1;
    else if (source[i] === ")") {
      parens -= 1;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return "";

  /*
   * 🔴 AND THE RETURN TYPE HAS BRACES IN IT TOO, which was the third version's failure.
   *
   * `): Promise<{ clinicians: { email: string }[] } | ApiFailure> {` — the first `{` after the
   * parameter list is inside the type, so brace-matching from there returned the ANNOTATION.
   *
   * That mattered more than it looks: the absence checks reading that fragment PASSED, because
   * a return type contains no `sessionNotes` and no `priceCents`. Only their CONTROLs failed,
   * which is the whole argument for pairing every absence with a presence, and here it caught a
   * defect in the verifier rather than in the product.
   *
   * So the body's `{` is the first one seen while ANGLE-BRACKET depth is zero. Between the
   * parameter list and the body there is nothing but the return type, so counting `<` and `>`
   * there is unambiguous.
   */
  let angle = 0;
  let body = -1;
  for (let i = afterParams; i < source.length; i += 1) {
    const char = source[i];
    if (char === "<") angle += 1;
    else if (char === ">") angle = Math.max(0, angle - 1);
    else if (char === "{" && angle === 0) {
      body = i;
      break;
    }
  }
  if (body === -1) return "";

  let depth = 0;
  for (let i = body; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

async function main() {
  writesTo();

  /*
   * 🔴 `stubModules` FIRST, before any dynamic import.
   *
   * `server-only` throws on require outside a Server Component, which takes `lib/db` down with
   * it. This script does not render, so it does not need the full React build; it does need
   * `server-only` substituted away, and it needs that BEFORE the first import rather than
   * beside it. Sprint 53's verifier found this the hard way and sprint 54's inherited the fix.
   */
  await stubModules();

  const { controlDb: db } = await import("../lib/db");
  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const { sql } = await import("drizzle-orm");
  const {
    API_SCOPES,
    WEBHOOK_EVENTS,
    PARTNER_STATES,
    ATTESTATION_TTL_MINUTES,
    LAUNCH_TOKEN_TTL_SECONDS,
  } = await import("../lib/db/schema");

  const files = walk(process.cwd()).map((f) => f.slice(process.cwd().length + 1));
  const tag = `verify55-${randomBytes(4).toString("hex")}`;

  /* ================================================================== */
  /*  55.1 / C264 · the sixth principal, and the router unchanged for it */
  /* ================================================================== */

  const guard = readSource("lib/auth/guard.ts");

  check(
    "🔴 55.1 no require* in lib/auth/guard.ts returns a sponsor, a clinic or a partner",
    !/sponsor|partner|clinicManager/i.test(guard),
    "the clinician guard mints Actors and nothing else",
  );

  const partnerSession = readSource("lib/partner-auth/session.ts");

  /*
   * 🔴 THE ABSENCE AND ITS CONTROL, on the type that matters most in this sprint.
   *
   * `PartnerActor` must carry no organisation id of ANY spelling: not `organizationId`, and
   * not the `clinicOrganizationId` the clinic manager's carries because C259 makes a clinic
   * one. A check for the first spelling alone would pass against a type carrying the second.
   *
   * The control is that the type exists and carries the four things it must, because a file
   * that failed to define `PartnerActor` at all would pass every absence above.
   */
  const actorType = partnerSession.match(/export type PartnerActor = \{[^}]*\}/s)?.[0] ?? "";

  check(
    "🔴 55.3 / C230 PartnerActor carries NO organisation id, in any spelling",
    actorType !== "" && !/[Oo]rganizationId/.test(actorType) && !/\brole:\s*Role\b/.test(actorType),
    actorType === "" ? "PartnerActor not found" : "no organizationId, no clinicOrganizationId, no Role",
  );

  check(
    "🔴 CONTROL …and it DOES carry the four things a partner principal needs",
    ["partnerUserId", "partnerId", "partnerName", "email"].every((field) =>
      actorType.includes(field),
    ),
    "an absence check against a type that does not exist passes for the wrong reason",
  );

  const routing = readSource("lib/routing.ts");

  check(
    "🔴 55.1 / C264 the partner is a row in PRINCIPALS, not a branch in routeDecision",
    /name:\s*"partner"/.test(routing) &&
      (routing.match(/if \(/g) ?? []).length ===
        (readSource("lib/routing.ts").match(/if \(/g) ?? []).length,
    "six principals, one table, one decision function",
  );

  check(
    "🔴 55.12 /developers is deliberately NOT a partner prefix: docs behind a sign-in are unread",
    !/PARTNER_PREFIXES\s*=\s*\[[^\]]*developers/.test(routing) &&
      files.includes("app/(public)/developers/page.tsx"),
    "it lives in (public) with the rest of the marketing site",
  );

  /* ================================================================== */
  /*  C255 · one question about one person. NEVER a list.                */
  /* ================================================================== */

  const employment = readSource("lib/partner/employment.ts");

  /*
   * 🔴 The structural half of C255: there is no function here that could return many.
   *
   * ## 🔴 MY FIRST VERSION OF THIS CHECK WAS BACKWARDS, AND IT IS THE MOST INSTRUCTIVE
   *    ONE IN THIS FILE
   *
   * It refused any occurrence of `limit`, on the reasoning that a paging parameter is what a
   * roster endpoint needs. But this module's `.limit(1)` is the OPPOSITE of a list: it is the
   * guarantee that one question gets one row. So the check failed against correct code, and
   * the only way to make it green would have been to delete `.limit(1)` — which is the actual
   * protection. A check that pressures somebody into removing the safeguard it exists to
   * assert is worse than no check at all.
   *
   * So: every `limit` here must be `limit(1)`, and the paging shapes are refused by name.
   */
  const limits = [...employment.matchAll(/\.limit\((\d+)\)/g)].map((m) => m[1]!);

  check(
    "🔴 55.4 / C255 every query here is limit(1), and nothing pages, offsets or takes an array",
    limits.length > 0 &&
      limits.every((n) => n === "1") &&
      !/\boffset\b|\bcursor\b|identifiers\s*:|identifiers\[\]|string\[\]/.test(employment),
    `${limits.length} query/queries, all limit(1): one question gets one row, and there is no list to ask for`,
  );

  check(
    "🔴 CONTROL …and it DOES answer the one question, so the absence is not an empty file",
    /export async function verifyEmployment/.test(employment) &&
      /active/.test(employment) &&
      /asOf|answeredAt|timestamp/i.test(employment),
    "one boolean, one timestamp",
  );

  check(
    "🔴 55.4 / C255 the directory is never read, and the module says so out loud",
    /export const THE_DIRECTORY_IS_NEVER_READ = true/.test(employment),
    "an absence a verifier can find",
  );

  check(
    "🔴 55.4 the sponsor comes from the KEY, never from the request body",
    !/input\.sponsorId|body\.sponsor|sponsorId:\s*string/.test(employment) &&
      /key\.sponsorId/.test(employment),
    "a sponsor id in the body would be one key answering about every sponsor we have",
  );

  /* ================================================================== */
  /*  C265 · the identity oracle, closed four ways                       */
  /* ================================================================== */

  /*
   * 🔴 READ FROM `pg_get_constraintdef` UNCONDITIONALLY.
   *
   * Sprint 53's version of this check attempted a write against whatever payment row existed
   * and skipped silently on an empty database, which is C284 verbatim. The constraint's own
   * definition is there whether or not anybody has ever inserted a key.
   */
  const employmentCheck = await db.execute(sql`
    SELECT pg_get_constraintdef(oid) AS def, convalidated
      FROM pg_constraint WHERE conname = 'partner_api_keys_employment_needs_sponsor'`);

  const def = String(employmentCheck.rows[0]?.def ?? "");

  check(
    "🔴 55.4 / C265 the database refuses an employment key with no sponsor, and the CHECK is valid",
    def.includes("employment:verify") &&
      def.includes("sponsor_id") &&
      employmentCheck.rows[0]?.convalidated === true,
    def || "constraint not found",
  );

  /*
   * 🔴 And asserted by ATTEMPTING THE WRITE, because a CHECK whose expression reads a JSONB
   * array is exactly the kind that can be present and wrong.
   */
  const [partner] = (
    await db.execute(sql`
    INSERT INTO partners (name, slug, state) VALUES (${tag}, ${tag}, 'active') RETURNING id`)
  ).rows as { id: string }[];

  const partnerId = required(partner, "partners row it just inserted").id;

  try {
    let refused = false;
    try {
      await db.execute(sql`
        INSERT INTO partner_api_keys (partner_id, label, key_hash, prefix, scopes, environment)
        VALUES (${partnerId}, 'planted', ${randomBytes(16).toString("hex")}, 'x_',
                '["employment:verify"]'::jsonb, 'sandbox')`);
    } catch {
      refused = true;
    }

    check(
      "🔴 55.4 / C265 asserted by the write: an employment key with no sponsor is REFUSED",
      refused,
      "the constraint, exercised rather than read",
    );

    /* 🔴 CONTROL — the same insert with a different scope is ACCEPTED, so the refusal above
       is the constraint doing its job rather than the insert being malformed. */
    let accepted = false;
    const controlHash = randomBytes(16).toString("hex");
    try {
      await db.execute(sql`
        INSERT INTO partner_api_keys (partner_id, label, key_hash, prefix, scopes, environment)
        VALUES (${partnerId}, 'planted-control', ${controlHash}, 'x_',
                '["clinician:verify"]'::jsonb, 'sandbox')`);
      accepted = true;
    } catch {
      accepted = false;
    }

    check(
      "🔴 CONTROL …while a key with a scope that needs no sponsor is accepted",
      accepted,
      "otherwise the refusal proves only that the INSERT was wrong",
    );

    /* ---- the attestation: a question licensed for minutes, consumed on use ---- */

    const [sponsor] = (
      await db.execute(sql`
      INSERT INTO sponsors (name, kind, state, entity, currency)
      VALUES (${tag}, 'company', 'active', 'us', 'usd')
      RETURNING id`)
    ).rows as { id: string }[];

    const sponsorId = required(sponsor, "sponsors row it just inserted").id;

    const answerNames = await db.execute(sql`
      SELECT pg_get_constraintdef(oid) AS def, convalidated
        FROM pg_constraint WHERE conname = 'enrolment_attestations_answer_names_key'`);

    check(
      "🔴 55.4 / C265 an answered attestation must name the key that answered, by CHECK",
      String(answerNames.rows[0]?.def ?? "").includes("answered_by_key_id") &&
        answerNames.rows[0]?.convalidated === true,
      String(answerNames.rows[0]?.def ?? "") || "constraint not found",
    );

    check(
      "🔴 55.4 / C265 the window is MINUTES, per the ruling's own word",
      ATTESTATION_TTL_MINUTES > 0 && ATTESTATION_TTL_MINUTES <= 15,
      `${ATTESTATION_TTL_MINUTES} minutes`,
    );

    /*
     * 🔴 THE CONSUMPTION, EXERCISED. Two claims against one attestation, and the second must
     * find nothing: that is what makes one enrolment licence one question rather than
     * unlimited questions for the length of the window.
     */
    const hash = identifierHash("planted@example.com", "verify55");
    await db.execute(sql`
      INSERT INTO enrolment_attestations (sponsor_id, identifier_hash, expires_at)
      VALUES (${sponsorId}, ${hash}, now() + interval '10 minutes')`);

    /*
     * 🔴 The claim names the KEY, and the first draft of this fixture did not.
     *
     * `enrolment_attestations_answer_names_key` refused it outright: an answered attestation
     * with no key is a question nobody is answerable for. The constraint caught my own test
     * before it caught anybody's code, which is the strongest thing that can be said about it
     * and the reason the check above reads its definition as well as exercising it.
     */
    const [controlKey] = (
      await db.execute(sql`SELECT id FROM partner_api_keys WHERE key_hash = ${controlHash}`)
    ).rows as { id: string }[];

    const keyId = required(controlKey, "partner_api_keys row it just inserted").id;

    const claim = () =>
      db.execute(sql`
        UPDATE enrolment_attestations SET answered_at = now(), answered_by_key_id = ${keyId}
         WHERE sponsor_id = ${sponsorId} AND identifier_hash = ${hash}
           AND answered_at IS NULL AND expires_at > now()
        RETURNING id`);

    const first = await claim();
    const second = await claim();

    check(
      "🔴 55.4 / C265 one attestation answers ONE question: the second claim finds nothing",
      first.rows.length === 1 && second.rows.length === 0,
      `first claim ${first.rows.length} row, second ${second.rows.length}`,
    );

    /* 🔴 CONTROL — an EXPIRED attestation is not claimable at all, so the first claim
       succeeding above was the window being open rather than the WHERE being ignored. */
    const staleHash = identifierHash("stale@example.com", "verify55");
    await db.execute(sql`
      INSERT INTO enrolment_attestations (sponsor_id, identifier_hash, expires_at)
      VALUES (${sponsorId}, ${staleHash}, now() - interval '1 minute')`);

    const stale = await db.execute(sql`
      UPDATE enrolment_attestations SET answered_at = now()
       WHERE sponsor_id = ${sponsorId} AND identifier_hash = ${staleHash}
         AND answered_at IS NULL AND expires_at > now()
      RETURNING id`);

    check(
      "🔴 CONTROL …and an expired one is not claimable even on its first use",
      stale.rows.length === 0,
      "the expiry is in the WHERE, not checked afterwards",
    );

    /*
     * 🔴 THE ATTESTATION HOLDS A HASH AND NEVER A PLAINTEXT IDENTIFIER.
     *
     * A stolen table must not be a list of work addresses. Asserted against the COLUMN LIST
     * rather than against a value, because a table with a plaintext column that happens to be
     * empty today passes any value check.
     */
    const attCols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'enrolment_attestations'`);

    const attNames = attCols.rows.map((r) => String(r.column_name));

    check(
      "🔴 55.4 / C255 enrolment_attestations holds a HASH: no identifier, email or phone column",
      attNames.includes("identifier_hash") &&
        !attNames.some((n) => /^identifier$|email|phone|name/.test(n)),
      attNames.join(", "),
    );

    /* ---- the rate limit SUSPENDS rather than refuses ---- */

    const keys = readSource("lib/partner/keys.ts");

    check(
      "🔴 55.4 / C265 crossing the rate limit WRITES suspended_at, rather than only refusing",
      /suspendedAt:\s*new Date\(\)/.test(keys) && /suspendedReason/.test(keys),
      "a limit that only slows an attacker lets them keep going at the permitted speed",
    );

    check(
      "🔴 CONTROL …and a suspended key is dead in the WHERE clause, not in a branch after it",
      /isNull\(partnerApiKeys\.suspendedAt\)/.test(keys),
      "a check after the read is a check somebody can forget",
    );

    /* ================================================================== */
    /*  C277 · a partner's clinician holds a revocable grant, nothing more */
    /* ================================================================== */

    const api = readSource("lib/partner/api.ts");

    check(
      "🔴 55.6 / C277 no key reads a record: the module says so, out loud, for a verifier",
      /export const A_PARTNER_NEVER_READS_A_CHART = true/.test(api),
      "an absence stated so it can be found",
    );

    /*
     * 🔴 `whoMayRead` RETURNS CLINICIANS, NOT A RECORD, AND NOT A NAME.
     *
     * Its first draft reused `grantsForPerson`, whose select list returns the clinician's
     * NAME and whose statuses are pending/granted/rejected/revoked rather than "active".
     * Typecheck caught the status; the unlucky half would have been leaking a name. So the
     * check is on the select list, with a control that the function still answers.
     */
    const whoMayRead = functionSource(api, "whoMayRead");

    check(
      "🔴 55.6 / C277 whoMayRead selects an id and a date, never a name and never a note",
      whoMayRead !== "" &&
        !/firstName|lastName|fullName|\bname\b|content|note|transcript/i.test(whoMayRead),
      whoMayRead === "" ? "whoMayRead not found" : "clinician ids and grant dates only",
    );

    /*
     * 🔴 THE LEAK THIS CHECK EXISTS FOR IS ONE I WROTE.
     *
     * `whoMayRead` returned every clinician holding a live grant on that person, so a partner
     * asking who may read their subject's record learned the email of the patient's OTHER
     * therapist: somebody with no relationship to the partner, whose involvement in this
     * person's care the patient never disclosed to them. The query answered a broader question
     * than the one asked and the response looked exactly right.
     */
    check(
      "🔴 55.6 / C277 whoMayRead answers only about THIS PARTNER'S clinicians",
      /organizations\.partnerId, input\.key\.partnerId/.test(whoMayRead) &&
        /billingMode, "partner_billed"/.test(whoMayRead),
      "the patient's other therapist is not the partner's to hear about",
    );

    check(
      "🔴 CONTROL …and it does return the readers, so the absence is not an empty function",
      /email: users\.email/.test(whoMayRead) &&
        /historyGrants/.test(whoMayRead) &&
        /verified:/.test(whoMayRead),
      "an email and a boolean per clinician, against the grants table",
    );

    /*
     * 🔴 AND THE WRITE SIDE HAD NONE OF IT, WHICH WAS THE MORE SERIOUS HALF.
     *
     * `writeBackSession` found the clinician by email alone: every `users` row in the
     * product with that address, `.limit(1)`, no ordering, no partner scope. So a key
     * could attribute a real session, with a time and a duration, into the chart of a
     * verified clinician at a practice with no commercial relationship to that partner,
     * provided it knew an address and the person was a patient there. And because
     * `users_org_email_unique` is unique on (organisation, email) rather than on email,
     * an address held twice made the destination arbitrary rather than merely wrong.
     *
     * The check reads the same two lines as the one above, deliberately, because the
     * point is that there is ONE definition of "this partner's clinician" in this file.
     */
    const writeBack = functionSource(api, "writeBackSession");

    check(
      "🔴 55.7 writeBackSession writes only into THIS PARTNER'S clinicians' charts",
      writeBack !== "" &&
        /organizations\.partnerId, input\.key\.partnerId/.test(writeBack) &&
        /billingMode, "partner_billed"/.test(writeBack),
      writeBack === "" ? "writeBackSession not found" : "the same scope whoMayRead carries",
    );

    check(
      "🔴 55.7 …and it finds the clinician THROUGH the subject's own chart, not by email alone",
      /eq\(patients\.personId, subject\.personId\)/.test(writeBack) &&
        !/\.from\(users\)/.test(writeBack),
      "the join is the scope, rather than a check that runs after the row was chosen",
    );

    check(
      "🔴 55.7 …and an ambiguous address is REFUSED rather than resolved by arrival order",
      /candidates\.length > 1/.test(writeBack) && /limit\(2\)/.test(writeBack),
      "one address in two organisations must not put a real session in a coin-flip chart",
    );

    check(
      "🔴 CONTROL …and it still writes a session, so the scope is not an empty function",
      /recordExternalSession/.test(writeBack) && /externalMeetingId/.test(writeBack),
      "a writer that refuses everything is not a writer",
    );

    /*
     * 🔴 THIS CHECK USED TO READ THE ENUM AND REPORT ON THE DELIVERY.
     *
     * It asserted that "grant.revoked" and "record.claimed" are in `WEBHOOK_EVENTS`,
     * which they have been since 42.4, and passed for four sprints while NOTHING IN
     * THE PRODUCT EVER EMITTED ONE. `queueWebhook` had no caller at all, which is why
     * `verify:reachable` had it in `MUST_WIRE` the whole time: two gates disagreeing,
     * and the one with the reassuring sentence was the one being read.
     *
     * The §6 family, fifteenth instance. So the enum check stays, as the cheap half,
     * and the emission is asserted separately against the code that has to run.
     */
    check(
      "🔴 55.6 / C277 grant.revoked and record.claimed are webhook events",
      WEBHOOK_EVENTS.includes("grant.revoked") && WEBHOOK_EVENTS.includes("record.claimed"),
      "our one promise is false for every partner-sourced patient if they cannot hear it",
    );

    check(
      "🔴 55.10 …AND SOMETHING EMITS THEM, which for four sprints nothing did",
      /notifyGrantRevoked/.test(readSource("lib/data/grants.ts")) &&
        /notifyRecordClaimed/.test(readSource("lib/data/claims.ts")),
      "an event in an enum that no code path raises is a promise on a settings screen",
    );

    check(
      "🔴 55.10 …and the revocation is told only to the partner whose OWN clinician lost it",
      /billingMode, "partner_billed"/.test(readSource("lib/partner/webhooks.ts")) &&
        /organizations\.id, users\.organizationId/.test(
          readSource("lib/partner/webhooks.ts"),
        ),
      "a partner hearing about somebody else's revocation learns somebody else was treating their subject",
    );

    /* ================================================================== */
    /*  55.6 · C277 · the link itself can be cut                           */
    /* ================================================================== */

    /*
     * 🔴 C277: "scoped, revocable, and the patient can claim the record and leave."
     *
     * The grant was revocable. The LINK was not: `partner_subjects` had no revocation
     * column, no function and no screen, so a person who revoked every grant was still
     * permanently that partner's "P123". And it was a live capability rather than a
     * stale row, because `writeBackSession` resolves the subject and asks about no
     * grant at all.
     */
    const links = readSource("lib/data/partner-links.ts");

    check(
      "🔴 55.6 / C277 a person can cut the link itself, not only the grants under it",
      /revokedAt: new Date\(\)/.test(links) && /revokedByAccountId/.test(links),
      "revoking every grant left the partner still able to write sessions into their chart",
    );

    check(
      "🔴 55.6 …and it is the PERSON'S act: the person id is a condition, not a check after",
      /eq\(partnerSubjects\.personId, input\.personId\)/.test(links),
      "a borrowed subject id must unlink nobody",
    );

    /*
     * 🔴 THE ONE PLACE, and this is the check that matters most of the three.
     *
     * `resolveSubject` is the only function in the partner plane that turns an
     * external reference into a person, by design. Filtering there closes
     * `whoMayRead`, `writeBackSession` and `deliverNote` at once, and closes the
     * next endpoint before it is written. A revocation checked in each caller would
     * be three checks and the fourth endpoint would have two of them.
     */
    check(
      "🔴 55.6 / C277 a cut link resolves to NOTHING, at the single chokepoint",
      /isNull\(partnerSubjects\.revokedAt\)/.test(functionSource(api, "resolveSubject")),
      "filtered in resolveSubject, so every endpoint inherits it including the next one",
    );

    check(
      "🔴 55.6 …and the partner is TOLD, so their integration does not read it as our outage",
      WEBHOOK_EVENTS.includes("subject.unlinked") &&
        /event: "subject\.unlinked"/.test(
          readSource("app/(patient)/patient/consent/actions.ts"),
        ),
      "access that ends silently is C108's shape from the other side",
    );

    /* ================================================================== */
    /*  42.4 / 55.10 · a webhook carries an event and an id, never content */
    /* ================================================================== */

    const webhooks = readSource("lib/partner/webhooks.ts");

    /*
     * 🔴 THE SIGNATURE OF `queueWebhook` IS THE ENFORCEMENT, so that is what is checked.
     *
     * A comment saying "no content" is the comment-vs-code family, which has now appeared five
     * times in this project. The argument list is the thing that cannot lie.
     */
    const queueSig = webhooks.match(/export async function queueWebhook\(input: \{[^}]*\}/s)?.[0] ?? "";

    check(
      "🔴 55.10 / 42.4 queueWebhook takes an event and an id: no payload, data, body or metadata",
      queueSig !== "" && !/payload|data|body|metadata|content|note|transcript/i.test(queueSig),
      queueSig === "" ? "queueWebhook not found" : "three arguments, none of them content",
    );

    check(
      "🔴 CONTROL …and it DOES take an event and a subject id, so the absence is not an empty list",
      /event:\s*WebhookEvent/.test(queueSig) && /subjectId/.test(queueSig),
      "otherwise a function with no arguments passes every absence check ever written",
    );

    const deliveryCols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'partner_webhook_deliveries'`);

    const deliveryNames = deliveryCols.rows.map((r) => String(r.column_name));

    check(
      "🔴 55.10 / 42.4 the delivery ROW has nowhere to put content either",
      !deliveryNames.some((n) => /payload|content|body|note|transcript|data/.test(n)),
      deliveryNames.join(", "),
    );

    check(
      "🔴 CONTROL …and it does carry the event and the subject, so the table is not empty of columns",
      deliveryNames.includes("event") && deliveryNames.includes("subject_id"),
      "an absence assertion against a table with two columns is not an assertion",
    );

    /*
     * 🔴 THE BODY, EXERCISED. `deliverPending` builds a literal; this asserts the literal has
     * exactly three keys, by reading the object it constructs.
     */
    const bodyLiteral =
      webhooks.match(/JSON\.stringify\(\{[\s\S]*?\}\)/)?.[0]?.replace(/\s+/g, "") ?? "";

    check(
      "🔴 55.10 / 42.4 the delivery body is a literal with exactly three fields in it",
      /^JSON\.stringify\(\{event:[^,]+,id:[^,]+,at:[^,]+,?\}\)$/.test(bodyLiteral),
      bodyLiteral || "no literal found",
    );

    const httpsCheck = await db.execute(sql`
      SELECT pg_get_constraintdef(oid) AS def, convalidated
        FROM pg_constraint WHERE conname = 'partner_webhooks_https'`);

    check(
      "🔴 55.10 an http:// endpoint is refused by a database CHECK, not only by a form",
      String(httpsCheck.rows[0]?.def ?? "").includes("https://") &&
        httpsCheck.rows[0]?.convalidated === true,
      String(httpsCheck.rows[0]?.def ?? "") || "constraint not found",
    );

    check(
      "🔴 55.10 the secret is SEALED rather than hashed, because signing needs it back",
      /encryptSecret/.test(webhooks) && /decryptSecret/.test(webhooks),
      "and the signature covers the timestamp AND the body, so a capture is not replayable",
    );

    check(
      "🔴 55.10 signed over `${timestamp}.${body}`, so a captured delivery cannot be re-timed",
      /update\(`\$\{timestamp\}\.\$\{body\}`\)/.test(webhooks),
      "the construction Stripe uses, for the same reason",
    );

    /* ================================================================== */
    /*  55.7 · a session lands in the record. A note does NOT.            */
    /* ================================================================== */

    const writebackSource = readSource("lib/partner/writeback.ts");
    const writeback = functionSource(writebackSource, "recordExternalSession");

    /*
     * 🔴 THE PRICE IS ASSERTED POSITIVELY, because the negative form did not mean what it read.
     *
     * `/priceCents:\s*[^0]/` looks like "a price that is not zero", and it matched `priceCents:
     * 0` — `\s*` backtracks to zero characters and `[^0]` then matches the SPACE. So the check
     * failed against correct code, and the only way to make it green would have been to remove
     * the line that sets the price to zero.
     *
     * A regex asserting the absence of a value is a regex about characters. `priceCents: 0` is
     * one string and either present or not.
     */
    check(
      "🔴 55.7 recordExternalSession writes no note and no transcript, and the price is zero",
      !/sessionNotes|transcriptSegments|recordingConsent:\s*true/.test(writeback) &&
        /priceCents: 0,/.test(writeback) &&
        /paymentStatus: "not_required"/.test(writeback),
      "it was paid for on their platform, so inventing a charge would put money in our books",
    );

    check(
      "🔴 CONTROL …and it DOES write the session and its source, so it is not a no-op",
      /insert\(sessions\)/.test(writeback) && /insert\(sessionSources\)/.test(writeback),
      "through the door 36 built",
    );

    const externalProvisioned = await db.execute(sql`
      SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conname = 'session_sources_external_is_provisioned'`);

    check(
      "🔴 55.7 / 0076 partner_platform is in the CHECK's list, not only in the TypeScript enum",
      String(externalProvisioned.rows[0]?.def ?? "").includes("partner_platform"),
      "the half a careless enum extension would have missed",
    );

    /* ================================================================== */
    /*  55.8 · a note is delivered only once a clinician approved it       */
    /* ================================================================== */

    const deliverable = functionSource(api, "deliverableNote");

    check(
      "🔴 55.8 deliverableNote requires approval IN THE WHERE, never in a branch after the read",
      deliverable !== "" &&
        /approvedAt/.test(deliverable) &&
        /isNotNull|eq\(sessionNotes\.status/.test(deliverable),
      deliverable === "" ? "deliverableNote not found" : "three conditions, all in the query",
    );

    check(
      "🔴 CONTROL …and the subject scope is in the same WHERE, so a borrowed id delivers nothing",
      /partnerSubjects|partnerId/.test(deliverable),
      "approval alone would deliver any approved note to any partner",
    );

    /* ================================================================== */
    /*  42.3 / 55.9 · the launch, and the cookie on the right response     */
    /* ================================================================== */

    const launch = readSource("lib/partner/launch.ts");

    /*
     * 🔴 THE DEFECT THIS CHECK EXISTS FOR IS ONE I SHIPPED AND THEN FOUND.
     *
     * `launchClinician` runs inside a request FROM THE PARTNER'S SERVER, so a `cookies().set()`
     * there attaches Set-Cookie to the partner's response: the partner holds the session and
     * the clinician gets none. Nothing errors. So the check is that the minting function does
     * not touch cookies, with a control that the REDEMPTION function does.
     */
    const mint = functionSource(launch, "launchClinician");
    const redeem = functionSource(launch, "redeemLaunch");

    check(
      "🔴 55.9 launchClinician sets NO cookie: its response goes to the partner's server",
      mint !== "" && !/cookies\(\)/.test(mint),
      mint === "" ? "launchClinician not found" : "it mints a token and returns a URL",
    );

    /*
     * 🔴 THE WORST DEFECT IN THIS SPRINT, AND IT WAS MINE.
     *
     * `launchClinician` looked up the email, confirmed the clinician was verified, and minted.
     * Any key holding `record:read` could therefore name ANY verified clinician in the product
     * and get a working session as them, on their own caseload, with their notes and
     * transcripts in it. A partner in front of that browser reaches every clinical word that
     * clinician can. Nothing about the response or the audit would have looked wrong.
     *
     * The association was already in the schema: 42.6's `organizations.partner_id` with
     * `billing_mode = 'partner_billed'`, set by an operator. So the check is that BOTH
     * conditions are in the query, at BOTH ends: minting and redemption.
     */
    for (const [end, source] of [
      ["launchClinician", mint],
      ["redeemLaunch", redeem],
    ] as const) {
      check(
        `🔴 55.9 ${end} launches only a clinician on THIS partner's account, in the WHERE`,
        /organizations\.partnerId/.test(source) && /billingMode, "partner_billed"/.test(source),
        "otherwise one key signs in as any verified clinician in the product",
      );
    }

    check(
      "🔴 55.9 and the refusal is the same 404 either way, so it is not a therapist directory",
      /No such clinician/.test(mint) && !/not yours|not your partner/i.test(mint),
      "'exists but is not yours' is a directory answered one email at a time",
    );

    check(
      "🔴 CONTROL …and redeemLaunch DOES, because that response reaches the clinician's browser",
      redeem !== "" && /cookies\(\)/.test(redeem) && /SESSION_COOKIE/.test(redeem),
      "the same cookie as an ordinary sign-in: there stays exactly one way to be signed in",
    );

    check(
      "🔴 55.9 the token is claimed by a CONDITIONAL UPDATE, so two browsers get one session",
      /isNull\(partnerLaunchTokens\.usedAt\)/.test(redeem) &&
        /gt\(partnerLaunchTokens\.expiresAt/.test(redeem),
      "a read-then-write would produce two sessions and no error",
    );

    /*
     * 🔴 C285 MOVED WHAT THIS HAS TO ASSERT, AND THE OLD SPELLING WAS THE WEAKER CHECK.
     *
     * This read `/verificationStatus !== "verified"/` — the literal text of one comparison. C285
     * rewrote the redemption path to ask `therapist_verifications` through `verifiedFlag()`, the
     * single shared definition, and the check went red while the behaviour got stricter.
     *
     * A check pinned to a spelling is a check that fails when the code improves and passes when
     * somebody copies the spelling into a function that does nothing. So it asserts the SOURCE the
     * comparison consults instead: `verifiedFlag` is the one expression in the codebase that means
     * "a human approved this clinician", and a redemption that calls it cannot be reading a cache.
     */
    check(
      "🔴 55.9 verification is re-checked AT REDEMPTION, against the table the database enforces",
      /verifiedFlag\(\)/.test(redeem) && /!clinician\.verified/.test(redeem),
      "two minutes is short but not zero, and suspension is the thing that must not be stale",
    );

    check(
      "🔴 55.9 the launch token's life is the gap between a call and a navigation",
      LAUNCH_TOKEN_TTL_SECONDS > 0 && LAUNCH_TOKEN_TTL_SECONDS <= 300,
      `${LAUNCH_TOKEN_TTL_SECONDS} seconds`,
    );

    /*
     * 🔴 THE CLAIM, EXERCISED against a planted token. Two UPDATEs, one row.
     */
    const [clinician] = (
      await db.execute(sql`
      SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1`)
    ).rows as { id: string }[];

    const clinicianId = required(clinician, "users row").id;
    const launchHash = randomBytes(16).toString("hex");

    await db.execute(sql`
      INSERT INTO partner_launch_tokens (partner_id, user_id, token_hash, target, expires_at)
      VALUES (${partnerId}, ${clinicianId}, ${launchHash}, '/dashboard', now() + interval '2 minutes')`);

    const claimLaunch = () =>
      db.execute(sql`
        UPDATE partner_launch_tokens SET used_at = now()
         WHERE token_hash = ${launchHash} AND used_at IS NULL AND expires_at > now()
        RETURNING id`);

    const l1 = await claimLaunch();
    const l2 = await claimLaunch();

    check(
      "🔴 55.9 asserted by the write: one launch URL opens one session, and the second is refused",
      l1.rows.length === 1 && l2.rows.length === 0,
      `first claim ${l1.rows.length} row, second ${l2.rows.length}`,
    );

    /* 🔴 42.5 — and none of the targets is a room. */
    const { PARTNER_LAUNCH_TARGETS } = await import("../lib/partner/launch");

    check(
      "🔴 42.5 / 55.9 no launch target is a video room, and there are targets to check",
      PARTNER_LAUNCH_TARGETS.length > 0 &&
        !PARTNER_LAUNCH_TARGETS.some((t) => /room|call|video|session\//.test(t)),
      PARTNER_LAUNCH_TARGETS.join(", "),
    );

    /*
     * 🔴 The target is stored ALREADY RESOLVED, so the row never holds a caller's string.
     * Checked by planting one and reading it back: the allow list is four known paths.
     */
    const stored = await db.execute(sql`
      SELECT DISTINCT target FROM partner_launch_tokens WHERE partner_id = ${partnerId}`);

    check(
      "🔴 CONTROL …and what is STORED is one of those paths, resolved before the insert",
      stored.rows.every((r) => PARTNER_LAUNCH_TARGETS.some((t) => String(r.target) === `/${t}`)),
      stored.rows.map((r) => String(r.target)).join(", "),
    );

    /* ================================================================== */
    /*  55.3 · a therapist never sees an API key                           */
    /* ================================================================== */

    /*
     * 🔴 Asserted as a REACHABILITY question rather than a permission one.
     *
     * Every screen that renders a key is under `app/(partner)/`, and every action that mints
     * one calls `requirePartnerAdmin`. So: no file outside the partner tree imports
     * `mintKey`, and nothing in `(app)` or `(clinic)` imports from `lib/partner/keys`.
     */
    const keyImporters = files.filter(
      (f) => /from "@\/lib\/partner\/keys"/.test(readSource(f)) && !f.startsWith("scripts/"),
    );

    const clinicianSideImporters = keyImporters.filter(
      (f) =>
        f.startsWith("app/(app)/") || f.startsWith("app/(clinic)/") || f.startsWith("app/(patient)/"),
    );

    check(
      "🔴 55.3 no clinician, clinic or patient surface imports lib/partner/keys at all",
      clinicianSideImporters.length === 0,
      clinicianSideImporters.length === 0
        ? `${keyImporters.length} importer(s), all on the partner side or in the API`
        : clinicianSideImporters.join(", "),
    );

    check(
      "🔴 CONTROL …and the partner portal DOES import it, so the absence is not a missing module",
      keyImporters.some((f) => f.startsWith("app/(partner)/")),
      keyImporters.filter((f) => f.startsWith("app/(partner)/")).join(", "),
    );

    const keyActions = readSource("app/(partner)/partner/actions.ts");

    check(
      "🔴 55.3 minting requires a partner ADMIN, and the partner id comes from the actor",
      /requirePartnerAdmin/.test(keyActions) && /actor\.partnerId/.test(keyActions),
      "a partnerId in the form would mint against somebody else's account",
    );

    check(
      "🔴 55.3 and there is no partnerId field the form could supply",
      !/formData\.get\("partnerId"\)/.test(keyActions),
      "the tenancy comes from the session, as it does for every scoped write here",
    );

    /*
     * 🔴 THE ADMIN CONSOLE DOES NOT MINT EITHER, and that is the one an operator would add.
     *
     * A key minted by us is a key whose scope nobody on their side chose, and reading a raw
     * key down a phone line defeats the reason `mintKey` returns it exactly once.
     */
    const adminPartners = readSource("app/(admin)/admin/partners/actions.ts");

    check(
      "🔴 55.3 / C265 the ADMIN console creates a portal user and never a key",
      !/mintKey/.test(adminPartners) && /createPartnerUser/.test(adminPartners),
      "they mint their own, in their own portal, where the scope is chosen by the builder",
    );

    /* ================================================================== */
    /*  42.1 · held until an operator activates, everywhere it matters     */
    /* ================================================================== */

    check(
      "🔴 42.1 a partner has four states and starts HELD",
      PARTNER_STATES[0] === "held" && PARTNER_STATES.includes("suspended"),
      PARTNER_STATES.join(", "),
    );

    const partnerAdmin = readSource("lib/data/partner-admin.ts");

    check(
      "🔴 42.1 the enquiry creates a held partner and NO user, password or key",
      /state:\s*"held"/.test(partnerAdmin) &&
        !/applyToPartner[\s\S]{0,1200}(mintKey|passwordHash)/.test(partnerAdmin),
      "a self-serve path to an active partner is a self-serve path to an identity oracle",
    );

    check(
      "🔴 42.1 a held or suspended partner has no portal, in the WHERE clause",
      /eq\(partners\.state, "active"/.test(partnerSession),
      "so suspending closes the portal with no second mechanism to keep in step",
    );

    check(
      "🔴 CONTROL …and a suspended partner's KEYS stop too, read from the same column",
      /partners\.state/.test(readSource("lib/partner/keys.ts")),
      "a portal closed and keys still live would be the worse half still open",
    );

    /* ================================================================== */
    /*  55.12 · the public page names the use cases, with a real example   */
    /* ================================================================== */

    const devPage = readSource("app/(public)/developers/page.tsx");

    check(
      "🔴 55.12 the page no longer says there is no public API",
      !/no public API/i.test(devPage),
      "it said that correctly until this sprint, and saying it now would be false",
    );

    /*
     * 🔴 EVERY PATH THE PAGE PRINTS RESOLVES TO A ROUTE FILE ON DISK.
     *
     * C149's failure was a docs page documenting routes that were not a contract. The
     * inverse failure is a docs page naming a route nobody wrote, and it is the one this page
     * is now exposed to: five use cases, five examples, every one a path in a string.
     */
    const printedPaths = [...devPage.matchAll(/\/api\/partner\/v1\/[a-z/<>[\]A-Za-z-]+/g)].map(
      (m) => m[0],
    );

    /*
     * 🔴 A DYNAMIC SEGMENT IS MATCHED BY SHAPE, and my first version only tried dropping the
     * LAST segment. `/subjects/YOUR-REF/readers` has its dynamic segment in the MIDDLE, so the
     * check reported the one path whose route file genuinely exists as unresolved.
     *
     * So: a segment that is not lower-case-with-dashes is treated as a parameter and matched
     * against any `[…]` folder at that position. That is the real rule Next uses, rather than
     * an assumption about where a parameter sits.
     */
    const routeDirs = files
      .filter((f) => f.startsWith("app/api/") && f.endsWith("/route.ts"))
      .map((f) => f.slice("app/".length, -"/route.ts".length).split("/"));

    const unresolved = printedPaths.filter((path) => {
      const printed = path.replace(/^\//, "").split("/");
      return !routeDirs.some(
        (dir) =>
          dir.length === printed.length &&
          dir.every((segment, i) => {
            const want = printed[i]!;
            /* A `[param]` folder matches anything; a literal folder must match exactly. */
            if (segment.startsWith("[")) return true;
            return segment === want;
          }),
      );
    });

    /*
     * 🔴 THE FLOOR MOVED WITH THE SCOPE CUT, and the reason it is a floor at all
     * is worth keeping: an empty page resolves every path it prints.
     *
     * It was five, matching five use cases. Two of those endpoints were deleted
     * on 2026-09-14 and this check is what found the docs still advertising
     * both, with request bodies and example responses, on the page somebody
     * reads while deciding whether to integrate. It is now tied to the number
     * of scopes rather than to a number somebody has to remember to change.
     */
    check(
      "🔴 55.12 every API path printed on /developers resolves to a route file on disk",
      printedPaths.length >= API_SCOPES.length && unresolved.length === 0,
      unresolved.length === 0
        ? `${printedPaths.length} paths, all real, ${API_SCOPES.length} scopes`
        : `unresolved: ${unresolved.join(", ")}`,
    );

    /*
     * 🔴 EVERY USE CASE THE DICTIONARY HAS IS ON THE PAGE, AND BOTH DIRECTIONS.
     *
     * The old version listed five keys by name, so removing two endpoints left
     * it asserting strings that described deleted routes. Reading the dictionary
     * instead means the check cannot go stale, and it now catches the opposite
     * mistake too: a use case written in the dictionary and never rendered is a
     * product we describe to nobody, which is how `devs.useCase1` and
     * `devs.useCase2` would otherwise have sat there describing endpoints that
     * no longer exist.
     */
    const useCaseKeys = Object.keys(DICTIONARIES.en).filter((key) =>
      /^devs\.useCase\d+$/.test(key),
    );

    check(
      "🔴 55.12 every use case in the dictionary is named on the page, and the widget with it",
      useCaseKeys.length > 0 &&
        useCaseKeys.every((key) => devPage.includes(key)) &&
        devPage.includes("devs.widget"),
      `${useCaseKeys.length} use cases, all rendered`,
    );

    /*
     * 🔴 68.24 — EVERY ENDPOINT THAT EXISTS IS DOCUMENTED, which is the inverse of
     * the check above and the stronger of the two.
     *
     * The old assertion was `useCaseKeys.length === API_SCOPES.length`, one use-case
     * card per scope. Sprint 68 documents its seven new endpoints as a numbered FLOW
     * rather than as seven more cards, because the order is the product and a card
     * per endpoint says they are independent. The count equality would have failed
     * against correct, complete documentation, which is a gate measuring the shape of
     * a page rather than whether it is true.
     *
     * So the rule is stated directly against the thing it cares about: every route
     * file under `app/api/partner/v1` has its path printed on the public page. A
     * route nobody documents is a product nobody can find, and a route documented
     * that does not exist is caught by the resolution check above. Both directions,
     * neither depending on how the page is laid out.
     */
    const v1Routes = files
      .filter((f) => f.startsWith("app/api/partner/v1/") && f.endsWith("/route.ts"))
      .map((f) => `/${f.slice("app/".length, -"/route.ts".length)}`);

    const undocumented = v1Routes.filter((route) => {
      const wanted = route.split("/");
      return !printedPaths.some((printed) => {
        const parts = printed.replace(/^\//, "").split("/");
        if (parts.length !== wanted.length - 1) return false;
        return wanted.slice(1).every((segment, i) => {
          /* A `[param]` folder is documented by any placeholder at that position. */
          if (segment.startsWith("[")) return true;
          return segment === parts[i];
        });
      });
    });

    check(
      "🔴 68.24 every endpoint that EXISTS is printed on the public page",
      undocumented.length === 0,
      undocumented.join(", ") || `${v1Routes.length} routes, all documented`,
    );

    check(
      "🔴 55.12 …and no use case string outlives the endpoint it describes",
      useCaseKeys.every((key) => devPage.includes(key)),
      `${useCaseKeys.length} use cases, every one rendered`,
    );

    check(
      "🔴 55.12 and it names what there is NO endpoint for, on the same page as the five",
      devPage.includes("devs.limits"),
      "the first question after reading five use cases is 'can I also get a list'",
    );

    /* ================================================================== */
    /*  55.11 · the importer carries a caseload and no clinical text        */
    /* ================================================================== */

    const importer = readSource("lib/data/patient-import.ts");

    check(
      "🔴 55.11 the importer reads four columns and no clinical one",
      /export const AN_IMPORT_CARRIES_NO_CLINICAL_TEXT = true/.test(importer) &&
        !/notes?\s*:\s*\[/.test(importer) &&
        !/diagnos|risk|history/i.test(importer.replace(/COLUMNS[\s\S]*?\} as const;/, "")),
      "a note that arrived in a spreadsheet has nobody here who approved it",
    );

    const columnsBlock = importer.match(/const COLUMNS = \{[\s\S]*?\} as const;/)?.[0] ?? "";

    check(
      "🔴 CONTROL …and the four it DOES read are the four, so the absence is not an empty map",
      ["firstName", "lastName", "email", "phone"].every((f) => columnsBlock.includes(f)) &&
        !/note|diagnos|risk|history|summary/i.test(columnsBlock),
      "a name, a surname, an address and a number",
    );

    check(
      "🔴 55.11 / C64 numbers go through toE164 with a COUNTRY, not through a local guess",
      /toE164\(/.test(importer) && /parseImport\(csv: string, country: string\)/.test(importer),
      "01001234567 is a valid mobile in Egypt, Italy and Kenya, and a different person in each",
    );

    check(
      "🔴 55.11 / C262 the write goes through createPatient, so 5.1's person and the audit hold",
      /createPatient\(actor/.test(importer) && !/insert\(patients\)/.test(importer),
      "a bulk insert would be faster and would skip the person row and every audit entry",
    );

    check(
      "🔴 55.11 the duplicate check uses the CASELOAD scope, from lib/data/patients.ts",
      /patientPhonesOnCaseload/.test(importer) &&
        /scope\(actor\)/.test(readSource("lib/data/patients.ts")),
      "an organisation-wide check would silently skip a colleague's patient with no error",
    );

    /* ================================================================== */
    /*  55.13 · every new string in both languages                         */
    /* ================================================================== */

    const messages = readSource("lib/i18n/messages.ts");
    const [englishHalf, arabicHalf] = messages.split(/export const ar\b/);

    const newPrefixes = ["dev.", "devs.", "apartner.", "import."];
    const missing: string[] = [];

    for (const prefix of newPrefixes) {
      const keys = [...(englishHalf ?? "").matchAll(new RegExp(`"(${prefix}[A-Za-z0-9.]+)":`, "g"))].map(
        (m) => m[1]!,
      );
      for (const key of keys) {
        if (!(arabicHalf ?? "").includes(`"${key}":`)) missing.push(key);
      }
    }

    check(
      "🔴 55.13 every new string has an Arabic translation",
      missing.length === 0,
      missing.length === 0 ? "dev, devs, apartner and import, both languages" : missing.join(", "),
    );

    /*
     * 🔴 AND NO EM DASH, in the strings this sprint added.
     *
     * `verify:sprint24` sweeps the whole product; this is the same rule asserted where the new
     * copy is, so a failure here names the sprint that introduced it.
     */
    const newStrings = [
      ...(messages.matchAll(/"(?:dev|devs|apartner|import)\.[A-Za-z0-9.]+":\s*"([^"]*)"/g)),
    ].map((m) => m[1]!);

    /*
     * 🔴 THE DASHES ARE BUILT FROM CODE POINTS, NEVER WRITTEN AS CHARACTERS.
     *
     * `verify:sprint24` sweeps every source file in the product for a literal em or en dash, and
     * it found the first draft of this block twice: once in the detector's own character class
     * and once in the planted control. Both were real dashes in a real file, so the global gate
     * was right and my file was the offender.
     *
     * The fix is not an exemption. A dash-detector that spells its dashes as `—` is the
     * same detector, and a control that assembles one is the same control, and neither puts a
     * character in the repository that the product's own rule forbids.
     */
    const EM = String.fromCharCode(0x2014);
    const DASHES = new RegExp("[\\u2014\\u2013]");

    const dashed = newStrings.filter((s) => DASHES.test(s));

    check(
      "🔴 NO EM DASH in any string this sprint added",
      dashed.length === 0,
      dashed.length === 0 ? `${newStrings.length} strings swept` : dashed.slice(0, 2).join(" | "),
    );

    /*
     * 🔴 AND A PLANTED OFFENDER, because a sweep that finds nothing may be sweeping nothing.
     */
    check(
      "🔴 CONTROL …and the sweep finds a planted em dash, so it is really looking",
      [`a planted ${EM} offender`].filter((s) => DASHES.test(s)).length === 1,
      "an absence check with no positive control is a check that passes when broken",
    );

    /* ================================================================== */
    /*  55.2 · the portal, and the sentences that must be on it            */
    /* ================================================================== */

    for (const [label, file, key] of [
      /*
       * 🔴 REMOVED WITH ITS SCOPE, 2026-09-14, and this is the reasoning rather
       * than a deletion.
       *
       * The sentence is C265's: an employment key names the one organisation it
       * may ask about. It was asserted on the PARTNER key form because that is
       * where an employment key used to be minted. `employment:verify` is no
       * longer a partner scope, so requiring the partner form to carry a warning
       * about a capability it does not have is a check measuring the wrong
       * screen, and would be satisfied by pasting a sentence nobody needs.
       *
       * The requirement did not go away. It goes to the sponsor's own
       * integrations page in sprint 66, where it is stronger: the organisation
       * is not a field at all, it is the portal the person is signed into. The
       * check above already asserts C265's machinery survived the move.
       */
      ["42.4's sentence is in the portal CHROME, on every screen", "components/partner/chrome.tsx", "dev.noContent"],
      ["C265's refusal is on the ADMIN console too", "components/admin/partner-manager.tsx", "apartner.neverMints"],
      ["55.11's promise about notes is above the file picker", "components/patients/import-patients.tsx", "import.notesNever"],
    ] as const) {
      check(`🔴 55.2 ${label}`, readSource(file).includes(key), key);
    }

    const chrome = readSource("components/partner/chrome.tsx");

    check(
      "🔴 55.2 the portal has no subjects tab, and never will: that is the roster rebuilt",
      !/subjects|people|patients/i.test(chrome.match(/const TABS[\s\S]*?\];/)?.[0] ?? ""),
      "keys, endpoints, deliveries, docs",
    );

    check(
      "🔴 55.2 usePathname has a fallback, so the chrome renders outside a router",
      /usePathname\(\) \?\? "\/partner"/.test(chrome),
      "the defect sprint 54 found by rendering the clinic's chrome rather than reading it",
    );

    /* ================================================================== */
    /*  The scopes, and that each one maps to exactly one use case          */
    /* ================================================================== */

    const routeFiles = files.filter(
      (f) => f.startsWith("app/api/partner/v1/") && f.endsWith("route.ts"),
    );

    /*
     * 🔴 NARROWED TO TELEHEALTH, 2026-09-14, so the count moved with it.
     *
     * `employment:verify` went to the sponsor portal, where the organisation an
     * identity question is about is the portal somebody is signed into rather
     * than a field on a form. `clinician:verify` went nowhere: a telehealth
     * platform takes responsibility for its own clinicians' licences, and EHR
     * and FHIR are a clinic setting reached through `lib/ehr/`.
     *
     * 🔴 The assertion is EXACT on both sides rather than a floor, because the
     * failure this is guarding against is a scope advertised ahead of the
     * endpoint that serves it. `WEBHOOK_EVENTS` did exactly that for four
     * sprints under a green check. A scope arrives with its route.
     */
    /*
     * 🔴 WIDENED BY SPRINT 68, 2026-09-14, and the assertion stays EXACT.
     *
     * Seven scopes arrived with seven routes: consent, media, transcript, note,
     * summary, copilot and memory. The numbers are written out rather than made a
     * floor for the reason this check exists at all: the failure it guards against
     * is a scope advertised ahead of the endpoint that serves it, and a floor would
     * pass the moment somebody added a scope and forgot the route.
     *
     * `verify:sprint68` asserts the PAIRING rather than the counts, which is the
     * stronger half; this one catches the drift a pairing check cannot, which is a
     * route added with no scope behind it.
     *
     * 🔴 W2-X02, 2026-09-24: TWELVE routes. `sessions/[ref]/end` holds
     * `session:media`, the scope of the key that sent the audio, because a scope
     * of its own could not be used without that one. It still has a scope behind
     * it, which is what this count guards; the count stays exact so the next
     * route has to be argued here too.
     */
    check(
      "🔴 55.6-55.8 / 68.24 one scope per use case, and a route for each",
      API_SCOPES.length === 10 && routeFiles.length === 12,
      `${API_SCOPES.length} scopes, ${routeFiles.length} routes`,
    );

    check(
      "🔴 55.4 the two scopes that belonged to other portals are GONE from the partner list",
      !(API_SCOPES as readonly string[]).includes("employment:verify") &&
        !(API_SCOPES as readonly string[]).includes("clinician:verify"),
      "an HR connection belongs to the company, and a licence to the platform that hired them",
    );

    check(
      "🔴 55.4 …and their routes are gone too, not merely unadvertised",
      !files.some((f) => /app\/api\/partner\/v1\/(employment|clinicians)\//.test(f)),
      "a scope removed from a list while its route still answers is a rename",
    );

    /*
     * 🔴 CONTROL. C265's machinery must SURVIVE the move, because it is what
     * made the employment question safe and the sponsor's own version inherits
     * all of it: an attestation is written only when somebody typed an
     * identifier into their own benefit screen, it expires in minutes, and it
     * is consumed by the one question it licences.
     */
    check(
      "🔴 CONTROL C265's attestation machinery survived the move intact",
      /enrolmentAttestations/.test(readSource("lib/data/enrolment.ts")) &&
        /ATTESTATION_TTL_MINUTES/.test(readSource("lib/db/schema.ts")) &&
        files.includes("lib/partner/employment.ts"),
      "the endpoint moved portals; the thing that stopped it being an oracle did not move",
    );

    /*
     * 🔴 EVERY ROUTE GOES THROUGH `withKey`, which does the IP limit, the key, the per-key
     * limit and the scope in one place. A handler that authenticated itself is a handler that
     * can turn a 403 into a 200.
     */
    const unguarded = routeFiles.filter((f) => !/withKey\(/.test(readSource(f)));

    check(
      "🔴 55.2 every v1 route authenticates through withKey, none of them by hand",
      unguarded.length === 0,
      unguarded.length === 0 ? `${routeFiles.length} routes, one door` : unguarded.join(", "),
    );

    check(
      "🔴 CONTROL …and withKey returns a response OR a key, so a handler cannot ignore a 403",
      /"response" in|response\?:|\{ response/.test(readSource("lib/partner/route.ts")),
      "a boolean return is a return somebody forgets to check",
    );
  } finally {
    /*
     * Everything this run made, in dependency order.
     *
     * 🔴 ATTESTATIONS BEFORE KEYS, because 0078 made `answered_by_key_id` RESTRICT. This
     * teardown is what found the contradiction that migration fixes: with SET NULL the key
     * delete tried to null a column an answered row forbids, and failed with a check violation
     * naming a table nobody was touching.
     */
    await db.execute(sql`DELETE FROM enrolment_attestations WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name LIKE 'verify55-%')`);
    await db.execute(sql`DELETE FROM partner_launch_tokens WHERE partner_id IN
      (SELECT id FROM partners WHERE name LIKE 'verify55-%')`);
    await db.execute(sql`DELETE FROM partner_api_keys WHERE partner_id IN
      (SELECT id FROM partners WHERE name LIKE 'verify55-%')`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE name LIKE 'verify55-%')`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name LIKE 'verify55-%')`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name LIKE 'verify55-%')`);
    await db.execute(sql`DELETE FROM sponsors WHERE name LIKE 'verify55-%'`);
    await db.execute(sql`DELETE FROM partners WHERE name LIKE 'verify55-%'`);
  }

  /* ------------------------------------------------------------ 76.78 -- */

  /*
   * 🔴 76.78 — THE PUBLISHED METHODS TABLE MATCHES THE ROUTES THAT EXIST.
   *
   * `/integrations` now prints a table of calls an integrator makes. A
   * documentation page that names an endpoint the product does not serve is the
   * worst kind of marketing error: it is found by somebody who has already
   * started building against it. And the failure is silent in both directions —
   * a route renamed in a refactor leaves the page confidently wrong.
   *
   * So the table is read out of the page's own source and each row is checked
   * against `app/api/partner/` on disk: the file has to exist and it has to
   * export a handler for that verb.
   */
  const docsSource = readSource("app/(public)/integrations/page.tsx");
  const documented = [
    ...docsSource.matchAll(/\{ method: "(\w+)", path: "\/api\/partner\/([^"]+)"/g),
  ].map((m) => ({ method: m[1]!, path: m[2]! }));

  const brokenRows = documented.filter(({ method, path }) => {
    /* `<ref>` in the docs is `[ref]` on disk, which is the only rewriting here. */
    const file = join(
      "app/api/partner",
      path.replace(/<(\w+)>/g, "[$1]"),
      "route.ts",
    );
    let source = "";
    try {
      source = readSource(file);
    } catch {
      return true;
    }
    return !new RegExp(`export async function ${method}\\b`).test(source);
  });

  check(
    "🔴 76.78 every method the integrations page documents is a route that exists and serves that verb",
    documented.length > 0 && brokenRows.length === 0,
    brokenRows.length > 0
      ? `documented but not served: ${brokenRows.map((r) => `${r.method} ${r.path}`).join(", ")}`
      : `${String(documented.length)} documented calls, all served`,
  );

  /*
   * 🔴 THE CONTROL. The check above passes trivially against a regex that
   * matched nothing, which is the §6 family: an absence assertion measuring the
   * wrong thing. A row the page really carries is asserted present.
   */
  check(
    "🔴 76.78 CONTROL, the table was really read rather than matching nothing",
    documented.length >= 6 &&
      documented.some((r) => r.method === "POST" && r.path === "v1/consent") &&
      documented.some((r) => r.method === "GET" && r.path.endsWith("/note")),
    documented.map((r) => `${r.method} ${r.path}`).join(", ") || "THE SCAN IS BLIND",
  );

  finish("sprint 55");
}

void main();
