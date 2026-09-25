/**
 * Round 1, clinician portal: the public page, the price and the verification form.
 *
 *   npm run verify:r1-portal
 *
 * B4, B10, B11, B12, B13, B14, B36, B37 and B38 from docs/simulation-run/BUGS.md,
 * and the session-side B61, B62, B63, B64, B66 and B68 from round 1b.
 * Everything below is planted and removed by this run (H29), on an organisation
 * and a clinician nobody else uses. Each absence is bracketed by its control.
 */
import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const tag = `r1p-${randomBytes(4).toString("hex")}`;

  const org = required(
    (
      await db.execute(sql`
        INSERT INTO organizations (name, slug, kind) VALUES (${tag}, ${tag}, 'solo') RETURNING id`)
    ).rows[0] as { id: string } | undefined,
    "fixture organisation",
  );
  const user = required(
    (
      await db.execute(sql`
        INSERT INTO users (organization_id, email, first_name, last_name, role, status, password_hash,
                           session_rate_cents, rate_currency, rate_egp_minor)
        VALUES (${org.id}, ${`${tag}@example.com`}, 'Rone', 'Fixture', 'therapist', 'active',
                'not-a-real-hash-this-fixture-never-signs-in', 2000, 'egp', 100000)
        RETURNING id`)
    ).rows[0] as { id: string } | undefined,
    "fixture clinician",
  );

  let sessionId: string | null = null;
  const planted: string[] = [];
  try {
    const { publicProfile } = await import("../lib/data/radar");

    /* ------------------------------------------------ B4 · no radar row, still a page */

    const radarRows = async () =>
      Number(
        (
          (
            await db.execute(sql`SELECT count(*)::int AS n FROM therapist_radar WHERE user_id = ${user.id}`)
          ).rows[0] as { n: number }
        ).n,
      );

    check(
      "B4 CONTROL an unverified clinician has no public page",
      (await publicProfile(user.id)) === null,
      "without this the check below could pass on a page that publishes anybody",
    );

    await db.execute(sql`
      INSERT INTO therapist_verifications (user_id, organization_id, state, submitted_at, reviewed_at,
                                           country, license_body, license_number)
      VALUES (${user.id}, ${org.id}, 'approved', now(), now(), 'EG', 'Fixture council', 'EG-R1-0001')`);

    const profile = await publicProfile(user.id);
    check(
      "B4 a verified clinician who never opened /on-call HAS a public page",
      (await radarRows()) === 0 && profile !== null,
      "publicProfile inner-joined therapist_radar, which only /on-call creates, so /t/<id> was a 404",
    );
    check(
      "B4 …and reads as offline, with nothing invented for the missing radar row",
      profile?.status === "offline" && profile.languages.length === 0 && profile.practice === null,
      `status ${profile?.status}`,
    );

    /* ------------------------------------------------ B10 · the pounds they typed lead */

    check(
      "B10 a clinician priced in pounds carries those pounds to the public page",
      profile?.rateEgpMinor === 100000,
      `rateEgpMinor ${profile?.rateEgpMinor}; the page headlined the converted $20`,
    );
    await db.execute(sql`UPDATE users SET rate_currency = 'usd', rate_egp_minor = NULL WHERE id = ${user.id}`);
    check(
      "B10 CONTROL a clinician priced in dollars carries none",
      (await publicProfile(user.id))?.rateEgpMinor === null,
      "the dollar path is unchanged",
    );
    const page = readSource("components/radar/therapist-page.tsx");
    const card = readSource("components/radar/public-profile.tsx");
    check(
      "B10 every price on the page goes through SessionPrice",
      (page.match(/<SessionPrice /g) ?? []).length === 2 && card.includes("<SessionPrice "),
      "the headline, the price line and the calendar label",
    );

    /* ------------------------------------------------ B11 · one fee, one net */

    const console_ = readSource("components/radar/therapist-console.tsx");
    const onCall = readSource("app/(app)/on-call/page.tsx");
    check(
      "B11 /on-call no longer computes 'You keep' at a fixed 10%",
      !/\* 1000\) \/ 10_000/.test(console_) && /platformFeeOn\(priced\.cents, props\.feeBps\)/.test(console_),
      "it said EGP 900 where /settings said EGP 850 for the same 1,000",
    );
    check(
      "B11 …and the fee it is given is the operator's, the one a payment is charged",
      /feeBps=\{settings\.session\.platformFeeBps\}/.test(onCall),
      "the same setting /settings and lib/billing/connect.ts read",
    );
    const { platformFeeOn } = await import("../lib/settings/defs");
    const settingsKeep = (gross: number, bps: number) => gross - Math.floor((gross * bps) / 10_000);
    check(
      "B11 CONTROL the two formulas agree on EGP 1,000 at 15%",
      100000 - platformFeeOn(100000, 1500) === settingsKeep(100000, 1500) && settingsKeep(100000, 1500) === 85000,
      "EGP 850 on both screens",
    );

    /* ------------------------------------------------ B12 · the licence we checked */

    const settingsPage = readSource("app/(app)/settings/page.tsx");
    check(
      "B12 settings shows the checked licence number and regulator once locked",
      /verification\?\.licenseNumber/.test(settingsPage) && /verification\?\.licenseBody/.test(settingsPage),
      "the fields read users.profile, which onboarding never writes",
    );

    /* ------------------------------------------------ B13 · rejected until changed */

    const { writeVerificationDetails } = await import("../lib/data/licence-change");
    type Actor = import("../lib/auth/session").Actor;
    const actor = { userId: user.id, organizationId: org.id, region: "us" } as unknown as Actor;
    await db.execute(sql`
      UPDATE therapist_verifications
         SET state = 'rejected', specialties = '["anxiety"]'::jsonb, languages = '["en"]'::jsonb,
             license_expiry = NULL
       WHERE user_id = ${user.id}`);
    const same = {
      country: "EG",
      licenseBody: "Fixture council",
      licenseNumber: "EG-R1-0001",
      licenseExpiry: null,
      specialties: ["anxiety"],
      languages: ["en"],
    };
    const stateNow = async () =>
      (
        (await db.execute(sql`SELECT state FROM therapist_verifications WHERE user_id = ${user.id}`))
          .rows[0] as { state: string }
      ).state;

    await writeVerificationDetails(actor, same);
    check(
      "B13 saving the untouched form after a rejection leaves it rejected",
      (await stateNow()) === "rejected",
      "it moved to draft, which enabled Submit with the same documents",
    );
    await writeVerificationDetails(actor, { ...same, licenseNumber: "EG-R1-0002" });
    check(
      "B13 CONTROL a changed licence number reopens it as a draft",
      (await stateNow()) === "draft",
      "TH2.6: a change is what moves rejected to draft",
    );
    const actions = readSource("app/(app)/onboarding/actions.ts");
    check(
      "B13 submitForReview refuses a rejected row outright",
      /current\.state === "rejected"\) return \{ error: t\("tver\.changeFirst"\) \}/.test(actions),
      "it checked only that the fields were present",
    );

    /* ------------------------------------------------ B14 · no link to a 404 */

    await db.execute(sql`UPDATE therapist_verifications SET state = 'rejected' WHERE user_id = ${user.id}`);
    check(
      "B14 a rejected clinician has no public page, so the link must not be offered",
      (await publicProfile(user.id)) === null,
      "the predicate both link sites now ask",
    );
    check(
      "B14 settings and /on-call offer the link only when publicProfile answers",
      /published \?/.test(settingsPage) && /published \?/.test(onCall),
      "it opened 'We could not find that page'",
    );

    /* ------------------------------------------------ B36 · Arabic on Arabic screens */

    const { DICTIONARIES } = await import("../lib/i18n/messages");
    const dict = DICTIONARIES as unknown as Record<string, Record<string, string>>;
    const { missingFrom } = await import("../lib/data/verification");
    const allMissing = missingFrom({
      country: null,
      licenseBody: null,
      licenseNumber: null,
      specialties: [],
      languages: [],
      idFrontUrl: null,
      licenseDocUrl: null,
      headshotUrl: null,
    });
    check(
      "B36 every missing item has an English and an Arabic line",
      allMissing.length === 8 &&
        allMissing.every((item) => dict.en?.[`tver.missing.${item}`] && dict.ar?.[`tver.missing.${item}`]),
      "the checklist printed 'Photo ID' on an Arabic form",
    );
    const { requirementOverrides } = await import("../lib/data/verification");
    const { COUNTRY_SEED } = await import("../lib/settings/defs");
    const eg = (await requirementOverrides()).EG;
    const seededEg = COUNTRY_SEED.find((c) => c.code === "EG");
    check(
      "B36 a document label still equal to the shipped seed falls to the dictionary",
      eg !== undefined && eg.licenceLabel !== seededEg?.licenceLabel && eg.idLabelFront !== seededEg?.idLabelFront,
      "'Practising licence or syndicate card' was shown as typed on the Arabic form",
    );
    const { tierName } = await import("../lib/billing/tier-name");
    const ar = (key: string) => dict.ar?.[key] ?? key;
    check(
      "B36 a shipped tier is named in the reader's language; an admin's own tier keeps its name",
      tierName({ key: "payg", name: "Pay as you go" }, ar) === dict.ar?.["pricing.tier.payg"] &&
        tierName({ key: "custom", name: "Typed by an admin" }, ar) === "Typed by an admin",
      "the dashboard printed 'Pay as you go' in Arabic",
    );
    check(
      "B36 the copilot speed label goes through the dictionary",
      !readSource("components/assistant/prefs-settings.tsx").includes("Speed ·") &&
        !readSource("components/assistant/prefs-prompt.tsx").includes("Speed ·"),
      "'Speed · 1.0×' on /settings in Arabic",
    );

    /* ------------------------------------------------ B37 · the list follows the uploads */

    const form = readSource("components/onboarding/verification-form.tsx");
    check(
      "B37 an upload removes its line from the checklist without a reload",
      /onLanded\(doc\.key\)/.test(form) && /outstanding\.map/.test(form),
      "three uploads showed 'uploaded' and the list still named two as missing",
    );

    /* ------------------------------------------------ B38 · Egypt's regulator chips */

    const { regulatorsFor } = await import("../lib/regulators");
    const configured = regulatorsFor("EG", { EG: { regulators: ["A body an operator typed"] } });
    check(
      "B38 one configured Egyptian regulator no longer hides the shipped ones",
      configured[0] === "A body an operator typed" && configured.length > 1,
      `${configured.length} offered; chips render only for two or more`,
    );
    check(
      "B38 CONTROL a country with neither offers nothing rather than an invention",
      regulatorsFor("ZZ", {}).length === 0,
      "free text, no suggestions",
    );

    /* ------------------------------------------------ B61 · one side of the call */

    const session = required(
      (
        await db.execute(sql`
          INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token,
                                guest_name, started_at, ended_at, recording_consent)
          VALUES (${org.id}, ${user.id}, 'completed', 'video', ${`fb-${tag}`}, 'Layla Fixture',
                  now() - interval '1 hour', now() - interval '10 minutes', 'granted')
          RETURNING id`)
      ).rows[0] as { id: string } | undefined,
      "fixture session",
    );
    sessionId = session.id;
    const segment = (n: number, speaker: string, inferred: boolean) =>
      db.execute(sql`
        INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, speaker_inferred,
                                         text, start_ms, end_ms)
        VALUES (${session.id}, ${org.id}, ${n}, ${speaker}, ${inferred},
                'How has the month been since we last spoke, and what happens at work in the evenings?',
                ${(n - 1) * 8000}, ${n * 8000})`);
    await segment(1, "therapist", false);
    /* A line diarisation GUESSED to be the patient's: not their track, so still one side. */
    await segment(2, "patient", true);

    const { capturedSideFor, noteProvenanceFor } = await import("../lib/data/feedback");
    const origin = await noteProvenanceFor(session.id);
    check(
      "B61 a video session with no line on the patient's track is stamped as one side",
      (await capturedSideFor(session.id)) === "clinician" && origin.capturedSide === "clinician",
      `provenance ${origin.provenance}; the page said "the whole session was captured"`,
    );
    await segment(3, "patient", false);
    check(
      "B61 CONTROL one line heard on the patient's track and the session has both sides",
      (await capturedSideFor(session.id)) === null,
      "without this the check above could pass on a rule that always says one side",
    );
    await db.execute(sql`DELETE FROM transcript_segments WHERE session_id = ${session.id} AND sequence = 3`);
    await db.execute(sql`UPDATE sessions SET modality = 'in_person' WHERE id = ${session.id}`);
    check(
      "B61 CONTROL in person one microphone hears the room, so there is no side to name",
      (await capturedSideFor(session.id)) === null,
      "the sentence is about a call",
    );
    await db.execute(sql`UPDATE sessions SET modality = 'video' WHERE id = ${session.id}`);
    const notesSource = readSource("lib/ai/notes.ts");
    check(
      "B61 the note writer is told every line is the therapist's, and diarisation does not guess",
      /only the therapist's side of this video call was captured/.test(notesSource) &&
        /oneSide\s*\?\s*`Therapist: \$\{s\.text\}`/.test(notesSource) &&
        /capturedSideFor\(opts\.sessionId\)\) !== "clinician"\) \{\s*const \{ diariseSession \}/.test(notesSource),
      "it read the clinician's reflections as the patient's account",
    );
    const column = (
      await db.execute(sql`
        SELECT count(*)::int AS n FROM information_schema.columns
         WHERE table_name = 'session_notes' AND column_name = 'captured_side'`)
    ).rows[0] as { n: number };
    check(
      "B61 session_notes.captured_side exists (0176), so the fact outlives the segments",
      Number(column.n) === 1,
      "H1: the migration runner's success line is not evidence",
    );
    check(
      "B61 the provenance line says one side, in both languages",
      Boolean(dict.en?.["note.origin.oneSideWhy"] && dict.ar?.["note.origin.oneSideWhy"]) &&
        /capturedSide=\{note\.capturedSide\}/.test(readSource("app/(app)/sessions/[id]/page.tsx")),
      "note.origin.oneSideWhy",
    );

    /* ------------------------------------------------ B62 · the clinician's own track */

    const room = readSource("components/session/session-room.tsx");
    check(
      "B62 on video the clinician's own recorder is labelled as the clinician",
      /uploadChunk\(blob, durationSeconds, props\.modality === "video" \? "therapist" : "unknown"\)/.test(room) &&
        !/twoTrack \? "therapist" : "unknown"/.test(room),
      "it was 'unknown' whenever the patient's track was not recording, and a guess took 17 of 32 lines",
    );

    /* ------------------------------------------------ B63 · Arabic in Arabic */

    const { spokenLanguageFor } = await import("../lib/data/transcript");
    check(
      "B63 CONTROL a clinician and patient who never chose Arabic are still detected",
      (await spokenLanguageFor({ therapistId: user.id, patientId: null, transcriptLanguage: null })) === null,
      "null means detect",
    );
    await db.execute(sql`UPDATE users SET locale = 'ar' WHERE id = ${user.id}`);
    check(
      "B63 a clinician who works in Arabic has their sessions transcribed as Arabic",
      (await spokenLanguageFor({ therapistId: user.id, patientId: null, transcriptLanguage: null })) === "ar",
      "detection returned «يعني صعب عليكي ترفضي» as 'Jani, sa ba' li tirfudi'",
    );
    check(
      "B63 …and a language set in the room still wins",
      (await spokenLanguageFor({ therapistId: user.id, patientId: null, transcriptLanguage: "en" })) === "en",
      "the room's choice is the person's",
    );
    check(
      "B63 the transcription route asks it",
      /language: await spokenLanguageFor\(session\)/.test(readSource("app/api/sessions/[id]/transcribe/route.ts")),
      "it passed session.transcriptLanguage, null unless somebody pressed a button",
    );

    /* ------------------------------------------------ the start ruling · one clock */

    /*
     * Replaces B64's "Start now anyway". A booked session: more than
     * `soonMinutes` ahead shows the time and nothing to press, then "Starting
     * soon", then "Join early" in the last `joinEarlyMinutes`, on both sides and
     * on the server. Each refusal below is bracketed by the start or join it
     * must not refuse, so a gate that refused everything would fail too (H25).
     */
    const { startWindow, windowFor } = await import("../lib/sessions/start-window");
    const { getSettings } = await import("../lib/settings");
    const { parseGroup } = await import("../lib/settings/defs");
    const rule = (await getSettings()).rules.start;
    const minute = 60_000;
    const t0 = Date.now();
    check(
      "START the rule is a setting, 15 and 5 by default",
      parseGroup("rules", {}).start.soonMinutes === 15 && parseGroup("rules", {}).start.joinEarlyMinutes === 5,
      JSON.stringify(parseGroup("rules", {}).start),
    );
    check(
      "START CONTROL a Join early wider than Starting soon is pulled back to it",
      parseGroup("rules", { start: { soonMinutes: 5, joinEarlyMinutes: 10 } }).start.joinEarlyMinutes === 5,
    );
    const at = (m: number) => new Date(t0 + m * minute);
    const windows = [
      startWindow(at(rule.soonMinutes + 45), t0, rule),
      startWindow(at((rule.soonMinutes + rule.joinEarlyMinutes) / 2), t0, rule),
      startWindow(at(rule.joinEarlyMinutes / 2), t0, rule),
      startWindow(at(-1), t0, rule),
      startWindow(null, t0, rule),
    ];
    check(
      "START the three windows: booked, soon, early; then open, and open when nothing was booked",
      windows.join(",") === "booked,soon,early,open,open",
      windows.join(","),
    );
    check(
      "START CONTROL the windows move with the setting, not a constant",
      startWindow(at(20), t0, { soonMinutes: 30, joinEarlyMinutes: 10 }) === "soon" &&
        startWindow(at(20), t0, { soonMinutes: 15, joinEarlyMinutes: 5 }) === "booked",
    );
    check(
      "START a session already under way is never held by the clock",
      windowFor({ status: "in_progress", scheduledAt: at(60) }, t0, rule) === "open",
    );

    /* The server: startSession, on four planted sessions. */
    const { startSession, TooEarlyError } = await import("../lib/data/sessions");
    const starter = {
      userId: user.id,
      organizationId: org.id,
      role: "therapist" as const,
      email: `${tag}@example.com`,
      timezone: "UTC",
    };
    const plant = async (minutesAhead: number | null, token: string | null = null) => {
      const row = required(
        (
          await db.execute(sql`
            INSERT INTO sessions (organization_id, therapist_id, status, modality, guest_name, feedback_token,
                                  scheduled_at, join_token, join_token_expires_at)
            VALUES (${org.id}, ${user.id}, 'scheduled', 'in_person', 'Layla Fixture',
                    ${`fb-${tag}-${randomBytes(6).toString("hex")}`},
                    ${minutesAhead === null ? null : at(minutesAhead).toISOString()}::timestamptz,
                    ${token}, ${token ? new Date(t0 + 24 * 60 * minute).toISOString() : null}::timestamptz)
            RETURNING id`)
        ).rows[0] as { id: string } | undefined,
        "fixture booked session",
      );
      planted.push(row.id);
      return row.id;
    };
    const tryStart = async (id: string) => {
      try {
        return (await startSession(starter as never, id)) ? "started" : "unchanged";
      } catch (error) {
        return error instanceof TooEarlyError ? `refused:${error.window}` : `error:${(error as Error).message}`;
      }
    };
    const statusOf = async (id: string) =>
      ((await db.execute(sql`SELECT status FROM sessions WHERE id = ${id}`)).rows[0] as { status: string }).status;

    const far = await plant(rule.soonMinutes + 45);
    const soon = await plant((rule.soonMinutes + rule.joinEarlyMinutes) / 2);
    const early = await plant(rule.joinEarlyMinutes / 2);
    const walkIn = await plant(null);
    const farStart = await tryStart(far);
    check(
      "START the server refuses a start more than Starting soon ahead, and nothing moves",
      farStart === "refused:booked" && (await statusOf(far)) === "scheduled",
      farStart,
    );
    const soonStart = await tryStart(soon);
    check(
      "START the server refuses a start inside Starting soon, and nothing moves",
      soonStart === "refused:soon" && (await statusOf(soon)) === "scheduled",
      soonStart,
    );
    const earlyStart = await tryStart(early);
    check(
      "START CONTROL inside Join early the same call starts it",
      earlyStart === "started" && (await statusOf(early)) === "in_progress",
      earlyStart,
    );
    const walkInStart = await tryStart(walkIn);
    check(
      "START CONTROL a session nobody booked starts at once, as before",
      walkInStart === "started" && (await statusOf(walkIn)) === "in_progress",
      walkInStart,
    );

    /* The patient's side of the server: the join actions, on a planted join link. */
    const joinActions = await import("../app/join/[token]/actions");
    const { translator: words } = await import("../lib/i18n/server");
    const tooEarlyText = words("en")("join.opensBefore", { minutes: rule.joinEarlyMinutes });
    const joinToken = `r1p-join-${randomBytes(12).toString("hex")}`;
    const booked = await plant(rule.soonMinutes + 45, joinToken);
    const joinRow = async () =>
      (
        await db.execute(sql`
          SELECT patient_joined_at AS joined, recording_consent AS consent FROM sessions WHERE id = ${booked}`)
      ).rows[0] as { joined: string | null; consent: string | null };

    const consentFar = await joinActions.answerConsent(joinToken, "granted");
    const resumeFar = await joinActions.resumeAfterPayment(joinToken);
    const afterFar = await joinRow();
    check(
      "START the server refuses a join more than Starting soon ahead: no consent written, not marked in the room",
      consentFar.error === tooEarlyText && resumeFar.error === tooEarlyText && !afterFar.joined && !afterFar.consent,
      JSON.stringify({ consentFar, resumeFar, afterFar }),
    );
    await db.execute(sql`
      UPDATE sessions SET scheduled_at = ${at((rule.soonMinutes + rule.joinEarlyMinutes) / 2).toISOString()}::timestamptz
       WHERE id = ${booked}`);
    const consentSoon = await joinActions.answerConsent(joinToken, "granted");
    check(
      "START the server refuses a join inside Starting soon",
      consentSoon.error === tooEarlyText && !(await joinRow()).consent,
      JSON.stringify(consentSoon),
    );
    await db.execute(sql`
      UPDATE sessions SET scheduled_at = ${at(rule.joinEarlyMinutes / 2).toISOString()}::timestamptz
       WHERE id = ${booked}`);
    const consentEarly = await joinActions.answerConsent(joinToken, "granted");
    check(
      "START CONTROL inside Join early the same join goes through the gate",
      consentEarly.error !== tooEarlyText && (await joinRow()).consent === "granted",
      JSON.stringify(consentEarly),
    );

    const joinSource = readSource("app/join/[token]/actions.ts");
    const bodyOf = (name: string) => {
      const from = joinSource.indexOf(`async function ${name}(`);
      return joinSource.slice(from, joinSource.indexOf("\n}\n", from));
    };
    const before = (body: string, first: string, then: string) =>
      body.indexOf(first) > 0 && body.indexOf(first) < body.indexOf(then);
    check(
      "START every patient entrance asks the clock before it writes: the form, the return from paying, the consent, the room key",
      before(bodyOf("submitJoin"), "notOpenYet(", "joinByToken(") &&
        before(bodyOf("resumeAfterPayment"), "notOpenYet(", "joinByToken(") &&
        before(bodyOf("answerConsent"), "notOpenYet(", "recordConsent(") &&
        before(bodyOf("admit"), "notOpenYet(", "createMeetingToken("),
    );

    const flow = readSource("components/join/join-flow.tsx");
    check(
      "START the join page shows the time or Starting soon with nothing to press, then Join early",
      /if \(notYet && booking\) \{[\s\S]{0,600}join\.startingSoon[\s\S]{0,200}join\.bookedFor/.test(flow) &&
        !/if \(notYet && booking\) \{[\s\S]{0,1400}<Submit/.test(flow) &&
        /early \? t\("join\.joinEarly"\)/.test(flow.replace(/\s+/g, " ")),
    );
    check(
      "START the room shows the time or Starting soon with no Start, then Join early, and asks nothing to confirm",
      /opening === "booked" \|\| opening === "soon"\) \? \([\s\S]{0,500}troom\.startingSoon[\s\S]{0,120}troom\.bookedFor[\s\S]{0,120}\) : \([\s\S]{0,300}troom\.joinEarly/.test(room) &&
        !/confirmEarly|startAnyway|earlyStart/.test(room + readSource("app/(app)/sessions/actions.ts")),
    );
    const startKeys = [
      "troom.bookedFor", "troom.startingSoon", "troom.joinEarly",
      "join.bookedFor", "join.startingSoon", "join.opensBefore", "join.joinEarly", "join.payAhead",
    ];
    check(
      "START every new line is in English and Arabic",
      startKeys.every((k) => dict.en?.[k] && dict.ar?.[k] && /[\u0600-\u06FF]/.test(dict.ar[k]!)),
      startKeys.filter((k) => !(dict.en?.[k] && dict.ar?.[k])).join(", "),
    );
    check(
      "B64 the session page keeps the booked hour",
      /const sessionTime = row\.session\.scheduledAt \?\? row\.session\.endedAt/.test(
        readSource("app/(app)/sessions/[id]/page.tsx"),
      ),
      "it led with the end time, so the booking read as 00:30",
    );

    /* ------------------------------------------------ B66 · the yes arrives */

    check(
      "B66 the room keeps asking for the patient's answer after they join, before Start",
      /if \(!live && props\.modality !== "video"\) return;/.test(room),
      "the poll stopped at 'joined', so 'Waiting for their yes' outlived the yes",
    );

    /* ------------------------------------------------ B68 · the banner names the patient */

    await db.execute(sql`
      INSERT INTO manual_payments (purpose, ref_id, amount_cents, currency, settles_cents, payer_kind,
                                   organization_id, state, submitted_at)
      VALUES ('session', ${session.id}, 100000, 'EGP', 2000, 'session', ${org.id}, 'submitted', now())`);
    const { pendingPaymentFor } = await import("../lib/billing/pending");
    const { translator } = await import("../lib/i18n/server");
    const onPractice = await pendingPaymentFor({ kind: "organization", organizationId: org.id }, translator("en"), "en");
    const onPayer = await pendingPaymentFor({ kind: "session", sessionId: session.id }, translator("en"), "en");
    check(
      "B68 the clinician's bar names the patient",
      Boolean(onPractice?.what.includes("Layla Fixture")) && !onPractice?.what.includes("Rone"),
      `"${onPractice?.what}"; it said "Session with" the clinician on her own pages`,
    );
    check(
      "B68 CONTROL the patient's own bar still names the clinician",
      Boolean(onPayer?.what.includes("Rone Fixture")),
      `"${onPayer?.what}"`,
    );
  } finally {
    for (const id of planted) {
      await db.execute(sql`DELETE FROM sessions WHERE id = ${id}`);
    }
    if (sessionId) {
      await db.execute(sql`DELETE FROM manual_payments WHERE ref_id = ${sessionId}`);
      await db.execute(sql`DELETE FROM transcript_segments WHERE session_id = ${sessionId}`);
      await db.execute(sql`DELETE FROM sessions WHERE id = ${sessionId}`);
    }
    await db.execute(sql`DELETE FROM therapist_radar WHERE user_id = ${user.id}`);
    await db.execute(sql`DELETE FROM therapist_verifications WHERE user_id = ${user.id}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${user.id}`);
    await db.execute(sql`DELETE FROM organizations WHERE id = ${org.id}`);
  }

  finish("R1 portal");
}

void main();
