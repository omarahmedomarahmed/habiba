/**
 * Sprint 41 acceptance: meeting bots.
 *
 *   npm run verify:sprint41
 *
 * ## The one rule the whole sprint is arranged around
 *
 * > 🔴 **The bot joins meetings 24Therapy created for a session. Nothing else.
 * > Ever.** No calendar is read (C132).
 *
 * Everything here is an attempt to make that a property of the system rather
 * than a promise in a service. The two halves:
 *
 *   - `session_sources_bot_only_if_ours` refuses a `bot_id` on any row without
 *     `provisioned_at` and `provisioned_by_user_id`, which 0064 already
 *     requires for an external kind. So there is no path through any service,
 *     any future call site or any admin tool that puts a recorder into a
 *     meeting somebody pasted.
 *   - No provider scope this product requests can read a calendar, so an
 *     access token we hold could not do it even if a call site asked.
 *
 * ## 🔴 41.8 — there is no bot button, and the check is structural
 *
 * A button a therapist can forget is a session that silently went
 * untranscribed; a button they can press is a bot that can be sent somewhere
 * it should not go. So `sendBotForConsent` must have exactly ONE caller, and
 * that caller must be the consent path. Asserted by scanning every file.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

/** Every source file, so "exactly one caller" is a fact rather than a hope. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", ".claude", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { PROVIDERS, scopesAreMeetingOnly } = await import("../lib/meetings/providers");
  const { encryptSecret, decryptSecret, secretsConfigured } = await import(
    "../lib/crypto/secretbox"
  );

  /* ------------------------------------ 41.1 / C132 · the bot joins OUR meetings -- */

  /*
   * 🔴 Asserted against the DATABASE, by reading the constraint back.
   *
   * Reading the migration would pass against a database where somebody had
   * dropped it by hand, and reading the service would pass against a second
   * writer that skips it.
   */
  const constraints = await db.execute(sql`
    SELECT conname, pg_get_constraintdef(oid) AS def, convalidated
      FROM pg_constraint
     WHERE conname IN (
       'session_sources_bot_only_if_ours',
       'meeting_connections_revoked_is_empty',
       'meeting_connections_provider'
     )`);

  const byName = new Map(
    (constraints.rows as { conname: string; def: string; convalidated: boolean }[]).map((row) => [
      row.conname,
      row,
    ]),
  );

  const botRule = byName.get("session_sources_bot_only_if_ours");
  check(
    "🔴 41.1 / C132 a bot cannot exist on a source WE did not provision",
    Boolean(botRule?.convalidated) &&
      /provisioned_at IS NOT NULL/.test(botRule?.def ?? "") &&
      /provisioned_by_user_id IS NOT NULL/.test(botRule?.def ?? ""),
    botRule ? "session_sources_bot_only_if_ours, validated, in 0071" : "MISSING",
  );

  /*
   * 🔴 And the write, attempted.
   *
   * A bot id planted on a source with no provisioning must be refused by
   * Postgres, not by a service that happens to check first.
   */
  const [session] = (
    await db.execute(sql`SELECT id, organization_id FROM sessions LIMIT 1`)
  ).rows as { id: string; organization_id: string }[];
  const fixture = required(session, "a session to hang a source on");

  let refused = false;
  let control = false;
  await db.execute(sql`DELETE FROM session_sources WHERE session_id = ${fixture.id}`);
  try {
    await db.execute(sql`
      INSERT INTO session_sources (session_id, organization_id, kind, bot_id)
      VALUES (${fixture.id}, ${fixture.organization_id}, '24t_room', 'verify41-planted')`);
  } catch {
    refused = true;
  }

  check(
    "🔴 41.1 …and the DATABASE refuses a bot on an unprovisioned source",
    refused,
    "a recorder cannot be attached to a meeting nobody here created",
  );

  /*
   * 🔴 CONTROL — a properly provisioned source DOES take a bot.
   *
   * Without this the check above passes against a constraint that refuses
   * every bot, which would ship a product whose recorder never joins anything
   * and looks exactly like a working guard.
   */
  const [user] = (await db.execute(sql`SELECT id FROM users LIMIT 1`)).rows as { id: string }[];
  const operator = required(user, "a user to provision as");

  try {
    await db.execute(sql`
      INSERT INTO session_sources
        (session_id, organization_id, kind, external_meeting_id,
         provisioned_at, provisioned_by_user_id, bot_id)
      VALUES (${fixture.id}, ${fixture.organization_id}, 'zoom',
              'https://example.invalid/j/1', now(), ${operator.id}, 'verify41-ours')`);
    control = true;
  } catch {
    control = false;
  }

  check(
    "🔴 CONTROL a source WE provisioned does take a bot, so the guard is not refusing everything",
    control,
    control ? "provisioned, so the recorder is allowed" : "THE GUARD REFUSES EVERYTHING",
  );

  /*
   * 🔴 41.7 — "bot reconnects without duplicating".
   *
   * A network blip means our dispatch may have succeeded while its response
   * was lost, so a retry is the ordinary case. A second bot is not a duplicate
   * row to tidy up: it is a second recorder in a room where the patient agreed
   * to one.
   */
  /*
   * 🔴 AMENDED BY 57.8 / C284. This read a SECOND session with `OFFSET 1
   * LIMIT 1` and, on a database holding one session, silently did nothing:
   * `other` was undefined, the `if` never ran, `duplicateRefused` stayed false,
   * and the check reported a failure whose message named a constraint that was
   * present and working.
   *
   * Both halves are wrong in the same way. A verifier that needs two rows and
   * finds one must not report the constraint as broken, and a verifier whose
   * coverage depends on what happens to be in the database is C284's rule
   * exactly: it exercises every branch it claims to cover, in one run, whatever
   * the machine is configured with.
   *
   * So the second session is CREATED rather than looked for, and removed after.
   */
  let duplicateRefused = false;
  const [made] = (
    await db.execute(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, feedback_token)
      SELECT organization_id, therapist_id, 'scheduled', 'verify41-' || gen_random_uuid()
      FROM sessions WHERE id = ${fixture.id}
      RETURNING id, organization_id`)
  ).rows as { id: string; organization_id: string }[];
  const other = required(made, "a session it could clone to test the bot constraint");

  try {
    await db.execute(sql`
      INSERT INTO session_sources
        (session_id, organization_id, kind, external_meeting_id,
         provisioned_at, provisioned_by_user_id, bot_id)
      VALUES (${other.id}, ${other.organization_id}, 'zoom',
              'https://example.invalid/j/2', now(), ${operator.id}, 'verify41-ours')`);
  } catch {
    duplicateRefused = true;
  }
  await db.execute(sql`DELETE FROM session_sources WHERE session_id = ${other.id}`);
  await db.execute(sql`DELETE FROM sessions WHERE id = ${other.id}`);

  check(
    "🔴 41.7 the same bot cannot be attached twice, so a reconnect never duplicates",
    duplicateRefused,
    "session_sources_bot_unique, so a lost response is a retry rather than a second recorder",
  );

  await db.execute(sql`DELETE FROM session_sources WHERE session_id = ${fixture.id}`);

  /* ----------------------------------------------- C132 · no calendar, by scope -- */

  /*
   * 🔴 The strongest form of "no calendar is ever read": a token that was
   * never granted the permission.
   *
   * A rule in a service survives until the next call site forgets it. An
   * access token without a calendar scope cannot read a calendar however many
   * call sites ask.
   */
  const scoped = Object.values(PROVIDERS).filter((spec) => !scopesAreMeetingOnly(spec));
  check(
    "🔴 C132 no provider asks for a scope that could read a calendar",
    scoped.length === 0,
    scoped.length === 0
      ? `${Object.keys(PROVIDERS).length} providers, meeting creation only`
      : scoped.map((spec) => spec.provider).join(", "),
  );

  check(
    "🔴 CONTROL the scope guard catches a calendar scope planted in a provider",
    !scopesAreMeetingOnly({ ...PROVIDERS.zoom, scopes: ["calendar:read"] }) &&
      !scopesAreMeetingOnly({ ...PROVIDERS.zoom, scopes: ["recording:read:admin"] }),
    "a calendar or recording scope is refused, so widening this is not a quiet edit",
  );

  /* -------------------------------------------- 41.8 · there is no bot button -- */

  /*
   * 🔴 EXACTLY ONE CALLER, and it is the consent path (C216).
   *
   * > *A button a therapist can forget is a session that silently went
   * > untranscribed; a button they can press is a bot that can be sent
   * > somewhere it should not go.*
   *
   * Scanned across every source file rather than asserted of one, because the
   * failure this prevents is a SECOND dispatcher appearing somewhere nobody
   * thought to look: an admin tool, a retry endpoint, a "join now" button.
   */
  const files = walk(process.cwd()).map((f) => f.slice(process.cwd().length + 1));
  const callers = files.filter(
    (file) =>
      !file.startsWith("scripts/") &&
      file !== "lib/meetings/dispatch.ts" &&
      /sendBotForConsent/.test(readFileSync(file, "utf8")),
  );

  check(
    "🔴 41.8 / C216 the bot has exactly ONE dispatcher, and it is the consent path",
    callers.length === 1 && callers[0] === "app/join/[token]/actions.ts",
    callers.length === 1 ? callers[0]! : `${callers.length} callers: ${callers.join(", ")}`,
  );

  /*
   * 🔴 …and a DECLINE dispatches nothing at all.
   *
   * Not a bot that joins and stays quiet. That is the ethics, and it is also
   * the cost answer the "knock like Google Meet" design loses on: Recall bills
   * per bot-hour, so a bot on a declined session is money spent recording
   * nothing.
   */
  const joinActions = readSource("app/join/[token]/actions.ts");
  check(
    "🔴 41.8 a decline dispatches no bot at all, rather than one that joins and stays quiet",
    /if \(consent === "granted"\)[\s\S]{0,200}sendBotForConsent/.test(joinActions),
    "dispatch is inside the granted branch, and there is no other branch that calls it",
  );

  /*
   * 🔴 C282 — the AI question is on its OWN screen, not bundled onto the name
   * form.
   *
   * `submitJoin` used to read `guestName` and `consent` from one formData, so
   * the answer came with the momentum of filling in a name rather than as a
   * decision. That was the real pressure in this flow, it existed under either
   * ordering of payment and consent, and the ordering ruling would not have
   * touched it.
   *
   * Asserted both ways: the join action must not read a consent field, and it
   * must hand the patient to the standalone screen instead.
   */
  check(
    "🔴 C282 the AI question is never read off the name form",
    !/formData\.get\("consent"\)/.test(joinActions) &&
      /return \{ needsConsent: true \};/.test(joinActions),
    "one question, one screen, for every path into a session",
  );

  /*
   * 🔴 C281 — and the ORDER is unchanged, which is a different ruling.
   *
   * Pinned so nobody reads C282 as licence to move the question after
   * payment. A patient who agrees and then abandons Stripe has made a decision
   * we are obliged to honour, and the shipped order is what keeps it.
   */
  check(
    "🔴 C281 a paid session still pays before the AI question, not after",
    /payUrl: `\/pay\/\$\{token\}`/.test(joinActions),
    "name, pay, then the question, then in, and declining still admits them",
  );

  /* --------------------------------------- 41.7 · consent withdrawn, bot leaves -- */

  /*
   * 🔴 Pausing the transcript is enough when the audio is ours. It is NOT
   * enough in somebody else's meeting, where a recorder we dispatched is still
   * sitting in the call and the person who withdrew consent can see it in the
   * participant list. They are right to believe the list.
   */
  check(
    "🔴 41.7 withdrawing consent mid-session removes the recorder, not only the transcript",
    /stopRecording[\s\S]{0,1400}withdrawBot/.test(joinActions),
    "the pause refuses the audio, the withdrawal removes the recorder, in that order",
  );

  /*
   * 🔴 41.7 — couples: one consents and one does not means NO AI.
   *
   * Two people answer into one column. Without a monotonic write the second
   * answer overwrites the first, so a partner who declines is overruled by
   * whoever presses next and the recorder they objected to runs anyway.
   */
  /*
   * 🔴 C283 — and it is ONE CONDITIONAL STATEMENT, not a read then a write.
   *
   * Sprint 41 shipped this as a SELECT, a check and an UPDATE, and this check
   * matched on the `if`. Two people answering seconds apart was safe; two in
   * the same instant both read "not declined" and both wrote, so a grant could
   * still land after a decline. A rule this important does not rest on human
   * reaction time.
   *
   * Asserted on the SQL predicate rather than on the branch, because the
   * branch is what was wrong. `IS DISTINCT FROM` and not `<> 'declined'`:
   * the column is nullable and `NULL <> 'declined'` is NULL, which would
   * refuse the very first answer on every session.
   */
  check(
    "🔴 41.7 / C283 couples, any decline means no AI, in one atomic write with no read",
    /IS DISTINCT FROM 'declined'/.test(joinActions) &&
      !/const declined = await db\s*\n\s*\.select/.test(joinActions),
    "a conditional UPDATE, so there is no window between the check and the write",
  );

  /* ------------------------------------ 41.5 / C134 · identity from the session -- */

  /*
   * 🔴 A provider hands us "Sara's iPhone", "Dr Ahmed" or "Guest". None of
   * those is a person this product knows, and any of them can be typed by
   * anybody who joins. Attributing a line of a therapy transcript on the
   * strength of a string somebody chose in a settings screen is how a sentence
   * lands in the wrong person's chart.
   */
  const webhook = readSource("app/api/meetings/transcript/[sessionId]/route.ts");
  check(
    "🔴 41.5 / C134 the transcript route never reads a participant display name",
    !/participant[_.]?name|display[_.]?name|speaker_name|\.name\b/i.test(webhook),
    "identity comes from the session we created, never from the room",
  );

  /*
   * 🔴 41.7 — a bot in the wrong meeting is a HARD STOP.
   *
   * The only one of the eighteen that is not a degradation. No partial
   * acceptance, no "store it and flag it", no best-effort matching on a URL.
   */
  check(
    "🔴 41.7 a bot in the wrong meeting is a hard stop, audited, and removed",
    /assertOurBot/.test(webhook) && /status: 409/.test(webhook),
    "the audio is refused, the recorder is removed, and it is written to the audit log",
  );

  /*
   * 41.7 — recording without consent is refused processing.
   *
   * Checked at the webhook as well as at dispatch, because a consent withdrawn
   * after the bot joined leaves a recorder mid-call for as long as the
   * provider takes to remove it, and anything it sends in that window is not
   * ours to process.
   */
  check(
    "41.7 audio arriving without live consent is refused processing",
    /* Task 123: the rule now lives in one place, and both doors ask it. */
    /!mayRecord\(row\)/.test(webhook) &&
      /recordingConsent === "granted" && row\.recordingPausedAt === null/.test(
        readSource("lib/sessions/may-record.ts"),
      ),
    "refusing the audio is under our control; the provider's cooperation is not",
  );

  /*
   * 🔴 The route may say `processed: true` only when it writes the segments.
   * It said so while storing nothing; the control is the write itself, so the
   * day the segments are stored this check allows the word back.
   */
  const storesSegments = /transcriptSegments|appendSegment|insert\(/.test(webhook);
  check(
    "🔴 the transcript route does not answer processed: true while it stores nothing",
    storesSegments || !/processed: true/.test(webhook),
    storesSegments ? "it writes segments" : "it answers processed: false, not_stored",
  );

  /* -------------------------------------------- 41.3 · a therapist never sees a key -- */

  /*
   * 🔴 §7: *a therapist holding an API key is a therapist who got lost in our
   * product.*
   *
   * So the settings panel has no input of any kind. Connecting is an anchor to
   * an OAuth redirect; disconnecting is a button. The same assertion 51.6 made
   * of the source panel, for the same reason: "we would never add a key field"
   * is a promise and a scan is a fact.
   */
  const panel = readSource("components/settings/meeting-accounts.tsx");
  check(
    "🔴 41.3 the meeting accounts screen has nowhere to paste a key",
    !/<input|<textarea/.test(panel),
    "connect is a redirect, disconnect is a button, and there is no field",
  );

  /*
   * 🔴 …and no component can reach a sealed credential.
   *
   * `accessTokenFor` is the one function that opens one. If it is ever
   * imported by something under `components/`, the rule has been broken.
   */
  const componentImporters = files.filter(
    (file) => file.startsWith("components/") && /accessTokenFor|decryptSecret/.test(readFileSync(file, "utf8")),
  );

  check(
    "🔴 41.3 no component can open a sealed credential",
    componentImporters.length === 0,
    componentImporters.length === 0
      ? "decryption is server-side, in one function, with no path to a render"
      : componentImporters.join(", "),
  );

  /* ---------------------------------------------------- the sealing primitive -- */

  /*
   * 🔴 It fails CLOSED.
   *
   * A product that silently keeps a clinician's Zoom refresh token in
   * plaintext because an environment variable was missing is worse than one
   * that refuses to connect Zoom at all, and the refusal is visible on the
   * integrations page the same hour rather than in a breach notification a
   * year later.
   */
  /*
   * 🔴 BOTH behaviours, in one run, whatever this deployment is configured
   * with.
   *
   * The first draft branched on `secretsConfigured()` and tested one half or
   * the other, so a run against a machine with no key never exercised the
   * encryption and a run against one with a key never exercised the refusal —
   * and the summary said PASS either way, with a different number of checks
   * nobody would notice. A gate whose coverage depends on an environment
   * variable is a gate that is quietly half open.
   *
   * `secretbox` reads the key on every call for exactly this reason, so the
   * variable can be moved under the test and put back.
   */
  const realKey = process.env.TOKEN_ENCRYPTION_KEY;

  delete process.env.TOKEN_ENCRYPTION_KEY;
  let refusedToStore = false;
  try {
    encryptSecret("anything");
  } catch {
    refusedToStore = true;
  }

  check(
    "🔴 41.3 with no key configured, storing a credential is REFUSED rather than done in plaintext",
    refusedToStore && !secretsConfigured(),
    "fails closed, and the integrations page says so before anybody tries",
  );

  /*
   * 🔴 A short key is a misconfiguration, not a weaker mode.
   *
   * Padding it out or hashing it up to length would produce something that
   * works and is not what the operator configured.
   */
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("too short").toString("base64");
  check(
    "🔴 41.3 a key of the wrong length is refused rather than stretched",
    !secretsConfigured(),
    "AES-256 takes 32 bytes, and anything else is a misconfiguration to fix",
  );

  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    const secret = `verify41-${Date.now()}`;
    const sealed = encryptSecret(secret);

    check(
      "🔴 41.3 a sealed credential round-trips, and the ciphertext is not the plaintext",
      decryptSecret(sealed) === secret && !sealed.includes(secret),
      "AES-256-GCM, a fresh nonce per message",
    );

    /*
     * 🔴 CONTROL — a tampered ciphertext does NOT open.
     *
     * Authenticated encryption is the whole reason for GCM here. Without this
     * the check above passes for a mode that decrypts anything into rubbish
     * and hands it to Zoom as a refresh token.
     */
    const [version, iv, tag, body] = sealed.split(".");
    const tampered = [version, iv, tag, `${body!.slice(0, -4)}AAAA`].join(".");
    let openedTampered = true;
    try {
      decryptSecret(tampered);
    } catch {
      openedTampered = false;
    }

    check(
      "🔴 CONTROL a tampered credential refuses to open rather than decrypting to rubbish",
      !openedTampered,
      "the auth tag is checked, so a changed ciphertext is an error and not a value",
    );
  } finally {
    // Put the machine back exactly as it was, whichever way it started.
    if (realKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = realKey;
  }

  /* -------------------------------------------------- 41.4 / C133 · our link -- */

  /*
   * 🔴 The patient always receives OUR link, which takes consent then
   * forwards. The raw meeting link is never handed out.
   *
   * The forward only happens for a PROVISIONED source, so there is no shape in
   * which a link a therapist supplied could be forwarded to: there is nowhere
   * for such a link to have been stored (0064, C175, C215).
   */
  check(
    "🔴 41.4 / C133 a patient is forwarded only to a meeting we provisioned",
    /provisionedAt/.test(joinActions) && /externalMeetingFor/.test(joinActions),
    "the link in their message is ours, so the consent screen cannot be skipped",
  );

  /*
   * 41.4 — declining still admits them.
   *
   * A refusal turns the AI off, never the session. `admit` is reached from
   * both answers.
   */
  check(
    "41.4 declining the recording still admits the patient",
    /await recordConsent\(session\.id, consent\);\s*\n\s*return admit\(/.test(joinActions),
    "the same admit call follows either answer",
  );

  finish("sprint 41");
}

void main();
