/**
 * 🔴 65.17 / 65.18 / 65.19 — WHAT THE MARKETING SITE FEEDS THE REAL COMPONENTS.
 *
 * > **65.17** *The components are the REAL ones, rendered. Not screenshots that rot, not
 * > mockups drawn in a design tool: the actual sponsor spend chart, the actual radar
 * > card, the actual coverage meter, the actual note view, imported from the portal and
 * > fed fixture data. A marketing page that renders the product cannot show a product we
 * > do not have.*
 *
 * That last sentence is the whole argument. A screenshot of a feature is a claim about a
 * feature; a rendered component is the feature, and it stops working the day somebody
 * removes it. `verify:reachable` already proves a component is wired to something; this
 * makes the marketing site one of the things it is wired to.
 *
 * ## 🔴 65.19 — SYNTHETIC, AND THAT IS NOT NEGOTIABLE
 *
 * > *Fixtures are synthetic, and that is not negotiable. They come from the simulation's
 * > SHAPE, never from its rows. No name, no note, no session that traces to a person,
 * > seeded or otherwise. C127 does not have a marketing exemption.*
 *
 * So this file is **hand-written constants and nothing else**. It imports no database
 * module, it runs no query, and there is no code path by which a row could reach it. The
 * names below are invented; the curve below is a shape somebody typed; the note is
 * written for this file.
 *
 * 🔴 THE OBVIOUS BUILD IS A SCRIPT THAT READS THE DEMO SEED AND WRITES THIS FILE, and it
 * is the one thing 65.19 forbids. The demo seed is a database, a database gets restored
 * from somewhere, and "it was only the demo data" is the sentence at the front of every
 * incident of this kind. A file with no import cannot leak.
 *
 * 🔴 AND IT IS NOT IN `lib/data/`. Nothing here is data about anybody. It lives beside
 * the marketing site it exists for, so `verify:principals` reads it as what it is.
 */

/** A spend curve with a real shape: a slow start, a January rise, a plateau. */
export const SPEND_CURVE: { week: string; cents: number }[] = [
  { week: "W1", cents: 18_000 },
  { week: "W2", cents: 24_000 },
  { week: "W3", cents: 21_000 },
  { week: "W4", cents: 33_000 },
  { week: "W5", cents: 47_000 },
  { week: "W6", cents: 52_000 },
  { week: "W7", cents: 49_000 },
  { week: "W8", cents: 61_000 },
];

/**
 * 🔴 A POT, PART SPENT. The three states of the meter are a design decision and this
 * fixture sits in the middle one deliberately: a full pot shows nothing and an empty one
 * looks like a product somebody abandoned.
 */
export const POT = {
  addedCents: 1_000_000,
  remainingCents: 412_000,
  expiresLabel: "31 March 2027",
};

/** Seats, at the band boundary, because that is where the ladder is worth showing. */
export const CLINIC = {
  seats: 11,
  monthlyCents: 39_500,
};

/**
 * 🔴 A NOTE, AND IT IS ABOUT NOBODY.
 *
 * Written for this file rather than lifted from anywhere. The clinical shape is real —
 * this is what `NoteContent` looks like — and the content is deliberately unremarkable,
 * because a marketing page is not the place to demonstrate an interesting presentation.
 */
export const NOTE = {
  subjective: "Sleeping better on four of seven nights. Describes the evenings as easier.",
  objective: "Arrived on time. Engaged throughout. No acute distress observed.",
  assessment: "Improvement on the sleep goal set last session. Mood reported as steadier.",
  plan: "Continue the wind-down routine. Review in two weeks.",
};

/** What a patient is sent afterwards. Plain language, no diagnosis, no impressions. */
export const PATIENT_BRIEF =
  "Two of seven nights went better, and that is worth naming. Keep the wind-down going and we will look at it again in two weeks.";

/*
 * 🔴 THERE ARE NO RADAR FIXTURES, AND THAT IS THE RIGHT ANSWER RATHER THAN AN OMISSION.
 *
 * Sprint 65 wrote three invented clinicians here so a marketing page could render the
 * radar's own card, and then deleted them: the homepage's fold IS the live radar, with
 * the real board on it. A fixture card beside a live map is a worse demonstration of the
 * same component and a second thing to keep in step with it.
 *
 * 65.17's rule is that the marketing site renders the real component. On this one the
 * site goes further and renders the real DATA, which is the only case in this file where
 * that is safe: the public radar is already public, and `shapeBoard` is what decides
 * what a stranger may see of a clinician.
 */
