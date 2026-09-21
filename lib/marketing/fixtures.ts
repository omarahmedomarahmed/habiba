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
 * 🔴 THE RADAR'S OWN CARD HAS NO FIXTURE, AND THAT IS THE RIGHT ANSWER RATHER THAN AN
 * OMISSION.
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
 *
 * 🔴 `RADAR_DEMO` BELOW IS NOT THAT, and for 147 lines this comment claimed it did not
 * exist. The distinction it was drawing is real and worth keeping:
 *
 *   the live board   a section of the page, wired to /api/radar, real clinicians
 *   RADAR_DEMO       three invented ones INSIDE the phone mockup
 *
 * The mockup is a walkthrough. It has to be able to open a booking sheet, show a price
 * with tax on it and land on a confirmation, on demand, from a click, in a device frame,
 * at three in the morning when nobody is on shift. The live board cannot do any of that
 * and should not learn how. So the fixture is for the FLOW, and the live data is for the
 * claim, and neither one is standing in for the other.
 */

/* ─────────────────────────────────────────────────── the two admin portals ──
 *
 * 🔴 76.71 — A NUMBER IN A CARD IS NOT A PORTAL.
 *
 * The company and clinic demos were a meter, a chart and a two-column rules
 * panel each. Both are true and neither answers the question a buyer arrives
 * with, which is *what will I be looking at on a Tuesday*. So the demos below
 * draw the portal: a sidebar, the screens on it, the buttons that are there and
 * the ones that deliberately are not.
 *
 * Same rule as everything else in this file. Invented people, surnames Demo and
 * Example, no import, no query, no path from a row to here.
 */

/**
 * The practice's clinicians, with verification exactly as the portal shows it.
 *
 * 🔴 THERE IS NO `sessions` FIELD, and removing it was a fix rather than a
 * tidy-up. The clinic console rendered "46 sessions this month" under each
 * name; `components/clinic/people-list.tsx:32` is explicit that a real row
 * shows no caseload size and no session count, because a practice that can see
 * "Dr Salma: 46" beside "Dr Youssef: 12" has a performance-management surface
 * built out of clinical volume. A fixture that carries the number is a fixture
 * somebody renders, so the number is not here to render.
 *
 * `earnedCents` stays: a clinic pays its clinicians and the earnings screen is
 * a real screen. What it must not do is divide that by a session count.
 */
export const CLINIC_TEAM: {
  name: string;
  verify: "verified" | "pending" | "none";
  earnedCents: number;
  payout: "none" | "requested" | "paid";
}[] = [
  { name: "Dr Nour Demo", verify: "verified", earnedCents: 214_000, payout: "requested" },
  { name: "Dr Karim Example", verify: "verified", earnedCents: 176_000, payout: "paid" },
  { name: "Dr Salma Demo", verify: "verified", earnedCents: 143_000, payout: "none" },
  { name: "Dr Youssef Example", verify: "pending", earnedCents: 54_000, payout: "none" },
  { name: "Hana Demo", verify: "none", earnedCents: 0, payout: "none" },
];

/**
 * This week's appointments.
 *
 * A clinician, a patient's name and a time, and nothing else: C260's own
 * wording is *a name and a time, because you pay for the hour*. There is no
 * column here for a reason, a note or a state of mind, and there is no such
 * column on the real screen either.
 */
export const CLINIC_WEEK: {
  day: string;
  time: string;
  clinician: string;
  patient: string;
  modality: "video" | "in person";
}[] = [
  { day: "Mon", time: "09:00", clinician: "Dr Nour Demo", patient: "Mariam A.", modality: "video" },
  { day: "Mon", time: "11:30", clinician: "Dr Karim Example", patient: "Omar S.", modality: "in person" },
  { day: "Tue", time: "10:00", clinician: "Dr Nour Demo", patient: "Laila F.", modality: "video" },
  { day: "Tue", time: "16:00", clinician: "Dr Salma Demo", patient: "Tarek M.", modality: "video" },
  { day: "Wed", time: "09:30", clinician: "Dr Karim Example", patient: "Dina H.", modality: "in person" },
  { day: "Thu", time: "14:00", clinician: "Dr Salma Demo", patient: "Adam R.", modality: "video" },
];

/**
 * 🔴 ONE TOTAL FOR THE PERIOD, NEVER A LINE PER SESSION.
 *
 * `clinic.apply.seesBills` promises exactly that, and a demo bill itemised by
 * session would show the practice a count of each clinician's patients, which
 * is the thing the promise is protecting.
 */
export const CLINIC_BILL = {
  period: "1 to 31 March",
  seats: 11,
  seatCents: 7_200,
  totalCents: 79_200,
  status: "paid" as const,
};

/**
 * What a sponsoring employer sees: therapists paid, and how much.
 *
 * 🔴 NOT ONE PATIENT NAME, and that is the entire product decision. The
 * employer funds the pot and reads the invoice; who walked through the door is
 * not theirs to know, and a demo that showed it would be demonstrating the
 * opposite of what is sold.
 */
/**
 * 🔴 AMOUNTS, NOT COUNTS. The `sessions` field is gone for the same reason.
 *
 * `app/(sponsor)/sponsor/page.tsx:26` states the rule as SPEND, NEVER SESSION
 * COUNTS, NEVER PEOPLE, and `lib/data/sponsors.ts:96` calls the sponsor select
 * list "THE WALL", saying in as many words that it holds no therapist and no
 * count, with `verify:sprint53` asserting against it by name. A company sees
 * what it paid a clinician because it is paying them. It does not see how many
 * of its employees sat in front of them.
 */
export const COMPANY_PAID: { therapist: string; cents: number }[] = [
  { therapist: "Dr Nour Demo", cents: 84_000 },
  { therapist: "Dr Karim Example", cents: 66_000 },
  { therapist: "Dr Salma Demo", cents: 54_000 },
  { therapist: "Dr Hana Example", cents: 36_000 },
];

/** The joining code and how far the roster has got. */
export const COMPANY_CODE = {
  code: "NILE-7742",
  domain: "example.com",
  employees: 240,
  joined: 63,
  usedThisMonth: 40,
};

/* ────────────────────────────────────────────── the patient's own app ── */

/**
 * 🔴 76.81 — CLINICIANS FOR THE PHONE MOCKUP, and yes, this file deleted some
 * once. The note further up says why that was right and why this is different.
 *
 * Sprint 65 wrote three invented clinicians here so a marketing page could draw
 * the radar's own card, then deleted them, because the homepage's fold IS the
 * live radar with the real board on it: a fixture card beside a live map is a
 * worse demonstration of the same component and a second thing to keep in step.
 *
 * That argument is about a card NEXT TO the live map. This is a phone, in a
 * hero, that a visitor taps through until they have booked — and the one thing
 * it must never do is book anything. A demo wired to the live radar would show
 * an empty map at three in the morning and, worse, would need a code path from
 * a marketing page to a real clinician's calendar. There is no such path, and
 * these rows are how it stays that way.
 *
 * Invented people, surnames Demo and Example, and the licence numbers are the
 * DEMO- prefix `scripts/demo.ts` uses for exactly this reason.
 */
export const RADAR_DEMO: {
  name: string;
  title: string;
  languages: string;
  priceCents: number;
  minutes: number;
  free: boolean;
  /**
   * 🔴 ISO-3166 alpha-2, UPPERCASE, because the radar places a dot by looking
   * this up in a table keyed that way. Migration 0114 exists because the demo
   * seed wrote 'eg' into the real column and two clinicians were online in
   * Cairo with no dot on the world for weeks. The fixture that feeds the
   * marketing mockup is the same trap with no database to catch it.
   *
   * Egypt for all three: it is the launch market, and a mockup that scatters
   * invented clinicians across four continents promises coverage we do not
   * have.
   */
  country: string;
}[] = [
  { name: "Dr Nour Demo", title: "Psychotherapist", languages: "Arabic, English", priceCents: 6_000, minutes: 50, free: true, country: "EG" },
  { name: "Dr Karim Example", title: "Clinical psychologist", languages: "Arabic", priceCents: 7_500, minutes: 50, free: true, country: "EG" },
  { name: "Dr Salma Demo", title: "Counsellor", languages: "Arabic, English, French", priceCents: 5_000, minutes: 30, free: true, country: "EG" },
];

/** What the patient's billing tab shows: one settled session and one waiting. */
export const PATIENT_BILLS: { what: string; when: string; cents: number; paid: boolean }[] = [
  { what: "Session with Dr Nour Demo", when: "12 March", cents: 6_000, paid: false },
  { what: "Session with Dr Nour Demo", when: "5 March", cents: 6_000, paid: true },
];
