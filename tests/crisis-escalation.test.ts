import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ESCALATE_AFTER_MINUTES_DEFAULT,
  FINAL_STAGE,
  MAX_OUT_OF_BAND_ATTEMPTS,
  ON_CALL_ROLES,
  crisisDueAt,
  dedupDecision,
  escalateAtFor,
  escalateNowIfExhausted,
  escalationMinutes,
  mayAcknowledge,
  needsOutOfBandRetry,
  nextEscalation,
  outOfBandExhausted,
} from "../lib/crisis/escalation";
import { patientFacingCrisisMessage } from "../lib/crisis/patient-message";
import { sosLinesFor } from "../lib/crisis/sos";
import {
  lowerCrisisDue,
  lowerMarker,
  markerFrom,
  parseMarker,
  serializeMarker,
  tickDecision,
  type ReminderMarker,
} from "../lib/sessions/reminder-marker";
import { SETTINGS_DEFAULTS, parseGroup } from "../lib/settings/defs";
import { ar, en } from "../lib/i18n/messages";

/**
 * 🔴 F2 / F5: the due diligence crisis gaps, as arithmetic.
 *
 * A crisis alert goes out of band, escalates to a backup when nobody
 * acknowledges it, an acknowledgement stops that, a higher level is never
 * deduped away, the minute tick wakes for it, the patient is told only what is
 * true in their own language, and the SOS numbers exist as plain `tel:` links.
 */

const T0 = new Date("2026-10-01T22:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

/* ------------------------------------------------------- escalation timing */

test("the escalation setting defaults to 15 minutes, in EN and AR, and is bounded", () => {
  assert.equal(ESCALATE_AFTER_MINUTES_DEFAULT, 15);
  assert.deepEqual(SETTINGS_DEFAULTS.crisis, { escalateAfterMinutes: 15 });
  assert.deepEqual(parseGroup("crisis", undefined), { escalateAfterMinutes: 15 });
  assert.deepEqual(parseGroup("crisis", { escalateAfterMinutes: 5 }), { escalateAfterMinutes: 5 });
  /* A stored value out of range reads as the default, as every other setting does. */
  assert.deepEqual(parseGroup("crisis", { escalateAfterMinutes: 0 }), { escalateAfterMinutes: 15 });
  assert.equal(escalationMinutes("x"), 15);
  assert.equal(escalationMinutes(10_000), 240);
  for (const key of ["acrisis.title", "acrisis.escalateAfter", "acrisis.hint"] as const) {
    assert.ok(en[key] && /[؀-ۿ]/.test(ar[key]), `${key} in both languages`);
  }
});

test("🔴 an unacknowledged alert escalates exactly when its minutes are up, not before", () => {
  const row = { acknowledgedAt: null, escalationStage: 0, escalateAt: escalateAtFor(T0, 15) };
  assert.equal(row.escalateAt.toISOString(), at(15).toISOString());
  assert.equal(nextEscalation(row, { now: at(14), inClinic: false, minutes: 15 }), null, "a minute early");
  assert.deepEqual(nextEscalation(row, { now: at(15), inClinic: false, minutes: 15 }), {
    audience: "platform",
    nextStage: FINAL_STAGE,
    nextEscalateAt: null,
  });
});

test("🔴 a clinic's alert goes to the clinic first, then the platform after as long again", () => {
  const row = { acknowledgedAt: null, escalationStage: 0, escalateAt: at(15) };
  const first = nextEscalation(row, { now: at(15), inClinic: true, minutes: 15 });
  assert.deepEqual(first, { audience: "clinic", nextStage: 1, nextEscalateAt: at(30) });
  const later = { acknowledgedAt: null, escalationStage: 1, escalateAt: first!.nextEscalateAt };
  assert.equal(nextEscalation(later, { now: at(29), inClinic: true, minutes: 15 }), null);
  assert.deepEqual(nextEscalation(later, { now: at(30), inClinic: true, minutes: 15 }), {
    audience: "platform",
    nextStage: 2,
    nextEscalateAt: null,
  });
  /* The platform is the last stage. */
  assert.equal(nextEscalation({ acknowledgedAt: null, escalationStage: 2, escalateAt: at(30) }, { now: at(90), inClinic: true, minutes: 15 }), null);
});

test("🔴 an acknowledgement stops the escalation at every stage", () => {
  for (const stage of [0, 1]) {
    const acked = { acknowledgedAt: at(3), escalationStage: stage, escalateAt: at(15) };
    assert.equal(nextEscalation(acked, { now: at(60), inClinic: true, minutes: 15 }), null, `stage ${stage}`);
  }
  /* And the tick stops waking for it. */
  assert.equal(
    crisisDueAt([{ acknowledgedAt: at(3), escalationStage: 0, escalateAt: at(15), outOfBandAt: null, outOfBandAttempts: 2 }], at(4)),
    null,
  );
  /* Control: the same row unacknowledged is due at its deadline. */
  assert.equal(
    crisisDueAt([{ acknowledgedAt: null, escalationStage: 0, escalateAt: at(15), outOfBandAt: at(0), outOfBandAttempts: 1 }], at(4))?.toISOString(),
    at(15).toISOString(),
  );
});

test("a row from before 0185 (no deadline, no attempt) is never escalated or sent", () => {
  const old = { acknowledgedAt: null, escalationStage: 0, escalateAt: null, outOfBandAt: null, outOfBandAttempts: 0 };
  assert.equal(nextEscalation(old, { now: at(1000), inClinic: true, minutes: 15 }), null);
  assert.equal(needsOutOfBandRetry(old), false);
  assert.equal(crisisDueAt([old], at(1000)), null);
});

test("a send that did not leave is retried at the next tick, a bounded number of times", () => {
  const failed = { acknowledgedAt: null, escalationStage: 0, escalateAt: at(15), outOfBandAt: null, outOfBandAttempts: 1 };
  assert.equal(needsOutOfBandRetry(failed), true);
  assert.equal(crisisDueAt([failed], at(1))?.toISOString(), at(1).toISOString(), "due now");
  assert.equal(needsOutOfBandRetry({ ...failed, outOfBandAttempts: MAX_OUT_OF_BAND_ATTEMPTS }), false);
  assert.equal(needsOutOfBandRetry({ ...failed, outOfBandAt: at(0) }), false, "it left");
});

test("🔴 who may acknowledge: the clinician, a clinician in the practice, the platform on-call; nobody else", () => {
  const alert = { therapistId: "t1", organizationId: "o1" };
  assert.equal(mayAcknowledge(alert, { userId: "t1", organizationId: "o1", role: "therapist" }), true);
  assert.equal(mayAcknowledge(alert, { userId: "t2", organizationId: "o1", role: "therapist" }), true);
  assert.equal(mayAcknowledge(alert, { userId: "a1", organizationId: "o9", role: "super_admin" }), true);
  assert.equal(mayAcknowledge(alert, { userId: "m1", organizationId: "o9", role: "manager" }), true);
  assert.deepEqual([...ON_CALL_ROLES], ["manager", "super_admin"]);
  /* Due diligence: any back-office user could acknowledge, which stops all escalation. */
  assert.equal(mayAcknowledge(alert, { userId: "s1", organizationId: "o9", role: "staff" }), false, "staff are never told");
  assert.equal(mayAcknowledge(alert, { userId: "s2", organizationId: "o1", role: "staff" }), false, "same practice, not a clinician");
  assert.equal(mayAcknowledge(alert, { userId: "t3", organizationId: "o2", role: "therapist" }), false);
  /* A journal alert nobody holds a grant to: only the on-call. */
  const orphan = { therapistId: null, organizationId: null };
  assert.equal(mayAcknowledge(orphan, { userId: "a1", organizationId: "o9", role: "super_admin" }), true);
  assert.equal(mayAcknowledge(orphan, { userId: "t1", organizationId: "o1", role: "therapist" }), false);
  assert.equal(mayAcknowledge(orphan, { userId: "s1", organizationId: "o9", role: "staff" }), false);
});

test("🔴 retries spent: the alert escalates now, never just stops", () => {
  const spent = {
    acknowledgedAt: null,
    escalationStage: 0,
    escalateAt: at(15),
    outOfBandAt: null,
    outOfBandAttempts: MAX_OUT_OF_BAND_ATTEMPTS,
  };
  assert.equal(needsOutOfBandRetry(spent), false, "no more retries");
  assert.equal(outOfBandExhausted(spent), true);
  /* The deadline is pulled to now, and the tick then escalates it to the next stage. */
  const pulled = escalateNowIfExhausted(spent, at(5));
  assert.equal(pulled?.toISOString(), at(5).toISOString());
  assert.deepEqual(nextEscalation({ ...spent, escalateAt: pulled }, { now: at(5), inClinic: true, minutes: 15 }), {
    audience: "clinic",
    nextStage: 1,
    nextEscalateAt: at(20),
  });
  assert.equal(crisisDueAt([spent], at(5))?.toISOString(), at(5).toISOString(), "the tick wakes now");
  /*
   * Review: once the clinic has been told (stage 1), its own deadline stands:
   * spent sends to the clinician no longer pull it forward or wake the tick,
   * and it goes on to the platform when that deadline comes.
   */
  const stage1 = { ...spent, escalationStage: 1, escalateAt: at(30) };
  assert.equal(outOfBandExhausted(stage1), false);
  assert.equal(escalateNowIfExhausted(stage1, at(16)), null);
  assert.equal(crisisDueAt([stage1], at(16))?.toISOString(), at(30).toISOString());
  assert.equal(nextEscalation(stage1, { now: at(30), inClinic: true, minutes: 15 })?.audience, "platform");

  /* Controls: nothing to do once it left, once acknowledged, once already due, or at the last stage. */
  assert.equal(escalateNowIfExhausted({ ...spent, outOfBandAt: at(1) }, at(5)), null);
  assert.equal(escalateNowIfExhausted({ ...spent, acknowledgedAt: at(1) }, at(5)), null);
  assert.equal(escalateNowIfExhausted({ ...spent, escalateAt: at(2) }, at(5)), null, "already due");
  assert.equal(escalateNowIfExhausted({ ...spent, escalationStage: FINAL_STAGE, escalateAt: null }, at(5)), null);
  assert.equal(escalateNowIfExhausted({ ...spent, outOfBandAttempts: MAX_OUT_OF_BAND_ATTEMPTS - 1 }, at(5)), null, "retries left");
  assert.equal(crisisDueAt([{ ...spent, escalationStage: FINAL_STAGE, escalateAt: null }], at(5)), null);
});

test("🔴 the pipeline pulls a spent alert forward, records the failure, and a journal raises the same alert", () => {
  const alerts = readFileSync("lib/crisis/alerts.ts", "utf8");
  const send = alerts.slice(alerts.indexOf("async function sendOutOfBand"), alerts.indexOf("async function afterFailedSend"));
  assert.match(send, /if \(!delivery\.sent\) await afterFailedSend\(riskId, rdb\)/);
  const after = alerts.slice(alerts.indexOf("async function afterFailedSend"), alerts.indexOf("type Backup"));
  assert.match(after, /escalateNowIfExhausted\(row, now\)/);
  assert.match(after, /recordCrisisFailure\(/);
  assert.match(alerts, /import\("@\/lib\/observability\/errors"\)/, "failures reach /admin/errors");
  const tick = alerts.slice(alerts.indexOf("export async function escalateCrisisAlerts"), alerts.indexOf("export async function nextCrisisDueAt"));
  assert.ok(tick.indexOf("afterFailedSend(row.id, rdb, now)") < tick.indexOf("const due = await rdb"), "spent alerts are pulled forward before the due read");
  /* Review: only alerts still with the clinician (stage 0) are pulled forward. */
  const spentRead = tick.slice(tick.indexOf("const spent = await rdb"), tick.indexOf("const due = await rdb"));
  assert.match(spentRead, /eq\(riskAssessments\.escalationStage, 0\)/);
  /* Review: every region's alerts, and a journal alert written where the journal is. */
  assert.match(tick, /acrossRegions\(/);
  const journals = readFileSync("lib/data/journals.ts", "utf8");
  assert.match(journals, /raiseCrisisAlert\(\{ \.\.\.shared, journal, therapistId: null/, "no grant: the platform on-call");
  assert.match(journals, /therapistId: holder\.userId/);
  assert.doesNotMatch(journals, /insert\(notifications\)/, "no parallel in-app-only path");
  const raise = alerts.slice(alerts.indexOf("export async function raiseCrisisAlert"), alerts.indexOf("function alertPath"));
  assert.match(raise, /if \(noClinician\) \{\s*await tellPlatformNow\(riskId, now, rdb\)/);
  assert.match(raise, /const rdb: Db = opts\.region \? dbFor\(opts\.region\) : db/);
  assert.match(journals, /indicators, region \}/, "a journal alert carries the person's region");
  assert.match(journals, /if \(raised === 0\) \{\s*await raiseCrisisAlert\(\{ \.\.\.shared, journal, therapistId: null/, "every clinician insert failed: the platform on-call");
});

test("🔴 a patient who paused AI is not transcribed, and the room and the record say live risk detection is off", () => {
  const route = readFileSync("app/api/sessions/[id]/transcribe/route.ts", "utf8");
  const paused = route.slice(route.indexOf("if (await aiPausedForPatient(session.patientId))"));
  assert.ok(paused.indexOf("await markLiveRiskOff(session.id)") < paused.indexOf('error: "ai_paused"'), "recorded, then refused");
  assert.ok(paused.indexOf('error: "ai_paused"') < paused.indexOf("transcribeChunk("), "refused before any audio is sent");
  const room = readFileSync("components/session/session-room.tsx", "utf8");
  assert.match(room, /refused\?\.error === "ai_paused"\) setLiveRiskOff\(true\)/, "a mid-session pause shows at once");
  assert.match(room, /\{liveRiskOff \|\| adultRefused \? \(/);
  /* Review: a chunk refused for an unconfirmed adult is not scanned either, and says so. */
  const adult = route.slice(route.indexOf("if (!(await adultConfirmedForSession(sessionId)))"));
  assert.ok(adult.indexOf("await markLiveRiskOff(session.id)") < adult.indexOf('error: "adult_unconfirmed"'), "recorded, then refused");
  assert.match(room, /refused\?\.error === "adult_unconfirmed"\) setAdultRefused\(true\)/);
  assert.match(readFileSync("app/(room)/sessions/[id]/room/page.tsx", "utf8"), /liveRiskOff=\{row\.session\.liveRiskOffAt !== null \|\|/);
  assert.match(readFileSync("app/(app)/sessions/[id]/page.tsx", "utf8"), /row\.session\.liveRiskOffAt \?/);
  assert.match(readFileSync("app/(app)/sessions/actions.ts", "utf8"), /markLiveRiskOffIfPaused\(sessionId\)/, "recorded at the start too");
  for (const key of ["troom.liveRiskOff", "troom.liveRiskOffBody", "troom.liveRiskOffAdultBody", "portal.session.liveRiskOff"] as const) {
    assert.ok(en[key] && /[؀-ۿ]/.test(ar[key]), `${key} in both languages`);
  }
  assert.match(en["portal.session.aiPaused"], /no live risk detection/);
});

test("🔴 claim 23: nothing calls the radar a crisis service or promises an answer", () => {
  const crisisRadar = /crisis radar|رادار الأزمات|talk to a therapist now/i;
  for (const [key, value] of Object.entries(en)) assert.doesNotMatch(value, crisisRadar, `en ${key}`);
  for (const [key, value] of Object.entries(ar)) assert.doesNotMatch(value, crisisRadar, `ar ${key}`);
  assert.doesNotMatch(readFileSync("lib/content/defaults.ts", "utf8"), /Crisis Radar|رادار الأزمات/);
  assert.doesNotMatch(readFileSync("lib/content/defaults-ar.ts", "utf8"), /رادار الأزم/);
  assert.equal(en["radar.pageTitle"], "Radar: see who is free to talk now");
  assert.match(en["radar.metaDescription"], /not an emergency service/);
  assert.match(ar["radar.metaDescription"], /ليست خدمة طوارئ/);
  const radar = readFileSync("app/(public)/radar/page.tsx", "utf8");
  assert.match(radar, /title: t\("radar\.pageTitle"\), description: t\("radar\.metaDescription"\)/);
  /* Control: the pattern does match the old title. */
  assert.match("Crisis Radar, talk to a therapist now", crisisRadar);
});

/* ---------------------------------------------------- the upgrade, not deduped */

test("🔴 a higher level inside the window upgrades and notifies again; the same or lower is deduped", () => {
  assert.equal(dedupDecision(null, "high"), "insert");
  assert.equal(dedupDecision("high", "critical"), "upgrade", "the AI's critical after the keyword's high");
  assert.equal(dedupDecision("elevated", "high"), "upgrade");
  assert.equal(dedupDecision("high", "high"), "skip");
  assert.equal(dedupDecision("critical", "high"), "skip");

  /* And the pipeline uses it: the only early return is a skip, and an upgrade reaches the notification. */
  const alerts = readFileSync("lib/crisis/alerts.ts", "utf8");
  const raise = alerts.slice(alerts.indexOf("export async function raiseCrisisAlert"), alerts.indexOf("function alertPath"));
  assert.match(raise, /dedupDecision\(recent\?\.level \?\? null, opts\.level\)/);
  assert.match(raise, /if \(decision === "skip" && recent\)/);
  assert.ok(raise.indexOf('decision === "upgrade"') < raise.indexOf("insert(notifications)"), "upgrade, then notify");
  assert.ok(raise.indexOf("insert(notifications)") < raise.indexOf("sendOutOfBand(riskId"), "in-app, then out of band");
  assert.match(raise, /acknowledgedAt: null,/, "an upgrade clears the acknowledgement of the lower level");
});

/* -------------------------------------------------------- the tick wakes for it */

const fresh = (extra: Partial<ReminderMarker> = {}): ReminderMarker => ({
  nextAt: null,
  writtenAt: new Date(T0.getTime() - 10 * 60_000).toISOString(),
  ...extra,
});

test("🔴 the tick runs for a due crisis alert, and still sleeps when nothing is due", () => {
  const T = new Date("2026-10-01T22:07:00Z");
  assert.deepEqual(tickDecision(fresh(), T), { run: false, reason: "idle" });
  assert.deepEqual(tickDecision(fresh({ crisisDueAt: "2026-10-01T22:15:00.000Z" }), T), { run: false, reason: "idle" }, "not yet due");
  assert.deepEqual(tickDecision(fresh({ crisisDueAt: "2026-10-01T22:07:00.000Z" }), T), { run: true, reason: "crisis" });
  assert.deepEqual(tickDecision(fresh({ crisisDueAt: "2026-10-01T21:00:00.000Z" }), T), { run: true, reason: "crisis" });
});

test("the marker carries crisisDueAt only while an alert is open, and old markers still parse", () => {
  assert.deepEqual(parseMarker('{"nextAt":null,"writtenAt":"2026-10-01T22:00:00.000Z"}'), {
    nextAt: null,
    writtenAt: "2026-10-01T22:00:00.000Z",
  });
  const three = '{"nextAt":null,"writtenAt":"2026-10-01T22:00:00.000Z","crisisDueAt":"2026-10-01T22:15:00.000Z"}';
  assert.deepEqual(parseMarker(three), {
    nextAt: null,
    writtenAt: "2026-10-01T22:00:00.000Z",
    crisisDueAt: "2026-10-01T22:15:00.000Z",
  });
  assert.equal(parseMarker('{"nextAt":null,"writtenAt":"2026-10-01T22:00:00.000Z","crisisDueAt":"soon"}'), null);
  assert.equal(parseMarker('{"nextAt":null,"writtenAt":"2026-10-01T22:00:00.000Z","crisisDueAt":null}'), null);
  assert.equal(parseMarker(serializeMarker(parseMarker(three)!)) !== null, true);
  assert.deepEqual(Object.keys(JSON.parse(serializeMarker(markerFrom(null, T0)))), ["nextAt", "writtenAt"]);
  assert.equal(markerFrom(null, T0, at(15)).crisisDueAt, at(15).toISOString());
});

test("an alert lowers crisisDueAt without the database; a booking keeps it; nothing raises it", () => {
  const held = fresh({ crisisDueAt: at(15).toISOString() });
  assert.deepEqual(lowerCrisisDue(fresh(), at(15)), { ...fresh(), crisisDueAt: at(15).toISOString() });
  assert.equal(lowerCrisisDue(held, at(20)), null, "later than held");
  assert.equal(lowerCrisisDue(held, at(5))?.crisisDueAt, at(5).toISOString());
  /* A retry due now (in the past by the time the tick reads it) is written: it means the next tick. */
  assert.equal(lowerCrisisDue(held, at(-1))?.crisisDueAt, at(-1).toISOString());
  assert.equal(lowerMarker(held, at(90), T0)?.crisisDueAt, held.crisisDueAt);
});

test("🔴 the tick escalates before the reminders, a refresh reads the crisis work, and an alert lowers the marker", () => {
  const route = readFileSync("app/api/cron/[job]/route.ts", "utf8");
  const tick = route.slice(route.indexOf("async tick()"));
  assert.ok(tick.indexOf("await tickGate()") < tick.indexOf('step(failed, "escalateCrisisAlerts"'));
  assert.ok(tick.indexOf('step(failed, "escalateCrisisAlerts"') < tick.indexOf("sweepSessionReminders()"));
  const crisisJob = route.slice(route.indexOf("async crisis()"), route.indexOf("async tick()"));
  assert.match(crisisJob, /step\(failed, "escalateCrisisAlerts", \(\) => escalateCrisisAlerts\(\)\)/, "hourly backstop");
  const data = readFileSync("lib/data/reminder-marker.ts", "utf8");
  assert.match(data, /markerFrom\(await nextReminderAt\(now\), now, await nextCrisisDueAt\(now\)\)/);
  assert.match(data, /export async function noteCrisisDue[\s\S]*lowerCrisisDue\(read\.marker, dueAt\)[\s\S]*writeMarkerBlob\(markerPath\(\), serializeMarker\(lowered\), read\.etag\)/);
  const alerts = readFileSync("lib/crisis/alerts.ts", "utf8");
  assert.match(alerts, /await wakeTheTickAt\(sent \? escalateAt : now\)/);
  /* Acknowledging refreshes the marker, so the tick stops waking for it. */
  const ack = alerts.slice(alerts.indexOf("export async function acknowledgeCrisisAlert"));
  assert.match(ack, /escalateAt: null/);
  assert.match(ack, /await refreshReminderMarker\(\)/);
  /* The acknowledgement is a POST from a signed-in page, never a GET a mail scanner could follow. */
  const action = readFileSync("app/(app)/notifications/alerts/[id]/actions.ts", "utf8");
  assert.match(action, /"use server"/);
  assert.match(action, /await requireUser\(\)/);
});

test("the out-of-band message carries no patient detail, in both languages, and has a WhatsApp template", async () => {
  for (const key of ["calert.subject", "calert.body", "calert.escBody", "calert.escBodyManager"] as const) {
    assert.ok(/[؀-ۿ]/.test(ar[key]), `${key} has Arabic`);
    assert.doesNotMatch(en[key], /\{(patient|name|words|indicator)/);
  }
  const { WHATSAPP_TEMPLATES } = await import("../lib/notify/templates");
  assert.equal(WHATSAPP_TEMPLATES["crisis.alert"].name, "crisis_alert");
  assert.equal(WHATSAPP_TEMPLATES["crisis.escalated"].variables, 1);
});

/* ------------------------------------------------- the truthful patient message */

test("🔴 the patient is told their therapist was notified only when one was", () => {
  const told = patientFacingCrisisMessage("US", null, T0, { notified: true, locale: "en" });
  assert.match(told.message, /^We have told your therapist\./);
  const notTold = patientFacingCrisisMessage("US", null, T0, { notified: false, locale: "en" });
  assert.doesNotMatch(notTold.message, /told your therapist|has been notified/);
  assert.match(notTold.message, /No therapist has been told/);
  assert.ok(notTold.message.includes("988"));
  /* The default is the truthful one: nobody claims a notification nobody made. */
  assert.doesNotMatch(patientFacingCrisisMessage().message, /told your therapist|has been notified|here with you/);
});

test("🔴 in the patient's language, with Egypt's support lines and an always-open number", () => {
  const fridayNight = new Date("2026-09-25T20:00:00Z");
  const arabic = patientFacingCrisisMessage("EG", null, fridayNight, { notified: true, locale: "ar" });
  assert.match(arabic.message, /^أبلغنا معالجك\./);
  assert.ok(arabic.message.includes("123") && arabic.message.includes("0800 888 0700"), arabic.message);
  assert.doesNotMatch(arabic.message, /[A-Za-z]{3,}/, "no English words in the Arabic message");
  const english = patientFacingCrisisMessage("EG", null, fridayNight, { notified: false, locale: "en" });
  assert.ok(english.message.includes("Mental health support lines: 0800 888 0700, 02 2081 6831."), english.message);
  assert.deepEqual(Object.keys(arabic).sort(), ["helpline", "message"]);
});

/* ------------------------------------------------------------ the SOS sheet */

test("🔴 F5 Egypt's SOS sheet carries the General Secretariat lines as mental health support, and 105 is not 'نجدة'", () => {
  const entries = sosLinesFor({ country: "EG", now: new Date("2026-09-21T12:00:00Z") });
  const tels = entries.map((e) => e.line.tel);
  for (const tel of ["08008880700", "0220816831", "105", "123", "112"]) assert.ok(tels.includes(tel), tel);
  const support = entries.filter((e) => e.line.tel === "08008880700" || e.line.tel === "0220816831");
  for (const entry of support) {
    assert.equal(entry.line.name?.en, "Mental health support");
    assert.equal(entry.open, null, "no source gives their hours, so neither open nor closed");
  }
  const moh = entries.find((e) => e.line.tel === "105")!;
  assert.equal(moh.line.name?.en, "Health ministry hotline");
  assert.doesNotMatch(JSON.stringify(entries), /نجدة/);
  assert.doesNotMatch(readFileSync("components/patient/sos-orb.tsx", "utf8"), /نجدة/);
});

test("🔴 F5 the no-JS SOS page is server HTML with a tel: link for every line, linked from the orb and the site", async () => {
  const React = await import("react");
  const { createElement } = React;
  /* tsconfig keeps JSX as `preserve` for Next, so tsx compiles it to the classic runtime. */
  (globalThis as { React?: unknown }).React = React;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SosList } = await import("../components/crisis/sos-list");
  const entries = sosLinesFor({ country: "EG", now: new Date("2026-09-25T20:00:00Z") });
  const html = renderToStaticMarkup(
    createElement(SosList, {
      entries,
      locale: "ar",
      words: { helpLine: "خط المساعدة", anyTime: "في أي وقت", openNow: "مفتوح", closedNow: "مغلق", checkHours: "تأكد من المواعيد" },
    }),
  );
  /* Due diligence: unconfirmed hours (105, the support lines) say "check hours", never open or closed. */
  assert.ok(html.includes("تأكد من المواعيد"));
  assert.ok(!html.includes("مغلق"), "nothing is called closed on hours nobody confirmed");
  for (const tel of ["123", "112", "08008880700", "0220816831", "105"]) {
    assert.ok(html.includes(`href="tel:${tel}"`), `tel:${tel} in the HTML`);
  }
  assert.ok(html.includes("دعم الصحة النفسية"));

  const page = readFileSync("app/sos/page.tsx", "utf8");
  assert.doesNotMatch(page, /"use client"/);
  /* Due diligence: the page says plainly that 24Therapy is not an emergency service, in both languages. */
  assert.match(page, /t\("sos\.notEmergency"\)/);
  assert.match(en["sos.notEmergency"], /^24Therapy is not an emergency service\./);
  assert.match(ar["sos.notEmergency"], /ليست خدمة طوارئ/);
  /* And "works with no SIM" is gone: without a SIM most networks connect only 112. */
  assert.doesNotMatch(en["crisis.anywhereElse"], /SIM/);
  assert.doesNotMatch(ar["crisis.anywhereElse"], /شريحة/);
  assert.match(page, /<SosList\b/);
  assert.doesNotMatch(readFileSync("components/crisis/sos-list.tsx", "utf8"), /"use client"|useState|onClick/);
  /* Reachable with scripts off: the orb's noscript, and the public footer. */
  assert.match(readFileSync("components/patient/sos-orb.tsx", "utf8"), /<noscript>[\s\S]*href="\/sos"/);
  assert.match(readFileSync("components/public/site-chrome.tsx", "utf8"), /<a href="\/sos"/);
});

test("🔴 Review: break-glass for the platform on-call on a journal alert, audited", () => {
  const action = readFileSync("app/(app)/notifications/alerts/[id]/actions.ts", "utf8");
  const reveal = action.slice(action.indexOf("export async function revealCrisisContact"));
  assert.ok(reveal.indexOf("reasonProblem(why)") < reveal.indexOf("await audit("), "a reason before anything");
  assert.ok(reveal.indexOf("alert.breakGlass") < reveal.indexOf("await audit("), "only an alert that allows it");
  assert.match(reveal, /category: "phi_access",\s*action: "break_glass\.crisis_contact"/);
  const page = readFileSync("app/(app)/notifications/alerts/[id]/page.tsx", "utf8");
  assert.ok(page.indexOf("crisisContactGrantHolds(") < page.indexOf("crisisContactForOnCall("), "the audit row is checked before the read");
  assert.match(page, /href="\/sos"/);
  const alerts = readFileSync("lib/crisis/alerts.ts", "utf8");
  const read = alerts.slice(alerts.indexOf("export async function crisisContactForOnCall"));
  assert.match(read, /!mayAcknowledge\(found\.row, actor\) \|\| !mayBreakGlass\(found\.row, actor\)/);
  const may = alerts.slice(alerts.indexOf("export function mayBreakGlass"), alerts.indexOf("export async function alertForViewer"));
  assert.match(may, /ON_CALL_ROLES/);
  assert.match(may, /alert\.therapistId === null \|\| alert\.escalationStage >= FINAL_STAGE/);
  for (const key of ["calert.bgTitle", "calert.bgIntro", "calert.bgReveal", "calert.bgExcerpt", "calert.bgSos", "calert.bgSosLink"] as const) {
    assert.ok(en[key] && /[؀-ۿ]/.test(ar[key]), `${key} in both languages`);
  }
});

test("🔴 Review: alert history outlives the journal, and every alert is seen", () => {
  const sql = readFileSync("drizzle/0194_alert_history_outlives_the_journal.sql", "utf8");
  assert.match(sql, /REFERENCES "journals"\("id"\) ON DELETE SET NULL/);
  assert.match(sql, /REFERENCES "people"\("id"\) ON DELETE SET NULL/);
  assert.match(sql, /"session_id" IS NOT NULL OR "person_id" IS NOT NULL OR "journal_ref" IS NOT NULL/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /CASCADE/);
  /* The admin feed shows an alert with no clinician. */
  assert.match(readFileSync("lib/console/reads.ts", "utf8"), /FROM risk_assessments r\s*(?:--[^\n]*\n\s*)*LEFT JOIN users u ON u\.id = r\.therapist_id/);
  /* A journal alert (no session) counts as prior risk. */
  assert.match(
    readFileSync("lib/data/session-risk.ts", "utf8"),
    /or\(isNull\(riskAssessments\.sessionId\), ne\(riskAssessments\.sessionId, sessionId\)\)/,
  );
  /* The cross-chunk join reads the same speaker's last segment. */
  assert.match(readFileSync("lib/data/transcript.ts", "utf8"), /eq\(transcriptSegments\.speaker, input\.speaker\)/);
});
