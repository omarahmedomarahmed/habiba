import "server-only";

import { stillCounts } from "@/lib/crisis/context";
import {
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
} from "@/lib/crisis/escalation";
import { contains, containsArabizi, fold } from "@/lib/crisis/fold";

import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { clinicManagers, notifications, organizations, riskAssessments, sessions, users } from "@/lib/db/schema";
import type { RiskLevel } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/crisis/alerts.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * The single crisis keyword list, and the single place it is applied.
 *
 * ## 🔴 Why this is not in `lib/ai/`, where it used to live (C137, C140)
 *
 * Nothing here calls a model. It is a list of phrases and an `includes`, plus
 * the write ordering that makes an alert durable. It sat under `lib/ai/`
 * because risk detection *sounds* like a model problem, and sprint 24.2 turned
 * that directory into a boundary a patient may not cross transitively. Sprint
 * 26 then needed exactly this scanner on the patient's own journal write, and
 * the choice was an exception or an honest filing. `lib/ai/` means "this talks
 * to a model"; this does not.
 *
 * **When sprint 35 gives risk a model**, the model call does not come back
 * here. It belongs in `lib/ai/` and runs from a background job reading the
 * row, never inside the request a patient is waiting on: that keeps the import
 * graph clean and, more to the point, keeps the property the graph is standing
 * in for, which is that a person writing at 3am is not waiting on an inference
 * call to find out whether their sentence saved. `raiseCrisisAlert` already
 * takes `source: "keyword" | "model"` for that day.
 *
 * The old codebase had four divergent lists, and the scan itself lived only in
 * the typed-segment path — the Whisper path used a different function that never
 * scanned at all. Since essentially every real session is audio, that meant
 * crisis detection was effectively off in production while the product page
 * advertised it. This module is imported by exactly one caller
 * (`appendTranscriptSegment`), so both paths cannot diverge again.
 */
const CRISIS_PHRASES = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "take my own life",
  "want to die",
  "wish i was dead",
  "wish i were dead",
  "better off dead",
  "suicidal",
  "suicide",
  "hurt myself",
  "hurting myself",
  // "harm myself" was missing from the first version of this list while
  // "hurt myself" and "self-harm" were present, so a patient using that exact
  // phrasing raised nothing. Phrasings a patient actually uses matter more here
  // than a tidy list.
  "harm myself",
  "harming myself",
  "cut myself",
  "cutting myself",
  "self harm",
  "self-harm",
  "overdose",
  "no reason to live",
  "nothing to live for",
  "not worth living",
  "end it all",
  "want it to end",
  "kill me",
  "cant go on",
  "can't go on",
  /* 32.1 — "I cannot go on like this" missed the list entirely: two
     contractions were here and the uncontracted form was not. */
  "cannot go on",
  /* 32.1 — the commonest indirect phrasing there is. Kept as the whole
     collocation, because bare "not wake up" matches "I did not wake up until
     ten" and a false alarm at 3am is how an alert stops being read. */
  "sleep and not wake up",
  "not wake up again",
  "never wake up",
  /*
   * 🔴 DD-2: the forms the due diligence found missing. "wanted to die" was
   * missing too: "want to die" is not inside it. "wanna die" and "take my
   * life" are patterns below, for their word edges.
   */
  "wanted to die",
  "want to be dead",
  "wanna be dead",
  "rather be dead",
  "don't want to wake up",
  "dont want to wake up",
  "do not want to wake up",
  "don't want to live",
  "dont want to live",
  "do not want to live",
  "no longer want to live",
  "don't want to be alive",
  "dont want to be alive",
  "do not want to be alive",
  "wish i was never born",
  "wish i had never been born",
  "hang myself",
  "hanging myself",
  "shoot myself",
  "slit my wrists",
  "cut my wrists",
  "jump off a bridge",
  "ending it all",
  /*
   * 🔴 Review: the phrase classes a probe of 121 sentences found missing.
   * Each is a concept (not being here, no point, an end, a plan or means), and
   * where a bare form is everyday speech the collocation is listed instead:
   * "disappear forever", not "disappear".
   */
  "killed myself",
  "want to be here anymore",
  "want to be here any more",
  "want to be around anymore",
  "want to exist anymore",
  "disappear forever",
  "disappear for good",
  "no point in living",
  "no point living",
  "no point to living",
  "no point in life",
  "no point in going on",
  "want it all to end",
  "want everything to end",
  "done with life",
  "done with living",
  "tired of living",
  "sick of living",
  "isn't worth living",
  "isnt worth living",
  "pills saved up",
  "saved up pills",
  "saving up pills",
  "stockpiling pills",
  "take all the pills",
  "take all of my pills",
  "took all the pills",
  "rope ready",
  "noose",
  /*
   * 🔴 32.x — perceived burdensomeness, which the list did not carry in EITHER
   * language until Arabic cases exposed the gap.
   *
   * "I am a burden on my family" is one of the most consistently reported
   * antecedents there is, and the English list had no phrase for it: the
   * Arabic misses were what made somebody look. Added in both languages, as a
   * concept rather than as a match for a test sentence, which is the line this
   * list has to keep. Collocated with a person, never bare: a cost, a project
   * and a rucksack are all burdens too.
   */
  "burden on my family",
  "burden to my family",
  "burden on everyone",
  "burden to everyone",
  "burden on my kids",
  "burden on my children",
  "better off without me",
  "hurt someone",
  "kill him",
  "kill her",
  "kill them",
  /*
   * 🔴 F5 (due diligence): an overdose already taken, said the way people say
   * it, and the euphemism that spread to dodge platform filters. "kms" is a
   * pattern below, not a phrase here, because three letters inside other words
   * and "5 kms" are not a disclosure.
   */
  "took all my pills",
  "taken all my pills",
  "unalive",

  /*
   * 🔴 32.1 — the phrases that carry hopelessness, not the word.
   *
   * Bare "hopeless" was here and it flagged "I am hopeless at keeping a diary",
   * which is somebody being hard on themselves about a habit tracker. The eval
   * put a number on it: three false alarms in eleven negative cases, one of
   * them this. Hopelessness matters clinically; the adjective on its own does
   * not carry it.
   */
  "feel hopeless",
  "feeling hopeless",
  "everything is hopeless",
  "it is hopeless",
  "its hopeless",

  /*
   * 🔴 32.1 — Arabic, which the list could not read at all.
   *
   * The first eval run scored Arabic sensitivity at **0%**: five crisis
   * sentences, none found, in the market this product is built for. The list
   * had been English-only since it was written, every test passed, and nothing
   * anywhere said so. That is the single most valuable thing sprint 32 found,
   * and it was found by counting rather than by reading.
   *
   * Stored in folded form (see `fold`): no diacritics, one alef, final ة and ى
   * normalised, because the same sentence typed by two people differs in
   * exactly those characters and a crisis scanner may not depend on typing.
   */
  "اتمني ان اموت",
  "اتمني الموت",
  "نفسي اموت",
  "عايز اموت",
  "عاوز اموت",
  /*
   * 🔴 F5: the FEMININE forms. "عايزة أموت" folds to "عايزه اموت", which the
   * masculine "عايز اموت" is not a substring of, so a woman writing the same
   * sentence matched nothing. Parity with "مش عايزه اعيش", already here.
   */
  "عايزه اموت",
  "عاوزه اموت",
  /*
   * 🔴 F5: the Egyptian future, "I will kill myself". "هنتحر" is matched as a
   * whole word in CRISIS_PATTERNS below, because as a substring it is inside
   * "هنتحرك" ("we'll get moving").
   */
  "هموت نفسي",
  /*
   * 🔴 DD-2: Egyptian forms the due diligence found missing: hanging, "kill
   * myself" with other future prefixes, "God let me die", "death is kinder",
   * "I wish I had died", and "want to die" without "that".
   */
  "اموت نفسي",
  "حموت نفسي",
  "هقتل نفسي",
  "شنق نفسي",
  "ارمي نفسي من",
  "هرمي نفسي من",
  "اخلص علي نفسي",
  "هخلص علي نفسي",
  "اخلص من حياتي",
  "اتمني اموت",
  "يارب اموت",
  "يا رب اموت",
  "الموت ارحم",
  "ياريتني مت",
  "يا ريتني مت",
  "ياريتني ما اتولدت",
  "يا ريتني ما اتولدت",
  "مش عاوز اعيش",
  "مش عاوزه اعيش",
  "مبقتش عايز اعيش",
  "مبقتش عايزه اعيش",
  "مابقتش عايز اعيش",
  "لا اريد الحياه",
  "اريد ان اموت",
  "بدي اموت",
  "انهي حياتي",
  "انهاء حياتي",
  "اقتل نفسي",
  "اقضي علي نفسي",
  "انتحر",
  "انتحار",
  "اذيت نفسي",
  "اؤذي نفسي",
  "ايذاء نفسي",
  "جرحت نفسي",
  "اجرح نفسي",
  "لا اريد ان اعيش",
  "مش عايز اعيش",
  "مش عايزه اعيش",
  "تعبت من الحياه",
  "افضل لو مت",
  "الافضل لو مت",

  /*
   * 🔴 32.x — the register people actually use, in dialect.
   *
   * The first Arabic list was the formal phrasing: "أريد أن أموت". Nobody in
   * distress writes like that. These are the three shapes the founder's own
   * sentences took — cannot carry on, a burden on my family, no use in my life
   * — and each is the **parity** of a concept the English list already had or
   * has just gained, not a phrase reverse-engineered from a test case. That
   * distinction is the whole discipline here: a list tuned to its fixture
   * scores well and catches nobody.
   */
  "مش قادر اكمل",
  "مش قادره اكمل",
  "مش قادر استمر",
  "ما عدت اقدر اكمل",
  "لا استطيع الاستمرار",
  "لا استطيع ان اكمل",
  "عبء علي اهلي",
  "عبء علي عائلتي",
  "عبء علي اسرتي",
  "عبء عليهم",
  "عبء علي الناس",
  "عبء علي امي",
  "عبء علي ولادي",
  "مفيش فايده من حياتي",
  "لا فايده من حياتي",
  "مفيش فايده مني",
  "لا معني لحياتي",
  "مفيش معني لحياتي",
  "حياتي مالهاش لازمه",
  "حياتي ملهاش لازمه",
  /* DD-2: parity with "no reason to live" and "nothing to live for". */
  "مفيش سبب اعيش",
  "لا يوجد سبب للعيش",
  "لا شيء اعيش من اجله",
  "مفيش حاجه اعيش عشانها",

  /*
   * 🔴 Review: Egyptian and MSA forms the probe found missing. Stored folded
   * (أ إ آ to ا, ة to ه, ى to ي), and written as the shortest piece that is
   * still the concept, so the prefixes (ا ه ح ب, "I", "will", "-ing") and the
   * feminine endings all match: "رمي نفسي من" is ارمي, هرمي and برمي.
   */
  "رمي نفسي من",
  "رمي نفسي قدام",
  "رمي نفسي تحت",
  "اخلص من الدنيا",
  "اخلص من نفسي",
  "اخلص من عمري",
  "ياريتني اموت",
  "يا ريتني اموت",
  "ياريت اموت",
  "يا ريت اموت",
  "ياريتني كنت ميت",
  "يا ريتني كنت ميت",
  "اتمني لو كنت ميت",
  "اتمني لو مت",
  "لم اعد ارغب في الحياه",
  "لا ارغب في الحياه",
  "لم اعد اريد العيش",
  "لا اريد العيش",
  "لم اعد اريد ان اعيش",
  "الحياه لا تستحق",
  "الحياه مش مستاهله",
  "الحياه ماتستاهلش",
  "مش قادر اعيش",
  "مش قادره اعيش",
  "قطع شرايني",
  "قطع شرايين",
  "قطع عروقي",
  "اذي نفسي",
  "ءذي نفسي",
  "جرح نفسي",
  "عبء علي الكل",
  "عبء علي الجميع",
  "عبء علي كل الناس",
  "جرعه زياده",
  "جرعه زايده",
  "جرعه مفرطه",
] as const;

/**
 * 🔴 ARABIZI. The register the list could not read at all. Sprint 59, 2026-09-14.
 *
 * Franco-Arab: Arabic typed in Latin letters with digits for the sounds Latin
 * has no letter for. It is how a very large share of young Egyptians type on a
 * phone, and every phrase above is either English, Arabic script, or Egyptian
 * dialect in Arabic script. Somebody typing `3ayez amoot` into a check-in at
 * 3am matched nothing at all.
 *
 * That is sprint 32's finding one alphabet over. Arabic sensitivity scored 0%
 * then, in the market this product is built for, and every test passed while it
 * did.
 *
 * ## 🔴 PARITY, NOT INVENTION, and the same discipline the Arabic list states
 *
 * Every entry below is the Arabizi spelling of a concept ALREADY in one of the
 * two lists above: want to die, cannot carry on, a burden on my family, no use
 * in my life, hurt myself, end my life. Nothing here is a phrase
 * reverse-engineered from a test sentence, because *"a list tuned to its
 * fixture scores well and catches nobody."*
 *
 * ## ⚠️ A SEED SET, AND IT IS NAMED AS ONE
 *
 * Arabizi spelling varies by person and by keyboard. `foldArabizi` absorbs the
 * predictable part of that — doubled letters, the three ways to write a long u,
 * final y against final i — and it cannot absorb dialect choice. This list is
 * the shapes that are unambiguous, written to be extended by somebody who reads
 * the register natively and measured by the eval rather than assumed. The eval
 * reports `arz` sensitivity as its own number for exactly that reason: hidden
 * inside the Arabic figure it would look solved.
 */
const ARABIZI_PHRASES = [
  /* want to die */
  "3ayez amoot",
  "3ayza amoot",
  "3awez amoot",
  "3awza amoot",
  "nefsy amoot",
  "nefsi amoot",
  "3ayez amout",
  "bady amoot",
  "3ayez amot",
  /*
   * 🔴 The short vowel people drop. `foldArabizi` collapses doubled letters and
   * the long-u spellings; it cannot know that `3ayez` and `3ayz` are one word,
   * because deleting an `e` between consonants would also rewrite English. So
   * both spellings are listed, which is the honest way to carry a variance a
   * fold must not guess at.
   */
  "3ayz amoot",
  "3awz amoot",
  "3ayza amout",
  "nfsy amoot",
  /*
   * 🔴 DD-2: "amut" with a single u, which the fold leaves apart from "amoot".
   * And "ya rab amoot" (God let me die), "el mot ar7am" (death is kinder).
   */
  "3ayez amut",
  "3ayz amut",
  "3ayza amut",
  "3awez amut",
  "3awza amut",
  "nefsy amut",
  "bady amut",
  "ya rab amoot",
  "yarab amoot",
  "el mot ar7am",

  /*
   * end my life, kill myself. Review: the "kill myself" verb is in
   * `ARABIZI_VERB` below, matched up to a word end. "an7ar" is gone: it is
   * inside "an7araf" (swerved).
   */
  "hamawet nafsy",
  "hmawet nafsy",
  "amawet nafsy",
  "hashno2 nafsy",
  "ashno2 nafsy",
  "ha2tel nafsy",
  "a2tel nafsy",
  "ba2tel nafsy",
  "ha2tl nafsy",
  "h2tl nafsy",
  "h2tel nafsy",
  "a2tl nafsy",
  "hamoot nafsy",
  "hamut nafsy",
  "hashna2 nafsy",
  "ashna2 nafsy",
  "a5ls 3ala nafsy",
  "a5las 3ala nafsy",
  "anhy 7ayaty",
  "anhi 7ayati",
  "akhls 3ala nafsy",

  /* do not want to live: see `ARABIZI_COMBINED` below for every spelling. */

  /* cannot carry on */
  "mesh 2ader akmel",
  "msh 2ader akmel",
  "mesh 2adra akmel",
  "msh 2adra akmel",
  "mesh 2ader astamer",
  "mesh 2adra akamel",
  "msh 2adra akamel",
  "mesh 2ader akamel",
  "msh 2ader akamel",
  "ta3abt men el 7ayah",
  "te3ebt men el 7ayah",
  "ta3abt mn el 7aya",

  /* a burden on them */
  "3eb2 3ala ahly",
  "3eb2 3ala 3elty",
  "3eb2 3alehom",
  "3eb2 3ala mama",

  /* no use in my life */
  "mafish fayda mn 7ayaty",
  "mafish fayda meny",
  "mafish ma3na le7ayaty",

  /* hurt myself */
  "azet nafsy",
  "a2za nafsy",
  "gar7t nafsy",
  "bagra7 nafsy",
  "a2zy nafsy",
  "azy nafsy",
] as const;

/*
 * 🔴 Review: the spellings, generated rather than typed one by one. Arabizi
 * has no standard spelling, and a list that has "3ayez amoot" but not "3aiz
 * amoot" misses the person who types it the other way.
 */
const ARABIZI_WANT = ["3ayez", "3ayz", "3aiz", "3ayza", "3ayzah", "3awez", "3awz", "3awza", "nefsy", "nfsy", "nifsy"];
const ARABIZI_DIE = ["amoot", "amut", "a mot", "a moot"];
const ARABIZI_NOT = ["mesh", "msh", "mish"];
const ARABIZI_LIVE = ["a3eesh", "a3ish", "a3esh"];
const ARABIZI_COMBINED: readonly string[] = [
  ...ARABIZI_WANT.flatMap((want) => ARABIZI_DIE.map((die) => `${want} ${die}`)),
  ...ARABIZI_NOT.flatMap((not) => ARABIZI_WANT.slice(0, 8).flatMap((want) => ARABIZI_LIVE.map((live) => `${not} ${want} ${live}`))),
];

/**
 * 🔴 Review: "I will kill myself" / "kill myself" as one Arabizi verb, matched
 * up to a word end. As a plain substring "hant7ar" is inside "hant7arak" (we
 * will get you moving), the same trap "هنتحرك" is in Arabic script. The start
 * is left open so "hant7ar", "7ant7ar" and "wana ant7ar" all match.
 */
const ARABIZI_VERB = ["ant7ar", "anta7ar", "ant7r", "ant7er", "anta7er", "antehar", "antehr", "anteher", "ante7ar"];


/** Ten minutes. Re-alerting on every mention turns the alert into noise. */
const DEDUP_WINDOW_MS = 10 * 60 * 1000;

/**
 * 🔴 35R / C171 — a match that is about somebody else, or about something the
 * speaker says is over, does not count.
 *
 * The measured reason: after sprint 35 the classifier scored **100%
 * specificity** and the shipped pipeline scored **76.9%**, because every
 * remaining false alarm came from this list and the list is a floor the model
 * may not lower. The founder's ruling was to fix the list rather than the
 * floor, and tense and subject are the two things a list cannot otherwise
 * carry.
 *
 * The suppression is per **sentence** and deliberately narrow: a text with a
 * story about a brother in one sentence and a disclosure in the next still
 * alerts, and any marker of the present cancels it outright. See
 * `lib/crisis/context.ts`, which is the most dangerous file here and is
 * written to be the smallest.
 */
export function scanForCrisisLanguage(text: string): string[] {
  const script = CRISIS_PHRASES.filter(
    (phrase) => contains(text, phrase) && notOnlyIdiom(text, phrase) && stillCounts(text, phrase),
  );

  /*
   * 🔴 A SECOND PASS OVER ITS OWN ALPHABET, not a branch inside the first.
   *
   * Arabizi needs a fold that collapses doubled letters and the three spellings
   * of a long u, and applying that to the English list would turn "better off
   * dead" into "beter of dead" and stop it matching the sentence it was written
   * for. Two matchers, each total over its own list.
   *
   * 🔴 `stillCounts` runs on both. The context guard — is this about this person,
   * now, rather than a film or a relative or last year — is not language
   * specific, and skipping it here would make Arabizi the one register where a
   * quoted lyric pages a clinician at 3am.
   */
  const arabizi = [...ARABIZI_PHRASES, ...ARABIZI_COMBINED].filter(
    (phrase) => containsArabizi(text, phrase) && stillCounts(text, phrase),
  );
  const verb = ARABIZI_VERB.filter(
    (phrase) => containsArabizi(text, phrase, { wordEnd: true }) && stillCounts(text, phrase),
  );

  const patterns = CRISIS_PATTERNS.filter(
    (pattern) => pattern.re.test(fold(text)) && stillCounts(text, pattern.label),
  ).map((pattern) => pattern.label);

  return [...new Set([...script, ...arabizi, ...verb, ...patterns])];
}

/**
 * 🔴 Review: what may follow a phrase and make it something else. Checked per
 * occurrence, so one idiom does not hide a second, real mention. Narrow on
 * purpose: "I don't want to live in this world" and "kill me with a knife"
 * still alert.
 */
const LAUGHTER = /^\s*(?:من\s+الضحك|من\s+الكسوف|of\s+laughter|laughing|of\s+embarrassment|from\s+embarrassment)/u;
const IDIOM_AFTER: { phrases: string[]; after: RegExp; before?: RegExp }[] = [
  {
    phrases: ["want to die", "wanted to die", "عايز اموت", "عايزه اموت", "عاوز اموت", "عاوزه اموت", "نفسي اموت"],
    after: LAUGHTER,
  },
  {
    phrases: ["don't want to live", "dont want to live", "do not want to live", "no longer want to live"],
    after:
      /^\s+(?:(?:in|at|near)\s+(?!(?:this|the)\s+(?:world|pain|misery|body|life|agony|hell)|pain|misery|agony|fear|hell)|with\s+(?!(?:this|the|myself|that|it)(?![a-z]))|there(?![a-z])|here\s+with(?![a-z]))/,
  },
  {
    phrases: ["مش عايز اعيش", "مش عايزه اعيش", "مش عاوز اعيش", "مش عاوزه اعيش", "مبقتش عايز اعيش", "مبقتش عايزه اعيش", "مابقتش عايز اعيش"],
    after:
      /^\s+(?:مع\s+(?!نفسي|الوجع|الالم|العذاب)|في\s+(?!الدنيا|العالم|الحياه|الوجع|الالم|العذاب|الدنيا))/u,
  },
  /* Only the idioms: "kill me with a knife" is not one. */
  {
    phrases: ["kill me"],
    after: /^\s+(?:with\s+(?:kindness|laughter|your\s+jokes)(?![a-z])|laughing(?![a-z]))/,
    /* "don't kill me with the homework": a plea, then "with". "don't kill me" alone still alerts. */
    before: /(?:^|[^a-z])(?:don'?t|do not)\s+$/,
  },
  { phrases: ["kill him", "kill her", "kill them"], after: /^\s+with\s+kindness/ },
];

function notOnlyIdiom(text: string, phrase: string): boolean {
  const rule = IDIOM_AFTER.find((entry) => entry.phrases.includes(phrase));
  if (!rule) return true;
  const haystack = fold(text);
  const needle = fold(phrase);
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const rest = haystack.slice(at + needle.length);
    const idiom =
      rule.after.test(rest) || (Boolean(rule.before?.test(haystack.slice(0, at))) && /^\s+with(?![a-z])/.test(rest));
    if (!idiom) return true;
  }
  return false;
}

/**
 * 🔴 F5: SHORT FORMS THAT NEED A WORD BOUNDARY AND A REFUSAL.
 *
 * "kms" (kill myself) is how a lot of people under thirty type it. As a
 * substring it is inside "kmsg" and, worse, it is a plural of kilometres: "I
 * ran 5 kms" must not page a clinician at 3am. So it is a whole word, never
 * after a number, never before a slash ("kms/h").
 */
export const CRISIS_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "kms", re: /(?<![0-9][\s.,]*)(?<![a-z0-9])kms(?![a-z0-9/])/ },
  /*
   * 🔴 "I will kill myself", never "هنتحرك" ("we'll get moving").
   *
   * DD-2: af5343f made this a bare whole word, which then missed "وهنتحر" ("and
   * I will kill myself") and "فهنتحر". The clitics و and ف are allowed in
   * front, with the other future prefix ح and the plural "هننتحر".
   */
  {
    label: "هنتحر",
    re: /(?<![\u0621-\u064A\u066E-\u06D3])[\u0648\u0641]?[\u0647\u062D]\u0646?\u0646\u062A\u062D\u0631(?![\u0621-\u064A\u066E-\u06D3])/u,
  },
  /* DD-2: "I wanna die", never "I wanna diet". */
  { label: "wanna die", re: /(?<![a-z])wanna die(?![a-z])/ },
  /*
   * DD-2: "take my (own) life", never "take my life back". Review: "again",
   * "over this", "in an hour" were excluded too, so "I tried to take my life
   * again" raised nothing. Only the safe exclusions remain, each a whole word.
   */
  {
    label: "take my life",
    re: /(?<![a-z])(?:take|taking|took|taken) my (?:own )?life(?![a-z'])(?!\s+(?:back|into my own hands|in my own hands|savings|insurance)(?![a-z]))/,
  },
  /* Review: "I want to end it", never "end it with him". */
  {
    label: "end it",
    re: /(?<![a-z])(?:want|wanna|going|gonna|plan|planning) to end it(?![a-z])(?!\s+(?:with|between)(?![a-z]))|(?<![a-z])(?:gonna|wanna) end it(?![a-z])(?!\s+(?:with|between)(?![a-z]))/,
  },
  /* Review: a fall, a train: a method named. */
  {
    label: "jump off",
    re: /(?<![a-z])jump(?:ing)? (?:off|from) (?:the |a |my |our |this )?(?:roof|building|balcony|bridge|cliff|tower|window)(?![a-z])/,
  },
  {
    label: "in front of a train",
    re: /(?<![a-z])(?:jump|jumping|throw myself|step|stepping|walk|lie down) in front of (?:a|the) (?:train|car|bus|truck|lorry|metro|subway|tram)(?![a-z])/,
  },
  /*
   * Review: Egyptian forms that need more than a substring. "Sleep and not
   * wake up" (نفسي انام وما اصحاش, ومصحاش), "I am done, I cannot" said as the
   * whole sentence (خلاص مش قادره), and an overdose: "all the pills", never
   * "I took my pill".
   */
  {
    label: "انام وما اصحاش",
    re: /انام\s+و\s*ما?\s*ا?صحا?ش|انام\s+ولا\s+(?:اصحو|استيقظ)/u,
  },
  {
    label: "خلاص مش قادر",
    re: /خلاص\s+(?:مش|مبقتش|مابقتش)\s+قادر[ه]?(?=\s*(?:$|[.!؟?،,]|(?:خلاص|تعبت|بجد|استحمل)))/u,
  },
  {
    label: "كل البرشام",
    re: /(?:خدت|خت|بلعت|شربت|هاخد|حاخد|هخد|هبلع|حبلع|ابلع|اخد)\s+(?:كل\s+(?:ال)?(?:برشام|حبوب|اقراص|دوا)|(?:علبه|علب|شريط|شرايط)\s+(?:ال)?(?:برشام|حبوب|اقراص|دوا))/u,
  },
];

/** What raising an alert actually did, so a caller can tell the patient the truth. */
export type CrisisAlertOutcome = {
  riskId: string | null;
  action: "raised" | "upgraded" | "deduped" | "failed";
  /**
   * 🔴 True only when a notification to a clinician exists for this alert: the
   * in-app row was written now, or (for a repeat inside the window) it was
   * written for the alert this repeats. What the patient is told depends on it.
   */
  clinicianNotified: boolean;
};

/** The configured minutes before a backup is told. The default when settings cannot be read. */
async function escalationMinutesNow(): Promise<number> {
  try {
    const { getSetting } = await import("@/lib/settings");
    return escalationMinutes((await getSetting("crisis")).escalateAfterMinutes);
  } catch {
    return escalationMinutes(undefined);
  }
}

/** Tell the minute tick a crisis alert needs it at `dueAt`. Never throws. */
async function wakeTheTickAt(dueAt: Date): Promise<void> {
  try {
    const { noteCrisisDue } = await import("@/lib/data/reminder-marker");
    await noteCrisisDue(dueAt);
  } catch (error) {
    log.warn("crisis marker not lowered", { reason: safeErrorMessage(error) });
  }
}

/**
 * Record and deliver a crisis alert.
 *
 * The write ordering is load-bearing: the risk row is persisted as `pending`
 * *before* anyone is notified and only flipped to `delivered` afterwards. That
 * way a notification failure leaves a durable record for the sweeper cron to
 * retry, instead of the alert evaporating.
 *
 * 🔴 F2: and then it leaves the building. Straight after the in-app row the
 * clinician is sent the alert by email (and WhatsApp where configured) with a
 * link to acknowledge it, the row gets an escalation deadline, and the minute
 * tick is told when that deadline falls. See `lib/crisis/escalation.ts`.
 *
 * 🔴 F2 / item 5: a repeat inside the ten minute window is dropped only when it
 * is not HIGHER. A model's `critical` after the phrase list's `high` upgrades
 * the alert in place (level, source, indicators) and notifies again, with the
 * acknowledgement cleared and the escalation clock restarted: the risk changed,
 * so whoever acknowledged the lower one has not acknowledged this.
 *
 * 🔴 0192: a journal raises the same alert, with `journal` in place of a
 * session, once per clinician holding a live grant. With no clinician
 * (`therapistId` null) it goes straight to the platform on-call.
 */
export async function raiseCrisisAlert(opts: {
  sessionId?: string | null;
  journal?: { journalId: string; personId: string; name?: string | null } | null;
  organizationId: string | null;
  therapistId: string | null;
  patientId: string | null;
  level: RiskLevel;
  source: "keyword" | "model";
  indicators: string[];
  recommendedAction?: string;
}): Promise<CrisisAlertOutcome> {
  const sessionId = opts.sessionId ?? null;
  const journal = opts.journal ?? null;
  if (!sessionId && !journal) return { riskId: null, action: "failed", clinicianNotified: false };

  /* The same subject: this session, or this person's journals for this clinician (or for nobody). */
  const subject = sessionId
    ? eq(riskAssessments.sessionId, sessionId)
    : and(
        eq(riskAssessments.personId, journal!.personId),
        isNotNull(riskAssessments.journalId),
        opts.therapistId ? eq(riskAssessments.therapistId, opts.therapistId) : isNull(riskAssessments.therapistId),
      );
  const [recent] = await db
    .select({ id: riskAssessments.id, level: riskAssessments.level, alertStatus: riskAssessments.alertStatus })
    .from(riskAssessments)
    .where(and(subject, gt(riskAssessments.createdAt, new Date(Date.now() - DEDUP_WINDOW_MS))))
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);

  const decision = dedupDecision(recent?.level ?? null, opts.level);
  if (decision === "skip" && recent) {
    return { riskId: recent.id, action: "deduped", clinicianNotified: Boolean(opts.therapistId) && recent.alertStatus !== "pending" };
  }

  /* 🔴 K22: in the clinician's own language (Ruling 8), not English for all. */
  const { wordsFor, wordsIn } = await import("@/lib/i18n/message-words");
  const { t } = opts.therapistId ? await wordsFor({ userId: opts.therapistId }) : await wordsIn(null);

  const now = new Date();
  const minutes = await escalationMinutesNow();
  /* Nobody to tell first: the row starts at the platform, the last stage. */
  const noClinician = !opts.therapistId;
  const escalateAt = escalateAtFor(now, minutes);
  const subjectColumns = {
    journalId: journal?.journalId ?? null,
    personId: journal?.personId ?? null,
  };

  let riskId: string | undefined;
  if (decision === "upgrade" && recent) {
    const upgraded = await db
      .update(riskAssessments)
      .set({
        level: opts.level,
        source: opts.source,
        indicators: opts.indicators,
        recommendedAction: opts.recommendedAction ?? t("talert.riskAction"),
        alertStatus: "pending",
        acknowledgedAt: null,
        acknowledgedBy: null,
        escalateAt: noClinician ? null : escalateAt,
        escalationStage: noClinician ? FINAL_STAGE : 0,
        outOfBandAt: null,
        outOfBandAttempts: 0,
        ...(journal ? { journalId: journal.journalId } : {}),
      })
      .where(eq(riskAssessments.id, recent.id))
      .returning({ id: riskAssessments.id });
    riskId = upgraded[0]?.id;
  } else {
    const inserted = await db
      .insert(riskAssessments)
      .values({
        sessionId,
        ...subjectColumns,
        organizationId: opts.organizationId,
        therapistId: opts.therapistId,
        patientId: opts.patientId,
        level: opts.level,
        source: opts.source,
        indicators: opts.indicators,
        recommendedAction:
          opts.recommendedAction ?? t("talert.riskAction"),
        alertStatus: "pending",
        escalateAt: noClinician ? null : escalateAt,
        escalationStage: noClinician ? FINAL_STAGE : 0,
      })
      .returning({ id: riskAssessments.id });
    riskId = inserted[0]?.id;
  }

  if (!riskId) return { riskId: null, action: "failed", clinicianNotified: false };

  if (noClinician) {
    await tellPlatformNow(riskId, now);
    log.warn("crisis alert raised with no clinician; platform on-call told", {
      level: opts.level,
      source: opts.source,
      indicatorCount: opts.indicators.length,
    });
    return { riskId, action: decision === "upgrade" ? "upgraded" : "raised", clinicianNotified: false };
  }

  // Note: the notification body never contains the matched phrases. The
  // clinician sees those in the room and in the chart, not in a push payload.
  let clinicianNotified = false;
  try {
    await db.insert(notifications).values({
      userId: opts.therapistId!,
      kind: "crisis",
      title: journal ? t("talert.journalTitle", { name: journal.name || t("talert.aPatient") }) : t("talert.riskTitle"),
      body: journal
        ? opts.indicators.length === 1
          ? t("talert.journalBodyOne")
          : t("talert.journalBody", { count: opts.indicators.length })
        : t("talert.riskBodyLive"),
      /* The session id stays in the URL: opening the session clears this row (`markSessionNotificationsRead`). */
      actionUrl: sessionId ? `${alertPath(riskId)}?session=${sessionId}` : alertPath(riskId),
    });
    clinicianNotified = true;

    await db
      .update(riskAssessments)
      .set({ alertStatus: "delivered" })
      .where(eq(riskAssessments.id, riskId));
  } catch (error) {
    log.error("crisis alert delivery failed; left pending for sweeper", {
      session: sessionId ? ref(sessionId) : null,
      reason: safeErrorMessage(error),
    });
  }

  /* 🔴 F2: out of band, now. A send that did not leave is retried by the tick. */
  const sent = await sendOutOfBand(riskId, minutes);
  await wakeTheTickAt(sent ? escalateAt : now);

  // Logged without the matched phrases — those are the patient's words.
  log.warn("crisis alert raised", {
    session: sessionId ? ref(sessionId) : null,
    journal: journal ? ref(journal.journalId) : null,
    level: opts.level,
    source: opts.source,
    indicatorCount: opts.indicators.length,
    upgraded: decision === "upgrade",
    outOfBand: sent,
  });

  return { riskId, action: decision === "upgrade" ? "upgraded" : "raised", clinicianNotified };
}

/** Where an alert is opened and acknowledged: a signed-in page, never a one-click GET. */
function alertPath(riskId: string): string {
  return `/notifications/alerts/${riskId}`;
}

/**
 * 🔴 Due diligence: a crisis path that failed is written where an operator
 * looks (`/admin/errors`), not only to a log line. No patient detail, only
 * the alert's id. Never throws.
 */
async function recordCrisisFailure(what: string, riskId: string): Promise<void> {
  try {
    const { recordError } = await import("@/lib/observability/errors");
    await recordError({ error: new Error(`crisis alert ${riskId}: ${what}`), path: "/crisis/escalation" });
  } catch {
    /* The log line from the caller still stands. */
  }
}

/**
 * 🔴 0192: an alert with no clinician to tell first (a journal nobody holds a
 * grant to) goes to the platform on-call at once. It is raised at the last
 * stage, so nothing escalates it further; if nobody could be reached, the
 * failure is recorded for `/admin/errors`.
 */
async function tellPlatformNow(riskId: string, now: Date): Promise<void> {
  try {
    const backups = await platformOnCall();
    const ids = backups.map((b) => b.userId).filter((id): id is string => Boolean(id));
    await db
      .update(riskAssessments)
      .set({ escalatedAt: now, escalatedTo: [...new Set(ids)] })
      .where(eq(riskAssessments.id, riskId));

    let inApp = 0;
    let sent = 0;
    for (const backup of backups) {
      try {
        const told = await tellBackup(backup, { riskId, clinician: null, minutes: 0, organizationId: null });
        if (told.inApp) inApp += 1;
        if (told.sent) sent += 1;
      } catch (error) {
        log.warn("platform on-call not told", { reason: safeErrorMessage(error) });
      }
    }
    if (inApp > 0) {
      await db.update(riskAssessments).set({ alertStatus: "delivered" }).where(eq(riskAssessments.id, riskId));
    }
    if (sent === 0) await recordCrisisFailure("no clinician, and no email reached the platform on-call", riskId);
    log.warn("crisis alert sent to the platform on-call", { backups: backups.length, inApp, sent });
  } catch (error) {
    log.error("crisis alert to the platform on-call failed", { reason: safeErrorMessage(error) });
    await recordCrisisFailure("no clinician, and telling the platform on-call failed", riskId);
  }
}

/**
 * 🔴 F2: THE ALERT, OUT OF BAND, TO THE CLINICIAN IT IS FOR.
 *
 * Email always (every clinician has an address), WhatsApp too when a channel
 * is configured and the template approved, through `notify()`: no new
 * provider. The link opens a signed-in page with an Acknowledge button. It is
 * deliberately not a link that acknowledges by being opened: mail scanners
 * open every link in a message, and an alert acknowledged by a spam filter is
 * an alert nobody escalates.
 *
 * Records the attempt either way, and when it left. When the last attempt
 * fails, the alert goes to the next stage now (`afterFailedSend`). Never throws.
 */
async function sendOutOfBand(riskId: string, minutes: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        therapistId: riskAssessments.therapistId,
        organizationId: riskAssessments.organizationId,
        journalId: riskAssessments.journalId,
        attempts: riskAssessments.outOfBandAttempts,
        email: users.email,
        profile: users.profile,
        timezone: users.timezone,
      })
      .from(riskAssessments)
      .innerJoin(users, eq(users.id, riskAssessments.therapistId))
      .where(eq(riskAssessments.id, riskId))
      .limit(1);
    if (!row || !row.therapistId) return false;

    /*
     * Claim this attempt before sending. The hourly crisis job and the minute
     * tick both retry unsent alerts, and once an hour they overlap: whichever
     * moves the attempt count first sends, the other sees zero rows and stops,
     * so a clinician is never emailed twice and the attempt budget is spent once.
     */
    const claimed = await db
      .update(riskAssessments)
      .set({ outOfBandAttempts: row.attempts + 1 })
      .where(
        and(
          eq(riskAssessments.id, riskId),
          eq(riskAssessments.outOfBandAttempts, row.attempts),
          isNull(riskAssessments.outOfBandAt),
        ),
      )
      .returning({ id: riskAssessments.id });
    if (claimed.length === 0) return false;

    const { wordsFor } = await import("@/lib/i18n/message-words");
    const { t, locale } = await wordsFor({ userId: row.therapistId });
    const { notify } = await import("@/lib/notify");
    const { env } = await import("@/lib/env");

    const delivery = await notify(
      {
        email: row.email,
        phone: row.profile?.phone ?? null,
        timezone: row.timezone,
        locale,
        organizationId: row.organizationId,
        reader: "clinician",
      },
      {
        kind: "crisis.alert",
        subject: t("calert.subject"),
        body: t(row.journalId ? "calert.bodyJournal" : "calert.body", { minutes: String(minutes) }),
        link: { label: t("calert.ack"), url: `${env.appUrl}${alertPath(riskId)}` },
        variables: [],
      },
    );

    await db
      .update(riskAssessments)
      .set({
        outOfBandAt: delivery.sent ? new Date() : null,
        outOfBandChannels: delivery.channels,
      })
      .where(eq(riskAssessments.id, riskId));
    if (!delivery.sent) await afterFailedSend(riskId);
    return delivery.sent;
  } catch (error) {
    log.error("crisis alert out-of-band send failed", { reason: safeErrorMessage(error) });
    try {
      await db
        .update(riskAssessments)
        .set({ outOfBandAttempts: sql`${riskAssessments.outOfBandAttempts} + 1` })
        .where(eq(riskAssessments.id, riskId));
    } catch {
      /* The escalation deadline still stands; that is the backstop. */
    }
    await afterFailedSend(riskId);
    return false;
  }
}

/**
 * 🔴 Due diligence: retries spent, so the alert goes to the next stage NOW.
 *
 * It used to be retried five times and then left waiting for its deadline with
 * nobody told. Its deadline is pulled to this minute (a conditional update, so
 * two callers record it once), the failure is recorded for `/admin/errors`,
 * and the tick is woken to escalate it. Never throws.
 */
async function afterFailedSend(riskId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        acknowledgedAt: riskAssessments.acknowledgedAt,
        escalationStage: riskAssessments.escalationStage,
        escalateAt: riskAssessments.escalateAt,
        outOfBandAt: riskAssessments.outOfBandAt,
        outOfBandAttempts: riskAssessments.outOfBandAttempts,
      })
      .from(riskAssessments)
      .where(eq(riskAssessments.id, riskId))
      .limit(1);
    if (!row) return false;
    const pulled = escalateNowIfExhausted(row, now);
    if (!pulled) return false;

    const moved = await db
      .update(riskAssessments)
      .set({ escalateAt: pulled })
      .where(
        and(
          eq(riskAssessments.id, riskId),
          isNull(riskAssessments.acknowledgedAt),
          isNull(riskAssessments.outOfBandAt),
          eq(riskAssessments.escalationStage, row.escalationStage),
          or(isNull(riskAssessments.escalateAt), gt(riskAssessments.escalateAt, now)),
        ),
      )
      .returning({ id: riskAssessments.id });
    if (moved.length === 0) return false;

    log.error("crisis alert never reached the clinician; escalating now", { attempts: row.outOfBandAttempts });
    await recordCrisisFailure(`every out-of-band attempt to the clinician failed (${row.outOfBandAttempts}); escalated to the next stage`, riskId);
    await wakeTheTickAt(pulled);
    return true;
  } catch (error) {
    log.warn("crisis alert exhaustion not handled", { reason: safeErrorMessage(error) });
    return false;
  }
}

type Backup = {
  userId: string | null;
  email: string;
  phone: string | null;
  timezone: string | null;
  reader: "clinician" | "manager" | "staff";
};

/**
 * 🔴 F2: WHO IS TOLD WHEN NOBODY ACKNOWLEDGED.
 *
 * A clinic: its other active clinicians, and its managers. A manager sees none
 * of the clinical record (C259), so they are told only to reach the clinician;
 * a manager who is also a clinician here is told as one.
 */
async function clinicBackups(organizationId: string, therapistId: string): Promise<Backup[]> {
  const colleagues = await db
    .select({ id: users.id, email: users.email, profile: users.profile, timezone: users.timezone })
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        ne(users.id, therapistId),
        /* Only clinicians: they are the ones who may acknowledge (`mayAcknowledge`). */
        eq(users.role, "therapist"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(50);
  const managers = await db
    .select({ email: clinicManagers.email, linkedUserId: clinicManagers.linkedUserId })
    .from(clinicManagers)
    .where(and(eq(clinicManagers.organizationId, organizationId), isNull(clinicManagers.deletedAt)))
    .limit(20);

  const told = new Set(colleagues.map((c) => c.id));
  return [
    ...colleagues.map((c) => ({
      userId: c.id,
      email: c.email,
      phone: c.profile?.phone ?? null,
      timezone: c.timezone,
      reader: "clinician" as const,
    })),
    ...managers
      .filter((m) => m.linkedUserId !== therapistId && !(m.linkedUserId && told.has(m.linkedUserId)))
      .map((m) => ({ userId: null, email: m.email, phone: null, timezone: null, reader: "manager" as const })),
  ];
}

/**
 * 🔴 F2 RULING: THE PLATFORM'S ON-CALL IS EVERY ACTIVE BACK OFFICE MANAGER AND
 * SUPER ADMIN (`ON_CALL_ROLES`).
 *
 * There is no on-call rota in the product, and a flag nobody has set yet is a
 * list that is empty on the night it is needed. Managers and super admins are
 * the people who may act across practices; `staff` work queues and are not
 * asked to make a clinical escalation call. The list cannot be empty while the
 * founder's own account exists.
 */
async function platformOnCall(): Promise<Backup[]> {
  const rows = await db
    .select({ id: users.id, email: users.email, timezone: users.timezone })
    .from(users)
    .where(
      and(
        inArray(users.role, [...ON_CALL_ROLES]),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(20);
  return rows.map((r) => ({ userId: r.id, email: r.email, phone: null, timezone: r.timezone, reader: "staff" as const }));
}

/**
 * Tell one backup: an in-app row when they have an account, then email and
 * WhatsApp. `clinician` null is an alert with no clinician (a journal nobody
 * holds a grant to), worded as such.
 */
async function tellBackup(
  backup: Backup,
  alert: { riskId: string; clinician: string | null; minutes: number; organizationId: string | null },
): Promise<{ inApp: boolean; sent: boolean }> {
  const { wordsFor, wordsIn } = await import("@/lib/i18n/message-words");
  const { t, locale } = backup.userId ? await wordsFor({ userId: backup.userId }) : await wordsIn(null);
  const values = { clinician: alert.clinician ?? "", minutes: String(alert.minutes) };
  const subject = alert.clinician === null ? t("calert.noClinicianSubject") : t("calert.escSubject");
  const body =
    alert.clinician === null
      ? t("calert.noClinicianBody")
      : backup.reader === "manager"
        ? t("calert.escBodyManager", values)
        : t("calert.escBody", values);

  let inApp = false;
  if (backup.userId) {
    try {
      await db.insert(notifications).values({
        userId: backup.userId,
        kind: "crisis",
        title: subject,
        body,
        actionUrl: alertPath(alert.riskId),
      });
      inApp = true;
    } catch (error) {
      log.warn("escalation in-app row not written", { reason: safeErrorMessage(error) });
    }
  }

  const { notify } = await import("@/lib/notify");
  const { env } = await import("@/lib/env");
  const delivery = await notify(
    {
      email: backup.email,
      phone: backup.phone,
      timezone: backup.timezone,
      locale,
      organizationId: alert.organizationId,
      reader: backup.reader,
    },
    {
      kind: "crisis.escalated",
      subject,
      body,
      /* A manager cannot open the alert (C259); they are asked to reach the clinician. */
      link: backup.userId ? { label: t("calert.ack"), url: `${env.appUrl}${alertPath(alert.riskId)}` } : null,
      variables: [alert.clinician ?? t("talert.aPatient")],
    },
  );
  return { inApp, sent: delivery.sent };
}

/**
 * 🔴 F2: THE MINUTE TICK'S CRISIS WORK. Escalate every alert past its deadline
 * that nobody acknowledged, and retry out-of-band sends that did not leave.
 *
 * Each escalation is CLAIMED with a conditional update on its stage before
 * anybody is told, so two ticks in the same minute tell nobody twice. Every
 * alert is caught on its own: one bad row does not stop the rest.
 *
 * 🔴 Due diligence: an alert whose sends to the clinician are all spent is
 * pulled forward first, so it escalates in this same run. A stage that reached
 * nobody by email is recorded for `/admin/errors`.
 */
export async function escalateCrisisAlerts(now: Date = new Date()): Promise<{ escalated: number; retried: number }> {
  const minutes = await escalationMinutesNow();
  let escalated = 0;
  let retried = 0;

  /* Sends that are spent and still waiting on a later deadline: escalate now. */
  const spent = await db
    .select({ id: riskAssessments.id })
    .from(riskAssessments)
    .where(
      and(
        isNull(riskAssessments.acknowledgedAt),
        isNull(riskAssessments.outOfBandAt),
        gte(riskAssessments.outOfBandAttempts, MAX_OUT_OF_BAND_ATTEMPTS),
        lt(riskAssessments.escalationStage, FINAL_STAGE),
        or(isNull(riskAssessments.escalateAt), gt(riskAssessments.escalateAt, now)),
        gt(riskAssessments.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(50);
  for (const row of spent) await afterFailedSend(row.id, now);

  const due = await db
    .select({
      id: riskAssessments.id,
      organizationId: riskAssessments.organizationId,
      therapistId: riskAssessments.therapistId,
      acknowledgedAt: riskAssessments.acknowledgedAt,
      escalationStage: riskAssessments.escalationStage,
      escalateAt: riskAssessments.escalateAt,
      escalatedTo: riskAssessments.escalatedTo,
      kind: organizations.kind,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(riskAssessments)
    .innerJoin(organizations, eq(organizations.id, riskAssessments.organizationId))
    .innerJoin(users, eq(users.id, riskAssessments.therapistId))
    .where(
      and(
        isNull(riskAssessments.acknowledgedAt),
        isNotNull(riskAssessments.escalateAt),
        lte(riskAssessments.escalateAt, now),
        lt(riskAssessments.escalationStage, FINAL_STAGE),
      ),
    )
    .limit(50);

  for (const row of due) {
    try {
      if (!row.organizationId || !row.therapistId) continue;
      let step = nextEscalation(row, { now, inClinic: row.kind === "clinic", minutes });
      if (!step) continue;

      let backups = step.audience === "clinic" ? await clinicBackups(row.organizationId, row.therapistId) : await platformOnCall();
      /* A clinic with nobody else in it goes straight to the platform. */
      if (step.audience === "clinic" && backups.length === 0) {
        step = { audience: "platform", nextStage: FINAL_STAGE, nextEscalateAt: null };
        backups = await platformOnCall();
      }

      const told = [...row.escalatedTo, ...backups.map((b) => b.userId).filter((id): id is string => Boolean(id))];
      const [claimed] = await db
        .update(riskAssessments)
        .set({
          escalationStage: step.nextStage,
          escalateAt: step.nextEscalateAt,
          escalatedAt: now,
          escalatedTo: [...new Set(told)],
        })
        .where(
          and(
            eq(riskAssessments.id, row.id),
            eq(riskAssessments.escalationStage, row.escalationStage),
            isNull(riskAssessments.acknowledgedAt),
          ),
        )
        .returning({ id: riskAssessments.id });
      if (!claimed) continue;

      const clinician = `${row.firstName} ${row.lastName}`.trim();
      let reached = 0;
      let sent = 0;
      for (const backup of backups) {
        try {
          const result = await tellBackup(backup, { riskId: row.id, clinician, minutes, organizationId: row.organizationId });
          if (result.inApp || result.sent) reached += 1;
          if (result.sent) sent += 1;
        } catch (error) {
          log.warn("escalation to one backup failed", { reason: safeErrorMessage(error) });
        }
      }
      escalated += 1;
      if (sent === 0) await recordCrisisFailure(`escalated to the ${step.audience} but no email or message left`, row.id);
      /* Counts only, never who. */
      log.warn("crisis alert escalated", { audience: step.audience, stage: step.nextStage, backups: backups.length, reached, sent });
    } catch (error) {
      log.error("crisis escalation failed for one alert", { reason: safeErrorMessage(error) });
      await recordCrisisFailure("escalation failed", row.id);
    }
  }

  /* Out-of-band sends that did not leave, with retries left, from the last day. */
  const unsent = await db
    .select({
      id: riskAssessments.id,
      acknowledgedAt: riskAssessments.acknowledgedAt,
      outOfBandAt: riskAssessments.outOfBandAt,
      outOfBandAttempts: riskAssessments.outOfBandAttempts,
    })
    .from(riskAssessments)
    .where(
      and(
        isNull(riskAssessments.acknowledgedAt),
        isNull(riskAssessments.outOfBandAt),
        gte(riskAssessments.outOfBandAttempts, 1),
        lt(riskAssessments.outOfBandAttempts, MAX_OUT_OF_BAND_ATTEMPTS),
        gt(riskAssessments.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(50);
  for (const row of unsent) {
    if (!needsOutOfBandRetry(row)) continue;
    if (await sendOutOfBand(row.id, minutes)) retried += 1;
  }

  return { escalated, retried };
}

/**
 * The soonest moment the tick has crisis work, read from the database, for the
 * marker (`lib/data/reminder-marker.ts`). Null when no open alert needs it.
 */
export async function nextCrisisDueAt(now: Date = new Date()): Promise<Date | null> {
  const rows = await db
    .select({
      acknowledgedAt: riskAssessments.acknowledgedAt,
      escalationStage: riskAssessments.escalationStage,
      escalateAt: riskAssessments.escalateAt,
      outOfBandAt: riskAssessments.outOfBandAt,
      outOfBandAttempts: riskAssessments.outOfBandAttempts,
    })
    .from(riskAssessments)
    .where(
      and(
        isNull(riskAssessments.acknowledgedAt),
        or(
          and(isNotNull(riskAssessments.escalateAt), lt(riskAssessments.escalationStage, FINAL_STAGE)),
          and(
            isNull(riskAssessments.outOfBandAt),
            gte(riskAssessments.outOfBandAttempts, 1),
            /* Retries left, or retries spent and a stage still to go to. */
            or(lt(riskAssessments.outOfBandAttempts, MAX_OUT_OF_BAND_ATTEMPTS), lt(riskAssessments.escalationStage, FINAL_STAGE)),
            gt(riskAssessments.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
          ),
        ),
      ),
    )
    .orderBy(asc(riskAssessments.escalateAt))
    .limit(200);
  return crisisDueAt(rows, now);
}

/** One alert as the acknowledge page shows it, or null when this reader may not see it. */
export async function alertForViewer(
  riskId: string,
  actor: { userId: string; organizationId: string; role: string },
): Promise<{
  id: string;
  sessionId: string | null;
  /** 🔴 0192: the chart a journal alert opens, for the clinician it is for. */
  patientId: string | null;
  fromJournal: boolean;
  level: RiskLevel;
  createdAt: Date;
  isTheirs: boolean;
  clinician: string | null;
  escalationStage: number;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
} | null> {
  if (!/^[0-9a-f-]{36}$/i.test(riskId)) return null;
  const [row] = await db
    .select({
      id: riskAssessments.id,
      sessionId: riskAssessments.sessionId,
      journalId: riskAssessments.journalId,
      patientId: riskAssessments.patientId,
      organizationId: riskAssessments.organizationId,
      therapistId: riskAssessments.therapistId,
      level: riskAssessments.level,
      createdAt: riskAssessments.createdAt,
      escalationStage: riskAssessments.escalationStage,
      acknowledgedAt: riskAssessments.acknowledgedAt,
      acknowledgedBy: riskAssessments.acknowledgedBy,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(riskAssessments)
    /* Left: a journal alert with no clinician has nobody to join. */
    .leftJoin(users, eq(users.id, riskAssessments.therapistId))
    .where(eq(riskAssessments.id, riskId))
    .limit(1);
  if (!row || !mayAcknowledge(row, actor)) return null;

  let acknowledgedBy: string | null = null;
  if (row.acknowledgedBy) {
    const [who] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, row.acknowledgedBy))
      .limit(1);
    acknowledgedBy = who ? `${who.firstName} ${who.lastName}`.trim() : null;
  }

  const isTheirs = row.therapistId !== null && row.therapistId === actor.userId;
  return {
    id: row.id,
    sessionId: row.sessionId,
    patientId: isTheirs ? row.patientId : null,
    fromJournal: row.journalId !== null,
    level: row.level,
    createdAt: row.createdAt,
    isTheirs,
    clinician: row.therapistId ? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() : null,
    escalationStage: row.escalationStage,
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedBy,
  };
}

/**
 * 🔴 F2: SOMEBODY HAS IT. Records who and when, and stops the escalation.
 *
 * Only the first acknowledgement is recorded: a second press is a no-op that
 * still answers true, because the alert is in hand either way. The marker is
 * written again from the database, so the tick stops waking for it.
 *
 * Who may press it is `mayAcknowledge` (through `alertForViewer`): the
 * clinician, a clinician colleague in the practice, or the platform on-call.
 */
export async function acknowledgeCrisisAlert(
  riskId: string,
  actor: { userId: string; organizationId: string; role: string },
): Promise<boolean> {
  const viewed = await alertForViewer(riskId, actor);
  if (!viewed) return false;
  /*
   * True only for the press that actually recorded the acknowledgement. An
   * alert someone else already acknowledged, or a second press that loses the
   * race, returns false, so the caller writes no audit row for a person the
   * alert does not name.
   */
  if (viewed.acknowledgedAt) return false;

  const recorded = await db
    .update(riskAssessments)
    .set({ acknowledgedAt: new Date(), acknowledgedBy: actor.userId, alertStatus: "acknowledged", escalateAt: null })
    .where(and(eq(riskAssessments.id, riskId), isNull(riskAssessments.acknowledgedAt)))
    .returning({ id: riskAssessments.id });
  if (recorded.length === 0) return false;

  try {
    const { refreshReminderMarker } = await import("@/lib/data/reminder-marker");
    await refreshReminderMarker();
  } catch (error) {
    log.warn("crisis marker not refreshed after acknowledgement", { reason: safeErrorMessage(error) });
  }
  log.info("crisis alert acknowledged", { stage: viewed.escalationStage, byTherapist: viewed.isTheirs, role: actor.role });
  return true;
}

/**
 * Re-deliver alerts that were persisted but never delivered. Run on a schedule.
 * Clinician alerts only: one with no clinician was given to the platform on-call.
 */
export async function sweepUndeliveredAlerts(): Promise<number> {
  const stale = await db
    .select({
      id: riskAssessments.id,
      sessionId: riskAssessments.sessionId,
      therapistId: riskAssessments.therapistId,
    })
    .from(riskAssessments)
    .where(and(eq(riskAssessments.alertStatus, "pending"), isNotNull(riskAssessments.therapistId)))
    .limit(50);

  let delivered = 0;
  for (const row of stale) {
    if (!row.therapistId) continue;
    try {
      const { wordsFor } = await import("@/lib/i18n/message-words");
      const { t } = await wordsFor({ userId: row.therapistId });
      await db.insert(notifications).values({
        userId: row.therapistId,
        kind: "crisis",
        title: t("talert.riskTitle"),
        body: row.sessionId ? t("talert.riskBody") : t("talert.journalBodyOne"),
        actionUrl: row.sessionId ? `${alertPath(row.id)}?session=${row.sessionId}` : alertPath(row.id),
      });
      await db
        .update(riskAssessments)
        .set({ alertStatus: "delivered" })
        .where(eq(riskAssessments.id, row.id));
      delivered += 1;
    } catch (error) {
      log.error("crisis sweeper delivery failed", {
        reason: safeErrorMessage(error),
      });
    }
  }
  return delivered;
}

/*
 * What a patient on a join link is allowed to see, bilingual and truthful
 * (F2 / F5). Pure, and kept in its own module so it is tested without a
 * database; re-exported here because every caller already imports this file.
 */
export { patientFacingCrisisMessage } from "@/lib/crisis/patient-message";
