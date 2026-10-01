import assert from "node:assert/strict";
import { test } from "node:test";

import { FLOOR_CASES, RISK_CASES } from "../evals/cases";
import { risk } from "../evals/suites/risk";
import { CRISIS_PATTERNS, scanForCrisisLanguage } from "../lib/crisis/alerts";
import { firstPersonIn, lastClause, stillCounts } from "../lib/crisis/context";
import { containsWords, fold } from "../lib/crisis/fold";
import { isQuestionToOther, scanLiveChunk, tailOf } from "../lib/crisis/live";

/**
 * The crisis keyword floor, DD-2. No database, no network.
 *
 * Every sentence the due diligence found silenced or missed must alert, the
 * near misses beside them must stay quiet, and the whole eval case set is
 * checked here too, so "evals gate nothing" stops being true for the one eval
 * that is pure code.
 */

const alerts = (text: string) => scanForCrisisLanguage(text).length > 0;

test("🔴 DD-2 every sentence from the report raises an alert", () => {
  for (const text of [
    "السكينة قدامي وعايز اموت",
    "زوجي ضربني وعايزة اموت",
    "I used to cope but I no longer can, I want to die",
    "I wanna die",
    "I'm going to hang myself",
    "I want to take my life",
    "I want to take my own life",
    "هشنق نفسي",
    "3ayez amut",
    "وهنتحر",
    "فهنتحر",
    "انا هنتحر",
    "انا تعبت وهنتحر النهارده",
  ]) {
    assert.ok(alerts(text), `should alert: "${text}"`);
  }
});

test("DD-2 the added phrase classes, in all four registers", () => {
  for (const text of [
    "wanna die tbh",
    "I wanted to die last night",
    "I don't want to wake up tomorrow",
    "I don’t want to be alive",
    "I just want to end it all",
    "honestly ending it all feels close",
    "I keep thinking I would rather be dead",
    "I thought about slitting... no, I thought I would slit my wrists",
    "انا عايز اموت",
    "عايزة أموت",
    "يا رب اموت وارتاح",
    "الموت ارحم من كده",
    "ياريتني مت وانا صغير",
    "هموت نفسي",
    "وهموت نفسي",
    "هقتل نفسي",
    "مبقتش عايز اعيش",
    "ana 3ayez amoot",
    "3ayza amoot",
    "ana 3ayza amut",
    "hamawet nafsy",
    "hantehar",
    "ana hant7r",
    "ya rab amoot",
  ]) {
    assert.ok(alerts(text), `should alert: "${text}"`);
  }
});

test("DD-2 the near misses stay quiet", () => {
  for (const text of [
    "My friend's mother died last year.",
    "أخويا كان عايز يموت من الضحك",
    "I wanna diet before the wedding",
    "I want to take my life back from this anxiety",
    "هنتحرك بكرة الصبح",
    "إحنا هنتحرك دلوقتي",
    "I ran 5 kms this morning",
    "Two years ago I wanted to die. That is over and it has not come back.",
    "My brother took an overdose in 2019.",
    "أخي انتحر من سنتين.",
  ]) {
    assert.deepEqual(scanForCrisisLanguage(text), [], `should be quiet: "${text}"`);
  }
});

test("🔴 RULING: a past wish with 'now' in it alerts, because 'now' is the present", () => {
  // "Two years ago I wanted to die, now I'm fine." A clinician reads one line;
  // the guard cannot tell "now I'm fine" from "now it is back". A proposed ruling, for clinician review.
  assert.ok(alerts("Two years ago I wanted to die, now I'm fine"));
});

/* ------------------------------------------------------------- the guard -- */

test("🔴 an Arabic family word is a whole word: 'قدامي' is not 'امي'", () => {
  assert.equal(containsWords("السكينه قدامي", "امي"), false);
  assert.equal(containsWords("كلمت امي امبارح", "امي"), true);
  // The clitics: "and my mother", "to my mother", "with my brother".
  assert.equal(containsWords("وامي زعلانه", "امي"), true);
  assert.equal(containsWords("قلت لامي", "امي"), true);
  assert.equal(containsWords("وكنت بفكر", "كنت"), true);
  assert.equal(containsWords("امكنتني", "كنت"), false);
});

test("🔴 the first-person override works in Arabic", () => {
  assert.equal(firstPersonIn("زوجي ضربني وانا "), true);
  assert.equal(firstPersonIn("وأنا "), true);
  assert.equal(firstPersonIn("زوجي ضربني "), false);
  assert.ok(alerts("زوجي ضربني وانا بفكر في الانتحار"));
  assert.ok(alerts("اخويا قالي وانا خلاص عايز انتحر"));
});

test("a relative suppresses only in the phrase's own clause, and only a phrase that names nobody", () => {
  assert.equal(lastClause("my mum visited, and honestly "), " honestly ");
  assert.ok(alerts("My mum visited, and honestly suicide is on my mind"));
  // First-person phrases are the speaker's whoever else is in the sentence.
  assert.ok(alerts("My brother hit me and I want to kill myself"));
  assert.ok(alerts("My sister says I am a burden on my family"));
  // A neutral phrase straight after a relative is still about the relative.
  assert.deepEqual(scanForCrisisLanguage("My sister took an overdose last year."), []);
});

test("🔴 'no longer' and 'used to' are not resolved when an inability follows", () => {
  assert.ok(alerts("I used to cope but I no longer can, I want to die"));
  assert.ok(alerts("I used to manage. I can't any more, I want to die."));
  assert.ok(alerts("كنت بستحمل بس مبقتش قادر، عايز اموت"));
  assert.ok(alerts("كنت بستحمل لكن ما عدت اقدر اكمل"));
  // The resolution has to come after the phrase, not before it.
  assert.ok(alerts("That is over, years ago I was fine, I want to die"));
  // A real resolution still resolves.
  assert.equal(stillCounts("When I was nineteen I used to cut myself. That is over and it has not come back.", "cut myself"), false);
});

test("🔴 the af5343f pattern: clitics in front, 'we will get moving' never", () => {
  const pattern = CRISIS_PATTERNS.find((p) => p.label === "هنتحر");
  assert.ok(pattern);
  for (const yes of ["هنتحر", "وهنتحر", "فهنتحر", "انا هنتحر", "حنتحر", "هننتحر"]) {
    assert.ok(pattern.re.test(fold(yes)), yes);
  }
  for (const no of ["هنتحرك", "وهنتحرك", "حنتحرك"]) {
    assert.equal(pattern.re.test(fold(no)), false, no);
  }
});

/* ------------------------------------------------------ the live session -- */

test("🔴 a therapist's question is not a disclosure", () => {
  assert.deepEqual(scanLiveChunk({ text: "Any thoughts of suicide this week?", speaker: "therapist" }), []);
  for (const text of [
    "Do you have thoughts of suicide?",
    "do you have thoughts of suicide",
    "Have you ever wanted to kill yourself or thought about suicide?",
    "هل عندك افكار انتحار؟",
    "هل عندك أفكار انتحار",
  ]) {
    assert.ok(isQuestionToOther(text), text);
    assert.deepEqual(scanLiveChunk({ text, speaker: "unknown" }), [], text);
  }
});

test("…but a question with the speaker in it, or a labelled patient, is scanned", () => {
  assert.equal(isQuestionToOther("Do you think I want to die?"), false);
  assert.ok(scanLiveChunk({ text: "Do you think I want to die?", speaker: "unknown" }).length > 0);
  assert.ok(scanLiveChunk({ text: "I want to die.", speaker: "unknown" }).length > 0);
  assert.ok(scanLiveChunk({ text: "Do you know I think about suicide a lot", speaker: "patient" }).length > 0);
  assert.ok(
    scanLiveChunk({ text: "Do you have thoughts of suicide? I do, every night, I want to die.", speaker: "unknown" })
      .length > 0,
  );
});

test("🔴 a phrase cut across the eight-second boundary is caught", () => {
  const previous = { text: "Honestly most nights I just want to", speaker: "patient" as const };
  assert.deepEqual(scanLiveChunk({ text: "die and be done with it", speaker: "patient", previous }), ["want to die"]);
  const ar = { text: "انا تعبت جدا و عايز", speaker: "unknown" as const };
  assert.ok(scanLiveChunk({ text: "اموت بجد", speaker: "unknown", previous: ar }).length > 0);
});

test("…without raising the previous chunk's phrase again, or gluing two speakers together", () => {
  const said = { text: "I want to die.", speaker: "patient" as const };
  assert.deepEqual(scanLiveChunk({ text: "It has been a long week.", speaker: "patient", previous: said }), []);
  const asked = { text: "Do you ever want to", speaker: "therapist" as const };
  assert.deepEqual(scanLiveChunk({ text: "die? no, I am fine", speaker: "patient", previous: asked }), []);
  assert.equal(tailOf("a".repeat(10) + " " + "word ".repeat(30)).startsWith("word"), true);
});

/* --------------------------------------------------------- the eval, gated -- */

/*
 * The keyword misses and false alarms the eval set already names as known.
 * Written down so the list can only shrink on purpose: a new miss fails here.
 */
const KNOWN_MISSES = ["en-implicit-goodbye", "ar-no-meaning"];
const KNOWN_FALSE_ALARMS = ["en-news-overdose", "en-film-overdose", "arz-film"];

test("🔴 the eval's risk cases, gated in CI", () => {
  const missed = RISK_CASES.filter((c) => c.risk && !alerts(c.text)).map((c) => c.id);
  const falseAlarms = RISK_CASES.filter((c) => !c.risk && alerts(c.text)).map((c) => c.id);
  assert.deepEqual(missed, KNOWN_MISSES, "a true positive in evals/cases.ts stopped alerting");
  assert.deepEqual(falseAlarms, KNOWN_FALSE_ALARMS);
});

test("🔴 the DD-2 floor set is all right, and the eval suite reports it", () => {
  for (const c of FLOOR_CASES) {
    assert.equal(alerts(c.text), c.risk, `${c.id}: ${c.text}`);
  }
  const measured = Object.fromEntries(risk.run().map((m) => [m.key, m.value]));
  assert.equal(measured["risk.floor.sensitivity"], 1);
  assert.equal(measured["risk.floor.specificity"], 1);
});
