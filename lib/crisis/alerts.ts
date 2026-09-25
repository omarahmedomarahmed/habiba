import "server-only";

import { EMERGENCY_LINES, crisisLine, lineOpenAt } from "@/lib/crisis/line";
import { stillCounts } from "@/lib/crisis/context";
import { contains, containsArabizi } from "@/lib/crisis/fold";

import { and, desc, eq, gt } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { notifications, riskAssessments, sessions } from "@/lib/db/schema";
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

  /* end my life, kill myself */
  "an7ar",
  "hant7er",
  "ha2tel nafsy",
  "a2tel nafsy",
  "ba2tel nafsy",
  "anhy 7ayaty",
  "anhi 7ayati",
  "akhls 3ala nafsy",

  /* do not want to live */
  "mesh 3ayez a3eesh",
  "msh 3ayez a3eesh",
  "mesh 3ayz a3eesh",
  "msh 3ayz a3eesh",
  "mesh 3ayza a3eesh",
  "msh 3ayza a3eesh",
  "mesh 3ayez a3ish",

  /* cannot carry on */
  "mesh 2ader akmel",
  "msh 2ader akmel",
  "mesh 2adra akmel",
  "msh 2adra akmel",
  "mesh 2ader astamer",
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
] as const;


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
    (phrase) => contains(text, phrase) && stillCounts(text, phrase),
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
  const arabizi = ARABIZI_PHRASES.filter(
    (phrase) => containsArabizi(text, phrase) && stillCounts(text, phrase),
  );

  return [...script, ...arabizi];
}

/**
 * Record and deliver a crisis alert.
 *
 * The write ordering is load-bearing: the risk row is persisted as `pending`
 * *before* anyone is notified and only flipped to `delivered` afterwards. That
 * way a notification failure leaves a durable record for the sweeper cron to
 * retry, instead of the alert evaporating.
 */
export async function raiseCrisisAlert(opts: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  level: RiskLevel;
  source: "keyword" | "model";
  indicators: string[];
  recommendedAction?: string;
}): Promise<void> {
  const recent = await db
    .select({ id: riskAssessments.id })
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.sessionId, opts.sessionId),
        gt(riskAssessments.createdAt, new Date(Date.now() - DEDUP_WINDOW_MS)),
      ),
    )
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);

  if (recent.length > 0) return;

  /* 🔴 K22 — in the clinician's own language (Ruling 8), not English for all. */
  const { wordsFor } = await import("@/lib/i18n/message-words");
  const { t } = await wordsFor({ userId: opts.therapistId });

  const inserted = await db
    .insert(riskAssessments)
    .values({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      therapistId: opts.therapistId,
      patientId: opts.patientId,
      level: opts.level,
      source: opts.source,
      indicators: opts.indicators,
      recommendedAction:
        opts.recommendedAction ?? t("talert.riskAction"),
      alertStatus: "pending",
    })
    .returning({ id: riskAssessments.id });

  const riskId = inserted[0]?.id;
  if (!riskId) return;

  // Note: the notification body never contains the matched phrases. The
  // clinician sees those in the room and in the chart, not in a push payload.
  try {
    await db.insert(notifications).values({
      userId: opts.therapistId,
      kind: "crisis",
      title: t("talert.riskTitle"),
      body: t("talert.riskBodyLive"),
      actionUrl: `/sessions/${opts.sessionId}`,
    });

    await db
      .update(riskAssessments)
      .set({ alertStatus: "delivered" })
      .where(eq(riskAssessments.id, riskId));
  } catch (error) {
    log.error("crisis alert delivery failed; left pending for sweeper", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
  }

  // Logged without the matched phrases — those are the patient's words.
  log.warn("crisis alert raised", {
    session: ref(opts.sessionId),
    level: opts.level,
    source: opts.source,
    indicatorCount: opts.indicators.length,
  });
}

/**
 * Re-deliver alerts that were persisted but never delivered. Run on a schedule.
 */
export async function sweepUndeliveredAlerts(): Promise<number> {
  const stale = await db
    .select({
      id: riskAssessments.id,
      sessionId: riskAssessments.sessionId,
      therapistId: riskAssessments.therapistId,
    })
    .from(riskAssessments)
    .innerJoin(sessions, eq(sessions.id, riskAssessments.sessionId))
    .where(eq(riskAssessments.alertStatus, "pending"))
    .limit(50);

  let delivered = 0;
  for (const row of stale) {
    try {
      const { wordsFor } = await import("@/lib/i18n/message-words");
      const { t } = await wordsFor({ userId: row.therapistId });
      await db.insert(notifications).values({
        userId: row.therapistId,
        kind: "crisis",
        title: t("talert.riskTitle"),
        body: t("talert.riskBody"),
        actionUrl: `/sessions/${row.sessionId}`,
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

/**
 * What a patient on a join link is allowed to see. No level, no indicators, no
 * clinical detail — only support and a number to call. This shape is asserted
 * by a test so it cannot quietly grow a `level` field.
 */
export function patientFacingCrisisMessage(
  country?: string | null,
  /*
   * 🔴 0088 — the operator's own entry for this country, when the caller has it.
   *
   * Passed rather than read, because this function is pure and is called from
   * paths with no database in hand. A configured line wins; without one the
   * verified fallback table answers; without that the sentence that is true
   * everywhere.
   */
  configured?: { label: string | null; tel: string | null } | null,
  now: Date = new Date(),
): {
  message: string;
  helpline: string | null;
} {
  /*
   * 🔴 21R.8 / C98 — the number depends on where they are, and is null when we
   * do not know a verified one.
   *
   * This returned `988` to everybody. It is the United States lifeline, this
   * product's first market is Egypt, and a patient in crisis given a number
   * that does not dial has been handed something worse than nothing. Where
   * there is no verified line the message names the local emergency number,
   * which is true from any phone in any country.
   */
  const line = crisisLine(country, configured);
  const lead = "Your therapist has been notified and is here with you. If you need immediate help right now,";

  if (!line) {
    return {
      message: `${lead} call your local emergency number. It is free from any phone.`,
      helpline: null,
    };
  }

  /*
   * 🔴 W1-29: "at any time" only for a line that answers at any time.
   *
   * Egypt's 105 keeps office hours (RESEARCH-2 section 1), and this said "call
   * or text 105 at any time" on a Friday night. A line that may be closed is
   * named with an always-open emergency number, and the open one comes first.
   */
  if (line.hours === "always") {
    return { message: `${lead} you can call or text ${line.label} at any time.`, helpline: line.label };
  }
  const always = (EMERGENCY_LINES[(country ?? "").trim().toUpperCase()] ?? [])[0] ?? null;
  if (!always) {
    return {
      message: `${lead} you can call ${line.label}, or your local emergency number at any time.`,
      helpline: line.label,
    };
  }
  const open = lineOpenAt(line, now);
  return {
    message:
      open === true
        ? `${lead} you can call ${line.label} now, or ${always.label} at any time.`
        : `${lead} call ${always.label} at any time. ${line.label} answers during office hours.`,
    helpline: open === true ? line.label : always.label,
  };
}
