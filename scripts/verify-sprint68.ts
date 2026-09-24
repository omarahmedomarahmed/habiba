/**
 * Sprint 68 acceptance: the partner platform, properly.
 *
 *   npm run verify:sprint68
 *
 * ## 🔴 The founder's product, in one sentence
 *
 * > A telehealth or teletherapy platform has the video, the booking and the
 * > clinicians. We provide the intelligence: the transcript, the note their therapist
 * > approves, the copilot their therapist talks to, the memory, and the summary their
 * > patient reads. Instead of building what we built, they use us.
 *
 * ## 🔴 AND THE ONE RULE THE WHOLE SPRINT IS SUBORDINATE TO
 *
 * > **A scope arrives with its endpoint, never before it.**
 *
 * `WEBHOOK_EVENTS` advertised two events nothing emitted for four sprints under a
 * green check. So the first section below pairs every scope with a route file on
 * disk, and `verify:sprint55` asserts the counts from the other direction.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { stubModules } from "./_render";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `verify68-${Date.now().toString(36)}`;

/** Every `route.ts` under a directory, as its URL path. */
function routesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") out.push(dir.slice("app".length));
    }
  };
  walk(root);
  return out;
}

async function main() {
  await stubModules();
  writesTo();

  const { API_SCOPES } = await import("../lib/db/schema");
  const { coverageSentence } = await import("../lib/partner/consent");

  /* ================================================================== */
  /*  A scope arrives with its endpoint, never before it                 */
  /* ================================================================== */

  const routes = routesUnder("app/api/partner/v1");

  /*
   * 🔴 THE PAIRING, WRITTEN OUT, because a scope's route is not derivable from its
   * name and a check that guessed would pass against a wrong guess.
   */
  const PAIRS: Record<string, string> = {
    "record:read": "/api/partner/v1/subjects/[ref]/readers",
    "session:write": "/api/partner/v1/sessions",
    "note:deliver": "/api/partner/v1/notes/[sessionId]",
    "consent:write": "/api/partner/v1/consent",
    "session:media": "/api/partner/v1/sessions/[ref]/media",
    "transcript:read": "/api/partner/v1/sessions/[ref]/transcript",
    "note:review": "/api/partner/v1/sessions/[ref]/note",
    "copilot:chat": "/api/partner/v1/copilot",
    "memory:read": "/api/partner/v1/subjects/[ref]/memory",
    "summary:deliver": "/api/partner/v1/sessions/[ref]/summary",
  };

  const missing = API_SCOPES.filter((scope) => {
    const route = PAIRS[scope];
    return !route || !routes.includes(route);
  });

  check(
    "🔴 68.24 every scope has a route file on disk, paired by name",
    missing.length === 0,
    missing.join(", ") || `${API_SCOPES.length} scopes, ${routes.length} routes`,
  );

  check(
    "🔴 68.24 CONTROL the route scan actually found routes",
    routes.length >= API_SCOPES.length,
    routes.join(" · "),
  );

  /*
   * 🔴 AND EVERY ROUTE ASKS FOR ITS OWN SCOPE, which is the half the pairing table
   * cannot see: a route could exist and guard on a different scope entirely.
   */
  const wrongScope = Object.entries(PAIRS).filter(([scope, route]) => {
    const file = `app${route.replace(/\[(\w+)\]/g, "[$1]")}/route.ts`;
    try {
      return !readSource(file).includes(`"${scope}"`);
    } catch {
      return true;
    }
  });

  check(
    "🔴 68.24 …and each route guards on the scope it is paired with",
    wrongScope.length === 0,
    wrongScope.map(([scope]) => scope).join(", ") || `${Object.keys(PAIRS).length} checked`,
  );

  /* ================================================================== */
  /*  68.1 / 68.2 · consent, and the boundary                            */
  /* ================================================================== */

  check(
    "🔴 68.2 a session recorded from the start says so, and names no minute",
    coverageSentence(0) === "This session was recorded from the start.",
    coverageSentence(0),
  );

  check(
    "🔴 68.2 a session recorded from minute ten NAMES THE MINUTE",
    /10 minutes into this session/.test(coverageSentence(600)) &&
      /Nothing before that was recorded/.test(coverageSentence(600)),
    coverageSentence(600),
  );

  check(
    "🔴 68.1 …and a session nobody consented to says nothing was written from audio",
    /not recorded/.test(coverageSentence(null)) &&
      /Nothing here was written from audio/.test(coverageSentence(null)),
    coverageSentence(null),
  );

  /*
   * 🔴 THE CONTROL FOR THE WHOLE CONSENT DESIGN.
   *
   * "Partly recorded" on its own is exactly as misleading as no sentence: somebody
   * reading a note has to know whether the part they are looking for is in it. If
   * this ever passes, the sentence has been softened into a disclaimer.
   */
  check(
    "🔴 68.2 CONTROL the partial sentence is not a vague 'partly recorded'",
    !/^partly recorded/i.test(coverageSentence(600)) &&
      /\d+ minutes?/.test(coverageSentence(600)),
    "a reader has to know whether the part they are looking for is in it",
  );

  /* ================================================================== */
  /*  68.14 to 68.19 · the limit they set                                */
  /* ================================================================== */

  const { pool, db } = connect();

  try {
    const [row] = (
      await db.execute(sql`
        INSERT INTO partners (name, slug, state) VALUES (${fixture}, ${fixture}, 'active')
        RETURNING id`)
    ).rows as { id: string }[];
    const partner = required(row, "a partner");

    const { mayRun, setLimit, usageFor } = await import("../lib/partner/usage");
    const { openSession } = await import("../lib/partner/platform");
    const { recordConsent } = await import("../lib/partner/consent");

    /*
     * 🔴 A LIMIT OF ZERO IS "NOT SET UP YET", NOT "NOTHING ALLOWED".
     *
     * Reading it as a hard stop means every new integration is broken on its first
     * live call with a message about a limit they never set.
     */
    const unset = await mayRun({ partnerId: partner.id, environment: "live" });
    check(
      "🔴 68.17 a partner who has never set a limit is NOT stopped",
      unset.allowed,
      "a zero read as a hard stop breaks every integration on its first live call",
    );

    await setLimit({ partnerId: partner.id, monthlySessionLimit: 2 });

    /*
     * Two consented live sessions, each billed at its first audio.
     *
     * 🔴 W2-X05, 2026-09-24: this used to assert that CONSENT made a session
     * billable, which was the defect: a patient who said yes and never started
     * cost the partner a session. The unit is unchanged (one per session); what
     * bills it is the first audio, so the fixture now says so.
     */
    const { billFirstAudio } = await import("../lib/partner/platform");
    for (const n of [1, 2]) {
      await recordConsent({
        partnerId: partner.id,
        externalSessionRef: `${fixture}-S${n}`,
        externalSubjectRef: `${fixture}-P1`,
        state: "given",
        answeredAt: new Date(),
        offsetSeconds: 0,
      });
      const opened = await openSession({
        partnerId: partner.id,
        environment: "live",
        externalSessionRef: `${fixture}-S${n}`,
        externalSubjectRef: `${fixture}-P1`,
      });
      await billFirstAudio(opened.id);
    }

    const used = await usageFor(partner.id);
    check(
      "🔴 68.14 a live session with audio is ONE billable unit, priced per session",
      used.used === 2 && used.limit === 2,
      `${used.used} of ${used.limit}`,
    );

    /* 🔴 And the third is stopped, with a sentence. */
    const third = await openSession({
      partnerId: partner.id,
      environment: "live",
      externalSessionRef: `${fixture}-S3`,
      externalSubjectRef: `${fixture}-P1`,
    });

    check(
      "🔴 68.17 at the limit, we stop, and the reason is a SENTENCE not a boolean",
      Boolean(third.stoppedReason) && /limit it set/.test(third.stoppedReason ?? ""),
      third.stoppedReason ?? "not stopped",
    );

    check(
      "🔴 68.18 …and the sentence says THEIR platform is unaffected",
      /unaffected/.test(third.stoppedReason ?? "") &&
        /your own platform/i.test(third.stoppedReason ?? ""),
      "a copilot that vanishes without a word is read as our outage",
    );

    const after = await usageFor(partner.id);
    check(
      "🔴 68.17 …and the stopped session is NOT billed: we did not do it",
      after.used === 2,
      `${after.used} billable after a third session we refused`,
    );

    /* 🔴 THE DATABASE REFUSES A BILLABLE STOPPED SESSION, whatever the code does. */
    let dbRefusedStopped = false;
    try {
      await db.execute(sql`
        INSERT INTO partner_sessions (partner_id, environment, external_session_ref,
                                      external_subject_ref, stopped_reason, billable)
        VALUES (${partner.id}, 'live', ${`${fixture}-X`}, ${`${fixture}-P1`}, 'stopped', true)`);
    } catch {
      dbRefusedStopped = true;
    }

    check(
      "🔴 68.17 the DATABASE refuses a stopped session that is billable",
      dbRefusedStopped,
      "'we did not do the session, so we do not bill for it' in a constraint",
    );

    /* 🔴 68.22 — SANDBOX REACHES NO REAL PATIENT AND BILLS NOTHING. */
    let dbRefusedSandbox = false;
    try {
      await db.execute(sql`
        INSERT INTO partner_sessions (partner_id, environment, external_session_ref,
                                      external_subject_ref, billable)
        VALUES (${partner.id}, 'sandbox', ${`${fixture}-Y`}, ${`${fixture}-P1`}, true)`);
    } catch {
      dbRefusedSandbox = true;
    }

    check(
      "🔴 68.22 the DATABASE refuses a BILLABLE sandbox session",
      dbRefusedSandbox,
      "a sandbox key that could run up a bill is a bill against an account nobody approved",
    );

    const sandbox = await openSession({
      partnerId: partner.id,
      environment: "sandbox",
      externalSessionRef: `${fixture}-SB`,
      externalSubjectRef: `${fixture}-P1`,
    });

    check(
      "🔴 68.22 …and a sandbox session runs even when live is stopped, billing nothing",
      sandbox.stoppedReason === null,
      "sandbox bills nothing, so there is nothing to cap",
    );

    const sandboxCounted = await usageFor(partner.id);
    check(
      "🔴 68.22 …and it does not appear in the usage the partner is billed on",
      sandboxCounted.used === 2,
      `${sandboxCounted.used} after a sandbox session`,
    );

    /*
     * 🔴 68.10 — AND AN UNCLAIMED SUBJECT EXISTS FOR THE LIVE ONES ONLY.
     *
     * A claimable row for a sandbox reference would let somebody claim a subject that
     * was never a person.
     */
    const subjects = await db.execute(sql`
      SELECT count(*)::int AS n FROM partner_subjects
       WHERE partner_id = ${partner.id} AND person_id IS NULL`);

    check(
      "🔴 68.10 an unclaimed subject is created for a live session, for the person to claim",
      Number((subjects.rows[0] as { n: number }).n) === 1,
      `${JSON.stringify(subjects.rows)}, one subject for one live external ref`,
    );

    /* ================================================================ */
    /*  68.16 · the alerts, once each                                   */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE partner_limits SET monthly_session_limit = 2, alerted_80_at = NULL,
                                alerted_90_at = NULL
       WHERE partner_id = ${partner.id}`);

    const { alertApproachingLimits } = await import("../lib/partner/usage");
    const first = await alertApproachingLimits();
    const second = await alertApproachingLimits();

    check(
      "🔴 68.16 an alert is sent ONCE per period, not on every cron run",
      first.alerted >= 1 && second.alerted === 0,
      `first run ${first.alerted}, second run ${second.alerted}`,
    );

    /* ================================================================ */
    /*  68.6 · §7's first hard rule, across a commercial boundary        */
    /* ================================================================ */

    const [sess] = (
      await db.execute(sql`
        SELECT id FROM partner_sessions
         WHERE partner_id = ${partner.id} AND external_session_ref = ${`${fixture}-S1`}`)
    ).rows as { id: string }[];
    const session = required(sess, "a partner session");

    const { approveNote, deliverSummary } = await import("../lib/partner/notes");

    const noName = await approveNote({
      partnerSessionId: session.id,
      text: "A note long enough to be a note, written by somebody.",
      clinicianRef: "   ",
    });

    check(
      "🔴 68.6 / §7 a note with NO NAMED CLINICIAN is refused",
      Boolean(noName.error) && /person who read this/.test(noName.error ?? ""),
      noName.error ?? "it was accepted",
    );

    /* 🔴 AND THE SUMMARY IS REFUSED BEFORE THE NOTE IS APPROVED. */
    const early = await deliverSummary({
      partnerSessionId: session.id,
      text: "A summary for the patient, long enough to count.",
    });

    check(
      "🔴 68.9 a summary is refused before anybody has approved the note",
      Boolean(early.error) && /nobody in between/.test(early.error ?? ""),
      early.error ?? "it was delivered",
    );

    const approved = await approveNote({
      partnerSessionId: session.id,
      text: "Subjective\nThe patient described a difficult fortnight.",
      clinicianRef: "C-9",
    });

    check(
      "🔴 CONTROL a note WITH a named clinician is accepted, so the rule is a rule",
      approved.ok === true,
      approved.error ?? "accepted",
    );

    const twice = await approveNote({
      partnerSessionId: session.id,
      text: "Subjective\nA different note entirely.",
      clinicianRef: "C-11",
    });

    check(
      "🔴 68.6 …and a SECOND approval is refused: an approval is a signature",
      Boolean(twice.error),
      twice.error ?? "a second name overwrote the first",
    );

    const now = await deliverSummary({
      partnerSessionId: session.id,
      text: "A summary for the patient, long enough to count.",
    });

    check(
      "🔴 68.9 CONTROL …and once the note is approved the summary goes",
      now.ok === true,
      now.error ?? "delivered",
    );

    /* 🔴 THE DATABASE HOLDS BOTH RULES TOO. */
    let dbRefusedHalfApproval = false;
    try {
      await db.execute(sql`
        UPDATE partner_sessions SET note_approved_text = 'x', note_approved_by_ref = NULL
         WHERE id = ${session.id}`);
    } catch {
      dbRefusedHalfApproval = true;
    }

    check(
      "🔴 68.6 the DATABASE refuses approved text with no approver",
      dbRefusedHalfApproval,
      "a partner's server is not a clinician, and no header or field makes it one",
    );
  } finally {
    await db.execute(sql`DELETE FROM partner_subjects WHERE external_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_sessions WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_consents WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_limits WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partners WHERE slug = ${fixture}`);
    await pool.end();
  }

  /* ================================================================== */
  /*  the source properties a runtime check cannot see                   */
  /* ================================================================== */

  const platform = readSource("lib/partner/platform.ts");
  const copilot = readSource("lib/partner/copilot.ts");
  const media = readSource("lib/partner/media.ts");
  const keys = readSource("lib/partner/keys.ts");

  check(
    "🔴 68.17 the limit is asked BEFORE the consent log, so a spent limit is not a probe",
    platform.indexOf("mayRun(") < platform.indexOf("recordingFrom("),
    "asking consent first lets a partner probe which patients consented on a dead limit",
  );

  check(
    "🔴 68.3 audio is taken and video is REFUSED, by content type",
    /\^audio\\\//.test(readSource("app/api/partner/v1/sessions/[ref]/media/route.ts")),
    "a therapy room on our disks is a thing nobody asked us to hold",
  );

  check(
    "🔴 68.3 …and the consent boundary comes from OUR log, never from their body",
    /allowed\.session\.recordingFromSeconds/.test(
      readSource("app/api/partner/v1/sessions/[ref]/media/route.ts"),
    ),
    "a partner could otherwise post a whole session claiming it starts at minute ten",
  );

  check(
    "🔴 68.5 the transcriber is told to DETECT the language, never told English",
    /language: null/.test(media),
    "every Arabic session asserted to be English is a defect this product already shipped once",
  );

  /*
   * 🔴 68.7 / 68.8 — THE COPILOT READS THE PARTNER'S OWN MATERIAL AND NOTHING OF OURS.
   *
   * Pointing `askPatientCopilot` at a partner's session would hand one person's record
   * from our tenancy into a prompt on behalf of a clinician on a platform that person
   * never chose. Sprints 26 and 27 built the opposite mechanism for exactly this.
   */
  check(
    "🔴 68.7 the partner copilot does NOT read our own patient record",
    !/askPatientCopilot|buildPatientContext|journalsFor/.test(copilot),
    "a person's record reaching a model on somebody else's platform is not ours to do",
  );

  check(
    "🔴 68.7 …and its citations are resolved against what we sent, not parsed and trusted",
    /answer\.includes\(`\[\$\{ref\}\]`\)/.test(copilot),
    "a model can cite a session that does not exist, and a link to it goes nowhere",
  );

  check(
    "🔴 68.8 continuity is the APPROVED note, never the draft",
    /note: partnerSessions\.noteApprovedText/.test(copilot),
    "a therapist reading a draft as a fact about March is reading nobody's words",
  );

  check(
    "🔴 68.20 / 68.21 a sandbox key is self-serve and a LIVE one needs an approval",
    /input\.environment === "live"/.test(keys) && /approvedAt/.test(keys),
    "a key behind a sales call is a product nobody evaluates; a live key reaches real people",
  );

  const partnerAdmin = readSource("lib/data/partner-admin.ts");
  check(
    "🔴 68.21 / C264 the approval names the human who made it",
    /approvedByUserId: input\.byUserId/.test(partnerAdmin) &&
      /documentsUrl \|\| !partner\.contactName/.test(partnerAdmin),
    "approving without documents is approving a form",
  );

  check(
    "🔴 68.12 there is no profession anywhere in the clinician opt-in",
    !/therapist|psycholog|counsell/i.test(
      readSource("drizzle/0095_partner_platform.sql").split("partner_clinicians")[1]?.slice(0, 600) ??
        "",
    ) || !/profession|specialty|discipline/i.test(readSource("lib/partner/platform.ts")),
    "we do not decide who is a therapist on somebody else's platform",
  );

  const usage = readSource("lib/partner/usage.ts");
  check(
    "🔴 68.16 the alert stamp is CLAIMED with a conditional update, not read then written",
    /IS NULL`\)\)/.test(usage) && /\.returning\(\{ partnerId/.test(usage),
    "two crons overlapping both read 'not alerted', both pass a check, and both send",
  );

  const billing = readSource("lib/partner/billing.ts");
  check(
    "🔴 68.19 the bill goes through `journal`, which balances or throws",
    /journal\(\{/.test(billing) && !/insert\(invoices\)/.test(billing),
    "C226: a second money path is a second set of arithmetic to reconcile",
  );

  check(
    "🔴 68.19 …and it bills the PREVIOUS month, never one that is still running",
    /getUTCMonth\(\) - 1/.test(billing),
    "billing a running month charges for part of it and then charges again",
  );

  check(
    "🔴 68.19 …and it refuses to post twice, by asking the LEDGER rather than a flag",
    /refType, "partner_month"/.test(billing),
    "the ledger is the record, so asking it is asking the thing that decides",
  );

  finish("sprint 68");
}

main();
