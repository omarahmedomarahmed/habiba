/**
 * 🔴 Sprint 57 — the gate that did not exist.
 *
 * ## Why this file is here
 *
 * Forty-two verifiers and 476 tests point at code. Not one of them asks whether a
 * sentence on a public page is TRUE.
 *
 * So we published "Risk language is never missed" over a classifier whose own
 * recorded evaluation names two cases it misses on purpose — a person describing
 * letters left in a drawer, and `لا يوجد سبب يجعلني أكمل`. And we published "Talk
 * to a real therapist in the next sixty seconds" against a standing rule, written
 * by us, that forbids response-time promises in a crisis product.
 *
 * Both survived every gate in this repository because marketing copy is a string,
 * and every string gate we own counts whether a string is TRANSLATED, never
 * whether it is TRUE.
 *
 * ## What this checks, and what it deliberately cannot
 *
 * It cannot judge truth. What it can do is refuse the two SHAPES of sentence that
 * are almost never true in this product and are catastrophic when they are not:
 *
 *   1. An ABSOLUTE next to something a model produced. "Never", "always", "every",
 *      "guaranteed" about a detector, a transcript or a note. A model is
 *      probabilistic; a guarantee over one is a claim nobody can keep.
 *   2. A RESPONSE-TIME PROMISE of any kind. C275: "24/7" describes the radar being
 *      open, never that anybody will answer. No response-time promise appears
 *      anywhere in this product, ever.
 *
 * Both are checked in BOTH languages, because the Arabic page is written from
 * scratch rather than translated and can therefore drift on its own.
 *
 * ## The control
 *
 * Every absence assertion here is bracketed by a planted offender, because "no
 * banned phrase found" is exactly what a scanner that reads nothing also reports.
 * That is the §6 family and it is the reason this file has controls at all.
 */
import { readFileSync } from "node:fs";

import { DEFAULT_PAGES } from "../lib/content/defaults";
import { DEFAULT_PAGES_AR } from "../lib/content/defaults-ar";
import { DICTIONARIES } from "../lib/i18n/messages";
import { SETTINGS_DEFAULTS, seatMonthlyCents } from "../lib/settings/defs";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `, ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------- the rules -- */

/**
 * A promise about how fast a person will be reached.
 *
 * "Within minutes", "in sixty seconds", "minutes rather than weeks", "right
 * away". The unit does not matter and neither does the number: what is banned is
 * the shape, because a person in distress reads any of them as a commitment.
 */
const A_PERSON =
  /therapist|clinician|counsell?or|somebody|someone|answer|reply|respond|reach|معالج|أحد|شخص|يرد|يجيب/i;

const A_DURATION = [
  /\b(?:in|within|under|next)\s+(?:the\s+)?(?:a\s+)?[\w-]*\s*(?:second|minute|hour)s?\b/i,
  /\bminutes?\s+(?:rather\s+than|not|instead\s+of)\b/i,
  /\bright\s+away\b/i,
  /خلال\s+(?:دقيقة|دقائق|ثانية|ثوان|ساعة)/,
  /دقائق\s+بدل/,
  /*
   * 🔴 C375 — bare `فورًا` WAS here and is gone, and the removal is a decision
   * rather than a retreat.
   *
   * "Immediately", with no unit attached, is how Arabic describes a SYSTEM
   * acting: "stopping consent stops any new reading فورًا", "the invite link
   * works فورًا", "we show you فورًا where to find help". All three are true,
   * all three are about our own interface, and all six Arabic flags on this
   * rule's first real run were that word.
   *
   * The banned shape is a PROMISE ABOUT A PERSON'S AVAILABILITY, and in both
   * languages that carries a UNIT: sixty seconds, a minute, an hour, خلال
   * دقيقة. The sentence we actually shipped and removed in sprint 57 is
   * `تحدّث إلى معالج حقيقي خلال دقيقة`, which `خلال\s+دقيقة` still catches, and
   * a control below asserts exactly that so this narrowing cannot quietly
   * become an off switch.
   *
   * The English `right away` stays: it has no innocent system-behaviour usage
   * in this product's copy, and the proximity and negation rules bound it.
   */
];

/*
 * 🔴 The duration alone is not the offence.
 *
 * "Sign up and start a session in under a minute" is a claim about OUR interface,
 * which we control and can keep. "Talk to a therapist in the next sixty seconds"
 * is a claim about a stranger's availability, which we cannot. The rule fires only
 * where a duration sits beside a PERSON, because that is the sentence a patient in
 * distress reads as a commitment.
 */
/*
 * 🔴 Proximity, and the reason is this file's own copy.
 *
 * The sentence that now tells the truth about the detector reads "Every segment is
 * scanned as it arrives … it misses things, it raises false alarms". It contains an
 * absolute AND a performance word, two hundred characters apart, saying opposite
 * things. A rule that only asked "does the string contain both" flagged the very
 * sentence written to fix the defect.
 *
 * A claim of perfection is ADJACENT: "never missed", "always caught", "100%
 * accurate". So the two must sit within one clause of each other.
 */
const NEAR = 40;

function claimsPerfection(text: string): boolean {
  const abs = [...text.matchAll(new RegExp(ABSOLUTE.source, "gi"))];
  const perf = [...text.matchAll(new RegExp(PERFORMANCE.source, "gi"))];
  return abs.some((a) => perf.some((p) => Math.abs((a.index ?? 0) - (p.index ?? 0)) <= NEAR));
}

/*
 * 🔴 C375 — TWO THINGS THIS RULE COULD NOT DO, both exposed the moment it was
 * pointed at the dictionary instead of nine marketing pages.
 *
 * 1. NO PROXIMITY. `claimsPerfection` requires its two halves within one clause
 *    (NEAR = 40). This asked only "does the string contain a duration ANYWHERE
 *    and a person ANYWHERE", so "stopping consent stops any new reading
 *    immediately, and it does not erase what the therapist has already read"
 *    matched: `فورًا` in the first clause, `المعالج` in the second, about
 *    entirely different things.
 *
 * 2. NO NEGATION. `contact.urgentBody` reads "This reaches a person during
 *    working hours, NOT in the next ten minutes". That sentence exists to
 *    REFUSE the promise, and the rule flagged it as making one. A gate that
 *    flags the disclaimer written to satisfy it is a gate somebody deletes.
 *
 * Both were invisible while the corpus was small enough that neither shape
 * occurred. That is the argument for widening a gate's corpus rather than
 * trusting a clean run on a tenth of it.
 */
const NEAR_PERSON = 60;

/** "not in the next ten minutes" is a refusal, not a promise. */
const DENIED = /\b(?:not|never|no|rather\s+than|instead\s+of)\b|(?:ليس|ليست|لن|بدل|لا\s)/i;

function promisesAPerson(text: string): boolean {
  for (const rule of A_DURATION) {
    const duration = new RegExp(rule.source, rule.flags.includes("g") ? rule.flags : rule.flags + "g");
    for (const hit of text.matchAll(duration)) {
      const at = hit.index ?? 0;

      /*
       * 🔴 A denial disarms the duration ONLY IF IT GOVERNS IT, and the first
       * version's forty-character window did not check that.
       *
       * `pbook.taken` read "if they do NOT go ahead, this clinician frees up
       * within a minute". That is a promise about a person's availability with
       * an unrelated "not" fourteen words earlier, and the rule waved it
       * through while correctly flagging the identical Arabic sentence, which
       * happens to phrase its negation differently.
       *
       * So the window stops at the nearest clause break. A denial on the other
       * side of a comma is a different statement.
       */
      const lead = text.slice(Math.max(0, at - 40), at);
      const clause = lead.slice(Math.max(...[...lead.matchAll(/[.,;:،؛]/g)].map((m) => m.index! + 1), 0));
      if (DENIED.test(clause)) continue;

      const window = text.slice(Math.max(0, at - NEAR_PERSON), at + hit[0].length + NEAR_PERSON);
      if (A_PERSON.test(window)) return true;
    }
  }
  return false;
}

/** Words that assert certainty. */
/*
 * 🔴 `\b` does not work in Arabic script: the engine sees no word boundary between
 * an Arabic letter and the next, so `/\bأبدًا\b/` never matches anything. The first
 * version of this rule had one, and the control for the Arabic sentence we actually
 * shipped failed while the English one passed. Latin alternation keeps the
 * boundary; Arabic alternation must not have one.
 */
const ABSOLUTE =
  /\b(?:never|always|every|all|guarantee[ds]?|guaranteed|100%|no\s+exceptions?)\b|(?:أبدًا|دائمًا|نضمن|مضمون)/i;

/*
 * 🔴 Not "an absolute about the AI" — an absolute about HOW WELL it performs.
 *
 * "Every read of a chart is written to an append-only audit log" is an absolute
 * and it is TRUE: it describes a mechanical guarantee the database keeps. "Risk
 * language is never missed" is an absolute about ACCURACY, and no probabilistic
 * detector can keep one. The first version of this rule could not tell them apart
 * and flagged fifteen true sentences, which is how a gate gets switched off.
 */
const PERFORMANCE =
  /\b(?:miss(?:ed|es)?|catch|caught|detect\w*|accurat\w*|correct|error|wrong|fail\w*|perfect|reliab\w*|spot(?:s|ted)?)\b|(?:تفوت|يفوت|تلتقط|دقيق|خطأ|تفشل|مثالي|موثوق)/i;

/* --------------------------------------------------------- the harvester -- */

/** Every human-readable string in a page tree, with a path to find it again. */
function strings(node: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof node === "string") {
    if (node.trim().length > 12) out.push({ path, text: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => strings(item, `${path}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      // Keys that hold identifiers, not prose.
      if (["slug", "icon", "demo", "type", "href", "key"].includes(key)) continue;
      strings(value, `${path}.${key}`, out);
    }
  }
}

function harvest(pages: unknown, label: string) {
  const out: { path: string; text: string }[] = [];
  strings(pages, label, out);
  return out;
}

/* ------------------------------------------------------------ the checks -- */

const DICTIONARY_STRINGS = Object.entries(DICTIONARIES).flatMap(([locale, dict]) =>
  Object.entries(dict).map(([key, text]) => ({ path: `${locale}:${key}`, text: String(text) })),
);

const EN = harvest(DEFAULT_PAGES, "en");
const AR = harvest(DEFAULT_PAGES_AR, "ar");

console.log(`\nPublic claims: ${EN.length} English strings, ${AR.length} Arabic\n`);

check(
  "the harvester actually reads the pages",
  EN.length > 40 && AR.length > 40,
  `en=${EN.length} ar=${AR.length}`,
);

function scan(corpus: { path: string; text: string }[], label: string) {
  const timed = corpus.filter((s) => promisesAPerson(s.text));
  check(
    `🔴 C275 ${label}: no promise about how fast a PERSON will answer`,
    timed.length === 0,
    timed.map((s) => `${s.path}: "${s.text.slice(0, 70)}"`).join(" · "),
  );

  const claimed = corpus.filter((s) => claimsPerfection(s.text));
  check(
    `🔴 ${label}: no absolute claim about how WELL anything performs`,
    claimed.length === 0,
    claimed.map((s) => `${s.path}: "${s.text.slice(0, 70)}"`).join(" · "),
  );
}

scan(EN, "EN");
scan(AR, "AR");

/*
 * 🔴 C374 — THE DICTIONARY, which this never scanned for the two rules that
 * matter most.
 *
 * `DICTIONARIES` was added for C291's subscription rule and nothing else. The
 * response-time rule and the absolute-performance rule ran only over
 * `DEFAULT_PAGES`, which is the CMS content: nine marketing pages. Every other
 * sentence this product renders, on every screen a patient or a clinician
 * actually uses, lives in `messages.ts` and was never read.
 *
 * So the gate built because "marketing copy is a string and every string gate
 * we own counts whether a string is TRANSLATED, never whether it is TRUE" was
 * itself only looking at the marketing copy. A gate that reads a tenth of the
 * strings reports a clean run on the tenth it read, which is C363's shape and
 * the reason this file has controls at all.
 */
scan(
  DICTIONARY_STRINGS.filter((s) => s.path.startsWith("en:")),
  "EN dictionary",
);
scan(
  DICTIONARY_STRINGS.filter((s) => s.path.startsWith("ar:")),
  "AR dictionary",
);

/* ---------------------------------------------------------- the controls -- */

/*
 * 🔴 Both assertions above are ABSENCES, and an absence passes just as happily
 * against a scanner that matches nothing at all. So each rule is proved against
 * a sentence that should fail it.
 */
const PLANTED_TIME = [
  { path: "control", text: "Talk to a real therapist in the next sixty seconds" },
  { path: "control", text: "تحدّث إلى معالج حقيقي خلال دقيقة" },
];
check(
  "🔴 CONTROL the response-time rule catches the sentence we actually shipped",
  PLANTED_TIME.every((s) => promisesAPerson(s.text)),
);

const PLANTED_ABSOLUTE = [
  { path: "control", text: "Risk language is never missed" },
  { path: "control", text: "لغة الخطر لا تفوتنا أبدًا" },
];
check(
  "🔴 CONTROL the absolute rule catches the sentence we actually shipped",
  PLANTED_ABSOLUTE.every((s) => claimsPerfection(s.text)),
);

check(
  "🔴 C375 CONTROL a DENIAL of a response-time promise is not flagged as one",
  !promisesAPerson("This reaches a person during working hours, not in the next ten minutes.") &&
    !promisesAPerson("لن يرد عليك أحد خلال دقائق.") &&
    // 🔴 …and a denial on the FAR side of a comma does not disarm anything.
    promisesAPerson("If they do not go ahead, this clinician frees up within a minute."),
  "the sentence written to refuse the promise must not be read as making it",
);

check(
  "🔴 C375 CONTROL …and a duration far from a person, about something else, is not",
  !promisesAPerson(
    "Stopping consent stops any new reading immediately. It does not erase what the therapist has already read, and nothing is deleted.",
  ),
  "one clause about our system, another about a person, is not a promise about a person",
);

check(
  "🔴 C375 CONTROL …while the real thing is STILL caught",
  promisesAPerson("Talk to a real therapist in the next sixty seconds") &&
    promisesAPerson("تحدّث إلى معالج حقيقي خلال دقيقة"),
  "the widening must not have switched the rule off",
);

check(
  "🔴 CONTROL a TRUE absolute and an interface-speed claim are NOT caught",
  !promisesAPerson("Sign up and start a session in under a minute") &&
    !claimsPerfection("Every read of a chart is written to an append-only audit log") &&
    !claimsPerfection(
      "Every segment is scanned as it arrives. It misses things and it raises false alarms.",
    ),
);

/* ------------------------------------------------ the claim that was meta -- */

/*
 * "Every claim on this page is a screen you can see" converted every other false
 * claim on the page into a stated lie. It is gone, and it stays gone.
 */
const META = /every claim on this page|كل ما نقوله هنا شاشة/i;
check(
  "the meta-claim that compounded every other one is gone",
  ![...EN, ...AR].some((s) => META.test(s.text)),
);
check("🔴 CONTROL the meta-claim rule would catch it", META.test("Every claim on this page is a screen you can see"));

/* ------------------------------------- the measured numbers are not hidden -- */

/*
 * We may not claim the detector is perfect. We should also not hide what it is.
 * PLAN.md C163 records sensitivity 88.2% and specificity 76.9% with two cases
 * missed on purpose; sprint 35 reports 100% sensitivity on the shipped ladder.
 * Whatever the number, the page says the detector can miss.
 */
/*
 * 🔴 THE CAVEAT IS NEVER IN THE SAME STRING AS THE CLAIM, AND THIS ASKED FOR IT
 * TO BE.
 *
 * The harvester flattens every field into its own string, so a comparison row
 * becomes `"Risk language"` and `"Scanned in Arabic and English, and the page
 * says the scan can miss."` as two separate entries. The old shape filtered to
 * strings containing "risk language" and then looked for the caveat INSIDE
 * those, which meant it was asking a two word label to carry a disclosure. It
 * passed only while some longer sentence happened to contain both phrases, and
 * went red the moment the comparison table was rewritten, on copy that says
 * "They can miss risk and can raise false alarms" in full.
 *
 * The property belongs to the PAGE, not to a string: if this language's site
 * describes automatic risk scanning, this language's site says the scan can
 * miss. Checking it per language is also stricter than before, because the old
 * version pooled English and Arabic and would have accepted an uncaveated
 * Arabic claim on the strength of the English disclosure.
 */
const SCANS = /risk language|risk scan|لغة الخطر|رصد الخطر/i;
const CAVEAT = /miss|false alarm|judgement|تفوت|إنذارات كاذبة|حكمك/i;
const unqualified = ([["en", EN], ["ar", AR]] as const)
  .filter(([, strings]) => strings.some((s) => SCANS.test(s.text)))
  .filter(([, strings]) => !strings.some((s) => CAVEAT.test(s.text)))
  .map(([locale]) => locale);

const describes = ([["en", EN], ["ar", AR]] as const)
  .filter(([, strings]) => strings.some((s) => SCANS.test(s.text)))
  .map(([locale]) => locale);

check(
  "where the page describes risk scanning, it says the scan can miss",
  unqualified.length === 0,
  unqualified.length > 0
    ? `${unqualified.join(", ")} claims a scan with no caveat`
    : describes.length > 0
      ? `${describes.join(", ")} describes it, and qualifies it`
      : "no locale claims a risk scan at all",
);

/*
 * 🔴 CONTROL — the rule has to fire on a page that claims a scan and says
 * nothing about it. Without this, "no locale claims a risk scan at all" is a
 * pass, and a check that passes on an empty site is not a check.
 */
const bare = [{ path: "control", text: "Risk language is scanned in both languages." }];
check(
  "🔴 CONTROL an uncaveated scanning claim is caught",
  bare.some((s) => SCANS.test(s.text)) && !bare.some((s) => CAVEAT.test(s.text)),
  "a claim with no disclosure beside it fails, so a green run means there is one",
);

/* ------------------------------------- a claim the product outgrew, checked -- */

/*
 * 🔴 Sprint 57 / C291 — the rule that would have caught this class of defect
 * without anybody rereading the site.
 *
 * "No subscription, no seat fee, no setup fee" was TRUE for a year and became
 * false the hour sprint 57 shipped two monthly plans. Nothing failed. A sentence
 * that was accurate when it was written is exactly the sentence nobody rereads,
 * which is the same shape as C60, where the pricing page went on selling a plan
 * that had been repriced a fortnight earlier.
 *
 * So this does not judge the sentence. It compares the copy to the PRODUCT: if
 * any tier carries a monthly price, no published string may deny that a
 * subscription exists. The copy and the tier table cannot drift apart without
 * this failing, whichever of the two moves.
 *
 * The dictionary is scanned as well as the page defaults, because the pricing
 * page's own wording lives in `messages.ts` and the first version of this file
 * read only `DEFAULT_PAGES` — a gate that reads half the copy reports a clean
 * run on the half it read.
 */
const DENIES_SUBSCRIPTION =
  /\bno\s+subscriptions?\b|\bwithout\s+a\s+subscription\b|\bnever\s+a\s+subscription\b|بلا\s+اشتراك|دون\s+اشتراك|بدون\s+اشتراك/i;

const ALL_COPY = [...EN, ...AR, ...DICTIONARY_STRINGS];

const sellsASubscription = SETTINGS_DEFAULTS.pricing.tiers.some((t) => t.monthlyCents > 0);
const denials = ALL_COPY.filter((s) => DENIES_SUBSCRIPTION.test(s.text));

check(
  `🔴 C291 the copy and the tier table agree about whether we sell a subscription (we ${sellsASubscription ? "do" : "do not"})`,
  sellsASubscription ? denials.length === 0 : true,
  denials.map((s) => `${s.path}: "${s.text.slice(0, 60)}"`).join(" · "),
);

check(
  "🔴 CONTROL the subscription rule catches the sentence we actually shipped",
  DENIES_SUBSCRIPTION.test("Joining is free. No subscription, no seat fee, no setup fee.") &&
    DENIES_SUBSCRIPTION.test("بلا اشتراك، وبلا رسوم مقعد، وبلا رسوم تجهيز."),
);

check(
  "🔴 CONTROL the harvester reaches the DICTIONARY, not only the page defaults",
  DICTIONARY_STRINGS.length > 2_000 &&
    DICTIONARY_STRINGS.some((s) => s.path === "en:pricing.noFees"),
  `${DICTIONARY_STRINGS.length} dictionary strings`,
);

/*
 * 🔴 And the reverse: a product that sells a subscription must SAY SO somewhere
 * a visitor can read, or we have shipped a price nobody can find. An absence
 * check on its own would pass against a pricing page that mentions no plan at
 * all, which is the §6 family again.
 */
const MENTIONS_MONTHLY = /\ba\s+month\b|\bmonthly\b|\bper\s+month\b|شهريًا|شهري/i;
check(
  "a monthly plan that exists is described on a page somebody can read",
  !sellsASubscription || ALL_COPY.some((s) => MENTIONS_MONTHLY.test(s.text)),
);

/* ------------------------------------------- 62.11 — the seat prices, checked -- */

/*
 * 🔴 62.11 / C323 — A SEAT PRICE ON A PAGE IS A SEAT PRICE WE CAN BE HELD TO.
 *
 * The seat ladder is rendered from `platform_settings` and nothing on the public
 * page is typed. That is the design, and this is the gate that keeps it the
 * design, because the cheapest way to add a seat figure to a marketing sentence
 * will always be to type it.
 *
 * It is the C291 shape one table over: a number that is TRUE when it is written
 * and false the hour somebody reprices, with nothing failing in between. The
 * difference here is that the number is wrong in a direction that costs money —
 * the rate is RETROACTIVE, so a marginal reading of the founder's own table
 * gives $439 at five seats against a published $400, and a clinic reading the
 * published one would be billed a figure that never appears on it.
 *
 * So: any published string that mentions seats and names a dollar figure must
 * name one this ladder actually produces. Both languages, because the Arabic
 * copy is written from scratch rather than translated and drifts on its own.
 */
const SEAT_WORDS = /\bseats?\b|مقعد|مقاعد/i;
const DOLLARS = /\$\s?([\d,]+(?:\.\d{2})?)/g;

/** Every figure the shipped ladder can put on a page, in whole-dollar strings. */
const LEGITIMATE_SEAT_FIGURES = new Set<string>();
{
  const bands = SETTINGS_DEFAULTS.pricing.seatBands;
  // The monthly total at every count a visitor can drag the slider to.
  for (let seats = 1; seats <= 500; seats += 1) {
    LEGITIMATE_SEAT_FIGURES.add((seatMonthlyCents(seats, bands) / 100).toFixed(2));
  }
  // And the per-seat rates and flat prices the table's middle column shows.
  for (const band of bands) {
    if (band.perSeatCents > 0) LEGITIMATE_SEAT_FIGURES.add((band.perSeatCents / 100).toFixed(2));
    if (band.flatCents > 0) LEGITIMATE_SEAT_FIGURES.add((band.flatCents / 100).toFixed(2));
  }
}

function seatFigureProblem(text: string): string | null {
  if (!SEAT_WORDS.test(text)) return null;

  for (const hit of text.matchAll(DOLLARS)) {
    const raw = hit[1]!.replace(/,/g, "");
    const cents = Math.round(Number(raw) * 100);
    if (!Number.isFinite(cents)) continue;
    if (!LEGITIMATE_SEAT_FIGURES.has((cents / 100).toFixed(2))) {
      return `$${raw} is not a price this seat ladder produces`;
    }
  }
  return null;
}

const seatOffenders = ALL_COPY.map((s) => ({ ...s, problem: seatFigureProblem(s.text) })).filter(
  (s) => s.problem,
);

check(
  "🔴 62.11 every seat price in published copy is one `platform_settings` produces",
  seatOffenders.length === 0,
  seatOffenders.map((s) => `${s.path}: ${s.problem}`).join(" · "),
);

/*
 * 🔴 THE CONTROL, and it is two-sided on purpose.
 *
 * An absence assertion passes just as happily against a rule that matches
 * nothing, which is this file's own §6 warning. So the planted offender is the
 * MARGINAL reading of the founder's table — the exact number a reasonable person
 * gets by adding a seat to a price — and the planted innocent is the retroactive
 * one, which must pass.
 */
check(
  "🔴 62.11 CONTROL the rule catches a seat price the ladder does not produce",
  seatFigureProblem("Five seats is $439 a month") !== null &&
    seatFigureProblem("مقاعد إضافية بـ $75 لكل مقعد") !== null,
  "the marginal reading of the founder's own table must fail this",
);

check(
  "🔴 62.11 CONTROL …while the retroactive figures on the shipped ladder pass",
  /*
   * ⚠️ These are the SHIPPED ladder's own figures and they change when it does.
   * Sprint 75 repriced it and this control went red on the old numbers, which is
   * the check doing its job: a planted innocent that no longer describes the
   * product is a control that proves nothing.
   */
  seatFigureProblem("Five seats is $360 a month") === null &&
    seatFigureProblem("Two or more seats are $72 each") === null &&
    seatFigureProblem("One seat: $80 a month") === null,
);

check(
  "🔴 62.11 CONTROL …and a dollar figure in a sentence about something else is ignored",
  seatFigureProblem("A session costs $1 plus $3 when the AI runs") === null,
  "the rule is about seat prices, not about every number on the site",
);

/*
 * 🔴 And the other direction, because an absence check alone passes against a
 * site that mentions no seat price at all: the ladder we sell must be described
 * somewhere a visitor can read, in BOTH languages.
 *
 * This is what makes the rule above a comparison rather than a ban. The page is
 * required to carry the figures AND the figures are required to match, so the
 * copy and the bill cannot drift apart whichever of the two moves.
 */
const SEAT_COPY = ["en", "ar"].map((locale) => ({
  locale,
  strings: DICTIONARY_STRINGS.filter(
    (s) => s.path.startsWith(`${locale}:pricing.seats`) && s.text.trim().length > 0,
  ),
}));

for (const { locale, strings: rows } of SEAT_COPY) {
  check(
    `🔴 62.11 the seat ladder is described in ${locale.toUpperCase()}`,
    rows.length >= 8,
    `${rows.length} seat strings`,
  );
}

/*
 * 🔴 AND THE FIGURES THEMSELVES ARE SUBSTITUTED, NEVER TYPED.
 *
 * Every seat string carrying a price must carry a PLACEHOLDER rather than a
 * number, because a placeholder is filled from the same settings row the invoice
 * reads. This is the rule that makes the comparison above almost impossible to
 * fail: there is nothing to drift.
 */
const TYPED_SEAT_PRICE = DICTIONARY_STRINGS.filter(
  (s) => /:pricing\.seats/.test(s.path) && /\$\s?\d/.test(s.text),
);
check(
  "🔴 62.11 no seat price is typed into the dictionary, they are all substituted",
  TYPED_SEAT_PRICE.length === 0,
  TYPED_SEAT_PRICE.map((s) => s.path).join(" · "),
);

check(
  "🔴 62.11 CONTROL the typed-price rule would catch one",
  /\$\s?\d/.test("Seats are $90 each"),
);

/* --------------------------------------------------------------- the log -- */

/*
 * The hazard file is read by every new contributor before their first commit. An
 * entry describing a fixed defect is a false alarm, and H20 in that same file is
 * the record of what standing false alarms do.
 */
const hazards = readFileSync("HAZARDS.md", "utf8");
check(
  "every hazard carries a status, so a fixed one cannot masquerade as live",
  /\|\s*Status\s*\|/i.test(hazards),
);

console.log(`\nverify:claims ${checks - failures}/${checks} checks pass\n`);
process.exit(failures === 0 ? 0 : 1);
