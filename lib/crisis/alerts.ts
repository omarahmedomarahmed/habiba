import "server-only";

import { stillCounts } from "@/lib/crisis/context";
import {
  FINAL_STAGE,
  MAX_OUT_OF_BAND_ATTEMPTS,
  crisisDueAt,
  dedupDecision,
  escalateAtFor,
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
  /* 🔴 F5: the Egyptian future, "I will kill myself", in two common shapes. */
  "هنتحر",
  "هموت نفسي",
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
  /* 🔴 F5: the same "I will kill myself" with the vowels written out. */
  "hantehar",
  "hante7ar",
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

  const patterns = CRISIS_PATTERNS.filter(
    (pattern) => pattern.re.test(fold(text)) && stillCounts(text, pattern.label),
  ).map((pattern) => pattern.label);

  return [...script, ...arabizi, ...patterns];
}

/**
 * 🔴 F5: SHORT FORMS THAT NEED A WORD BOUNDARY AND A REFUSAL.
 *
 * "kms" (kill myself) is how a lot of people under thirty type it. As a
 * substring it is inside "kmsg" and, worse, it is a plural of kilometres: "I
 * ran 5 kms" must not page a clinician at 3am. So it is a whole word, never
 * after a number, never before a slash ("kms/h").
 */
const CRISIS_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "kms", re: /(?<![0-9][\s.,]*)(?<![a-z0-9])kms(?![a-z0-9/])/ },
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
}): Promise<CrisisAlertOutcome> {
  const [recent] = await db
    .select({ id: riskAssessments.id, level: riskAssessments.level, alertStatus: riskAssessments.alertStatus })
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.sessionId, opts.sessionId),
        gt(riskAssessments.createdAt, new Date(Date.now() - DEDUP_WINDOW_MS)),
      ),
    )
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);

  const decision = dedupDecision(recent?.level ?? null, opts.level);
  if (decision === "skip" && recent) {
    return { riskId: recent.id, action: "deduped", clinicianNotified: recent.alertStatus !== "pending" };
  }

  /* 🔴 K22: in the clinician's own language (Ruling 8), not English for all. */
  const { wordsFor } = await import("@/lib/i18n/message-words");
  const { t } = await wordsFor({ userId: opts.therapistId });

  const now = new Date();
  const minutes = await escalationMinutesNow();
  const escalateAt = escalateAtFor(now, minutes);

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
        escalateAt,
        escalationStage: 0,
        outOfBandAt: null,
        outOfBandAttempts: 0,
      })
      .where(eq(riskAssessments.id, recent.id))
      .returning({ id: riskAssessments.id });
    riskId = upgraded[0]?.id;
  } else {
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
        escalateAt,
      })
      .returning({ id: riskAssessments.id });
    riskId = inserted[0]?.id;
  }

  if (!riskId) return { riskId: null, action: "failed", clinicianNotified: false };

  // Note: the notification body never contains the matched phrases. The
  // clinician sees those in the room and in the chart, not in a push payload.
  let clinicianNotified = false;
  try {
    await db.insert(notifications).values({
      userId: opts.therapistId,
      kind: "crisis",
      title: t("talert.riskTitle"),
      body: t("talert.riskBodyLive"),
      /* The session id stays in the URL: opening the session clears this row (`markSessionNotificationsRead`). */
      actionUrl: `${alertPath(riskId)}?session=${opts.sessionId}`,
    });
    clinicianNotified = true;

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

  /* 🔴 F2: out of band, now. A send that did not leave is retried by the tick. */
  const sent = await sendOutOfBand(riskId, minutes);
  await wakeTheTickAt(sent ? escalateAt : now);

  // Logged without the matched phrases — those are the patient's words.
  log.warn("crisis alert raised", {
    session: ref(opts.sessionId),
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
 * 🔴 F2: THE ALERT, OUT OF BAND, TO THE CLINICIAN IT IS FOR.
 *
 * Email always (every clinician has an address), WhatsApp too when a channel
 * is configured and the template approved, through `notify()`: no new
 * provider. The link opens a signed-in page with an Acknowledge button. It is
 * deliberately not a link that acknowledges by being opened: mail scanners
 * open every link in a message, and an alert acknowledged by a spam filter is
 * an alert nobody escalates.
 *
 * Records the attempt either way, and when it left. Never throws.
 */
async function sendOutOfBand(riskId: string, minutes: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        therapistId: riskAssessments.therapistId,
        organizationId: riskAssessments.organizationId,
        attempts: riskAssessments.outOfBandAttempts,
        email: users.email,
        profile: users.profile,
        timezone: users.timezone,
      })
      .from(riskAssessments)
      .innerJoin(users, eq(users.id, riskAssessments.therapistId))
      .where(eq(riskAssessments.id, riskId))
      .limit(1);
    if (!row) return false;

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
        body: t("calert.body", { minutes: String(minutes) }),
        link: { label: t("calert.ack"), url: `${env.appUrl}${alertPath(riskId)}` },
        variables: [],
      },
    );

    await db
      .update(riskAssessments)
      .set({
        outOfBandAttempts: row.attempts + 1,
        outOfBandAt: delivery.sent ? new Date() : null,
        outOfBandChannels: delivery.channels,
      })
      .where(eq(riskAssessments.id, riskId));
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
 * SUPER ADMIN.
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
        inArray(users.role, ["manager", "super_admin"]),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(20);
  return rows.map((r) => ({ userId: r.id, email: r.email, phone: null, timezone: r.timezone, reader: "staff" as const }));
}

/** Tell one backup: an in-app row when they have an account, then email and WhatsApp. */
async function tellBackup(
  backup: Backup,
  alert: { riskId: string; clinician: string; minutes: number; organizationId: string },
): Promise<boolean> {
  const { wordsFor, wordsIn } = await import("@/lib/i18n/message-words");
  const { t, locale } = backup.userId ? await wordsFor({ userId: backup.userId }) : await wordsIn(null);
  const values = { clinician: alert.clinician, minutes: String(alert.minutes) };
  const body = backup.reader === "manager" ? t("calert.escBodyManager", values) : t("calert.escBody", values);

  if (backup.userId) {
    try {
      await db.insert(notifications).values({
        userId: backup.userId,
        kind: "crisis",
        title: t("calert.escSubject"),
        body,
        actionUrl: alertPath(alert.riskId),
      });
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
      subject: t("calert.escSubject"),
      body,
      /* A manager cannot open the alert (C259); they are asked to reach the clinician. */
      link: backup.userId ? { label: t("calert.ack"), url: `${env.appUrl}${alertPath(alert.riskId)}` } : null,
      variables: [alert.clinician],
    },
  );
  return delivery.sent || Boolean(backup.userId);
}

/**
 * 🔴 F2: THE MINUTE TICK'S CRISIS WORK. Escalate every alert past its deadline
 * that nobody acknowledged, and retry out-of-band sends that did not leave.
 *
 * Each escalation is CLAIMED with a conditional update on its stage before
 * anybody is told, so two ticks in the same minute tell nobody twice. Every
 * alert is caught on its own: one bad row does not stop the rest.
 */
export async function escalateCrisisAlerts(now: Date = new Date()): Promise<{ escalated: number; retried: number }> {
  const minutes = await escalationMinutesNow();
  let escalated = 0;
  let retried = 0;

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
      for (const backup of backups) {
        try {
          if (await tellBackup(backup, { riskId: row.id, clinician, minutes, organizationId: row.organizationId })) reached += 1;
        } catch (error) {
          log.warn("escalation to one backup failed", { reason: safeErrorMessage(error) });
        }
      }
      escalated += 1;
      /* Counts only, never who. */
      log.warn("crisis alert escalated", { audience: step.audience, stage: step.nextStage, backups: backups.length, reached });
    } catch (error) {
      log.error("crisis escalation failed for one alert", { reason: safeErrorMessage(error) });
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
            lt(riskAssessments.outOfBandAttempts, MAX_OUT_OF_BAND_ATTEMPTS),
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
  sessionId: string;
  level: RiskLevel;
  createdAt: Date;
  isTheirs: boolean;
  clinician: string;
  escalationStage: number;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
} | null> {
  if (!/^[0-9a-f-]{36}$/i.test(riskId)) return null;
  const [row] = await db
    .select({
      id: riskAssessments.id,
      sessionId: riskAssessments.sessionId,
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
    .innerJoin(users, eq(users.id, riskAssessments.therapistId))
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

  return {
    id: row.id,
    sessionId: row.sessionId,
    level: row.level,
    createdAt: row.createdAt,
    isTheirs: row.therapistId === actor.userId,
    clinician: `${row.firstName} ${row.lastName}`.trim(),
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
 */
export async function acknowledgeCrisisAlert(
  riskId: string,
  actor: { userId: string; organizationId: string; role: string },
): Promise<boolean> {
  const viewed = await alertForViewer(riskId, actor);
  if (!viewed) return false;
  if (viewed.acknowledgedAt) return true;

  await db
    .update(riskAssessments)
    .set({ acknowledgedAt: new Date(), acknowledgedBy: actor.userId, alertStatus: "acknowledged", escalateAt: null })
    .where(and(eq(riskAssessments.id, riskId), isNull(riskAssessments.acknowledgedAt)));

  try {
    const { refreshReminderMarker } = await import("@/lib/data/reminder-marker");
    await refreshReminderMarker();
  } catch (error) {
    log.warn("crisis marker not refreshed after acknowledgement", { reason: safeErrorMessage(error) });
  }
  log.info("crisis alert acknowledged", { stage: viewed.escalationStage, byTherapist: viewed.isTheirs });
  return true;
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
        actionUrl: `${alertPath(row.id)}?session=${row.sessionId}`,
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
