/**
 * Sprint 51 acceptance: content and design, everything.
 *
 *   npm run verify:sprint51
 *
 * ## What this sprint is answering
 *
 * 37R.8 asked whether the patient app looks like the best mental-health app
 * anybody has built or like scaffolding, and the CMS defaults were written
 * before eleven sprints of product changes. A page describing a product we no
 * longer sell is worse than no page.
 *
 * Most of 51 is judgement a script cannot hold. What a script CAN hold is the
 * part that rots silently: whether a table has a screen, whether a string is a
 * literal, whether an em dash got in, whether a price is written into prose.
 * Those are the checks here, and each one is a thing that has already gone
 * wrong in this repository at least once.
 */
import { readFileSync } from "node:fs";

import { literalsIn } from "./_i18n-coverage";
import { NO_SCREEN_BY_DESIGN, scanReachability } from "./_reachability";
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

async function main() {
  /* ------------------------------------------- 51.6 · every table has a screen -- */

  /*
   * 🔴 The check that closes 37R.21, 37R.22 and C179.
   *
   * `session_sources` and `session_voices` each had a table, a migration with
   * CHECK constraints, a service and triggers, and no interface at all. A
   * table nobody can see is a table whose constraints nobody can check.
   */
  const { tables, orphans } = scanReachability();
  const unexplained = orphans.filter((o) => !(o.table in NO_SCREEN_BY_DESIGN));

  check(
    "🔴 51.6 every table a human should reach has a page a human can reach",
    unexplained.length === 0,
    unexplained.length === 0
      ? `${tables} tables, ${Object.keys(NO_SCREEN_BY_DESIGN).length} exempt with a reason`
      : unexplained.map((o) => `${o.table} (${o.holders[0] ?? "no reader"})`).join(", "),
  );

  /*
   * 🔴 CONTROL — the exemptions are still orphans.
   *
   * An allowlist is where an orphan goes to be forgotten. If an exempt table
   * has since acquired a screen, the exemption is a stale rule nobody is
   * checking, and leaving it there would let a FUTURE orphan of the same name
   * inherit somebody's old argument. So the list has to stay true in both
   * directions.
   */
  const orphaned = new Set(orphans.map((o) => o.table));
  const stale = Object.keys(NO_SCREEN_BY_DESIGN).filter((t) => !orphaned.has(t));

  check(
    "🔴 CONTROL the no-screen exemptions are each still genuinely unreachable",
    stale.length === 0,
    stale.length === 0
      ? "no stale exemption hiding behind an old argument"
      : `${stale.join(", ")} now HAS a screen, so the exemption is a rule nobody is checking`,
  );

  /*
   * 🔴 CONTROL — and the scanner can still SEE an orphan.
   *
   * Every check above is an absence assertion, and an absence assertion that
   * measures nothing passes. `scanReachability` has been wrong twice already
   * (it counted schema imports, then it counted API routes as pages), and both
   * times it reported a clean-looking answer. This plants nothing and instead
   * asserts against a table we know the answer for: `patient_auth_sessions` is
   * unreachable and must be seen as such.
   */
  check(
    "🔴 CONTROL the scanner still detects an unreachable table",
    orphans.length > 0 && orphaned.has("patient_auth_sessions"),
    orphans.length > 0
      ? `${orphans.length} found, including the known one`
      : "THE SCANNER SEES NOTHING, so the check above is a false green",
  );

  /* --------------------------------- 51.6 · the two tables this sprint closes -- */

  /*
   * Named individually rather than left to the aggregate. The aggregate goes
   * green the moment somebody adds an exemption, and these two are the ones
   * 51.6 puts in writing.
   */
  for (const table of ["session_sources", "session_voices"]) {
    check(
      `51.6 ${table} has an interface, not a ticket`,
      !orphaned.has(table),
      orphaned.has(table) ? "STILL ORPHANED" : "reachable from the session page",
    );
  }

  /*
   * 🔴 37.2 — an unrecognised voice is a NUMBERED SPEAKER, never a guess.
   *
   * The new screen is the first place that rule could be broken by a control
   * rather than by a column, so it is asserted against the source: the panel
   * offers two bindings and no third, and `bound_by` still has no "model".
   */
  const voicesPanel = readSource("components/session/voices-panel.tsx");
  check(
    "🔴 37.2 the voices screen offers a person's decision and never a guess",
    /"therapist"/.test(voicesPanel) &&
      /"patient"/.test(voicesPanel) &&
      !/\bmodel\b|likely|probabl|confidence|suggest/i.test(voicesPanel),
    "two bindings, both a named human saying so",
  );

  /*
   * 🔴 C132 / 41 — the recorder joins meetings WE created, nothing else.
   *
   * The source screen is where somebody would first try to add a paste box, so
   * it must carry no text input at all. The rule is stated in a sentence
   * instead, because a clinician who wonders why deserves the reason rather
   * than a disabled control.
   */
  const sourcePanel = readSource("components/session/source-panel.tsx");
  check(
    "🔴 C132 the source screen has nowhere to paste a meeting link",
    !/<input|<textarea/.test(sourcePanel) && /onlyOurs/.test(sourcePanel),
    "no input of any kind, and the rule said in words",
  );

  /* ------------------------------------------------ 51.8 · the em dash ban (C117) -- */

  /*
   * 🔴 Across every SHIPPED string, not only this sprint's.
   *
   * verify:sprint24 already bans them in its own scope. 51.8 widens it to the
   * dictionary and the CMS defaults, which are the two files a content sprint
   * actually edits and the two most likely to acquire one by paste.
   */
  /*
   * 🔴 The two characters, BUILT rather than typed.
   *
   * Writing them literally would put an em dash and an en dash into this file,
   * and `verify:sprint24` scans every source file for exactly those two
   * characters. A dash checker that fails the dash check is the same shape as
   * the NUL scanner in 45.0, which plants its NUL with `String.fromCharCode`
   * so the file never acquires the byte it forbids.
   */
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  const hasDash = (line: string) => {
    const quoted = line.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
    return quoted.some((q) => q.includes(EM) || q.includes(EN));
  };

  const stringFiles = [
    "lib/i18n/messages.ts",
    "lib/content/defaults.ts",
    "lib/content/defaults-ar.ts",
  ];

  const offenders: string[] = [];
  for (const file of stringFiles) {
    const raw = readFileSync(file, "utf8");
    // Quoted string content only: a prose dash in a code comment is this
    // repository's own house style and not a thing a reader ever sees.
    raw.split("\n").forEach((line, index) => {
      if (hasDash(line)) offenders.push(`${file}:${index + 1}`);
    });
  }

  check(
    "🔴 51.8 / C117 no em dash or en dash in any shipped string",
    offenders.length === 0,
    offenders.length === 0 ? `${stringFiles.length} string files clean` : offenders.join(", "),
  );

  /*
   * 🔴 CONTROL — and the scan can see one.
   *
   * The same absence-assertion trap. A regex typo, a wrong escape, a file list
   * that does not resolve: all of them produce "0 offenders" and a green line.
   */
  const planted = [`  "x.y": "a ${EM} b",`, `  "x.z": "a ${EN} b",`];
  const seen = planted.filter(hasDash);

  check(
    "🔴 CONTROL the dash scan catches a planted em dash and en dash",
    seen.length === 2,
    `${seen.length} of 2 planted dashes caught`,
  );

  /* ------------------------------------------------------ 51.7 · the bookings page -- */

  /*
   * 🔴 The three rules 51.7 asks for that were ALREADY BUILT, pinned here so
   * the next person does not rebuild them as this sprint nearly did.
   *
   * "A confirmed booking blocks the radar" is a `NOT EXISTS` inside
   * `reachable()`, which is the one predicate the listing, the reservation and
   * the claim all share. Sprint 51 grepped for `inBookedWindow`, found only a
   * verifier calling it, believed a doc comment that said "Read by the radar",
   * and wired a duplicate into the board before reading `reachable()`. That is
   * the founder's own note about the two hardest rulings: searching for a
   * field name instead of reading the code that uses it.
   *
   * Asserted against the SQL rather than against the function name, because
   * the function name is exactly what misled.
   */
  const radar = readSource("lib/data/radar.ts");
  check(
    "🔴 51.7 a confirmed booking takes a clinician off the radar",
    /NOT EXISTS/.test(radar) &&
      /a\.status = 'booked'/.test(radar) &&
      /interval '15 minutes'/.test(radar),
    "enforced in reachable(), so they are unbookable rather than merely hidden",
  );

  const schema = readSource("lib/db/schema.ts");
  check(
    "🔴 51.7 double booking is refused by the database, not by a form",
    /uniqueIndex\("availability_slots_hour_unique"\)/.test(schema),
    "a unique index on (therapist, hour), so a race has a loser who is told",
  );

  const cron = readSource("app/api/cron/[job]/route.ts");
  check(
    "51.7 the day-before reminder runs, on WhatsApp and email both",
    /bookingsNeedingReminder/.test(cron) && /isQuietHour/.test(cron) && /notify\(/.test(cron),
    "hourly, holding anything landing in a quiet hour until the morning",
  );

  /*
   * 🔴 And the part that was genuinely missing: the page.
   *
   * `/on-call` had fourteen day chips and a flat list, which is a form for
   * publishing availability rather than a calendar. Three views, and a way to
   * put an existing patient into a future hour.
   */
  const calendar = readSource("components/scheduling/calendar.tsx");
  check(
    "🔴 51.7 the calendar has day, week and month views",
    /"day", "week", "month"/.test(calendar) || /\["day", "week", "month"\]/.test(calendar),
    "one selection, shared across all three, so switching view loses nothing",
  );

  /*
   * 🔴 Every day key in the CLINICIAN's zone.
   *
   * `toISOString().slice(0, 10)` is the bug 11R.2 fixed on the server side: at
   * 23:30 in Cairo the UTC date is still yesterday, so the evening's hours
   * land on the wrong day and a clinician publishes Tuesday believing they
   * published Wednesday.
   */
  check(
    "🔴 51.7 the calendar keys every day in the clinician's own zone",
    /dayKey\(/.test(calendar) && !/toISOString\(\)\.slice\(0, 10\)/.test(calendar),
    "dayKey(at, zone), never a UTC date",
  );

  /*
   * 🔴 An existing patient is invited by ID, never found by name.
   *
   * `bookSlot`'s public path finds or creates a patient from a typed name,
   * which is right for a stranger off the radar and would mint a duplicate
   * file for somebody already in the caseload. The clinician would discover it
   * when half the history was missing from the room.
   */
  const bookingActions = readSource("app/(app)/bookings/actions.ts");
  check(
    "🔴 51.7 inviting an existing patient passes their id, so no duplicate file is made",
    /patientId: input\.patientId/.test(bookingActions) &&
      /getPatient\(/.test(bookingActions) &&
      /accessFor\(/.test(bookingActions),
    "two gates, and the patient row taken as given rather than matched on a name",
  );

  /*
   * 🔴 The invitation is an invitation: they are TOLD.
   *
   * A clinician quietly placing an appointment into somebody else's week,
   * which they discover from a reminder the night before, is a different
   * product. A failed notification is reported rather than hidden behind a
   * green tick, because the clinician is the only person who can fix it.
   */
  check(
    "🔴 51.7 an invited patient is told, and a failure to reach them is reported",
    /notify\(/.test(bookingActions) && /if \(!delivery\.sent\)/.test(bookingActions),
    "the hour is held either way, and the clinician is told nobody could be reached",
  );

  /*
   * 🔴 A booked hour is never closed from this screen.
   *
   * `withdrawHour` is conditional on `status = 'open'`, and rendering a
   * control the data layer will refuse is how a clinician learns to distrust
   * a screen. An appointment somebody is planning their week around is
   * cancelled with a message, elsewhere.
   */
  check(
    "🔴 51.7 only an open hour can be closed from the calendar",
    /slot\.status === "open" \?/.test(calendar),
    "a booked hour is cancelled with a message, not deleted out from under somebody",
  );

  /* ---------------------------------------------- 51.4 · the SOS orb, everywhere -- */

  /*
   * 🔴 "On every patient screen including a live session."
   *
   * That is a claim about ROUTES, and a claim about routes is exactly the kind
   * that decays: the orb is rendered by `PatientChrome`, so every page inside
   * the `(patient)` group gets it for free and every patient-facing page
   * OUTSIDE that group has to remember. Five had forgotten, and one of them
   * was the public radar, which is the page a person in crisis actually lands
   * on. It carried a disclaimer saying this is not an emergency service and
   * offered nothing to do about it.
   *
   * Listed explicitly rather than derived, because "which pages are patient
   * screens" is a judgement. A marketing page is not one; a payment screen is.
   */
  const PATIENT_PAGES_OUTSIDE_THE_GROUP = [
    "app/(public)/radar/page.tsx",
    "app/(public)/t/[id]/page.tsx",
    "app/pay/[token]/page.tsx",
    "app/feedback/[token]/page.tsx",
    "app/support/[token]/page.tsx",
    "app/j/[code]/page.tsx",
    "app/join/[token]/page.tsx",
  ];

  const missingOrb = PATIENT_PAGES_OUTSIDE_THE_GROUP.filter((page) => {
    const body = readSource(page);
    // Either the orb directly, or the chrome that renders one.
    return !/SosOrb|PatientChrome/.test(body);
  });

  check(
    "🔴 51.4 every patient screen outside the (patient) group carries the orb",
    missingOrb.length === 0,
    missingOrb.length === 0
      ? `${PATIENT_PAGES_OUTSIDE_THE_GROUP.length} pages, each with an orb or the chrome that renders one`
      : missingOrb.join(", "),
  );

  /*
   * 🔴 CONTROL — the scan discriminates.
   *
   * `/SosOrb|PatientChrome/` over a file would pass for every page if
   * `readSource` ever returned something unexpected, and an all-green list is
   * indistinguishable from a working one. A marketing page has no orb by
   * design and must be seen not to have one.
   */
  const marketing = readSource("app/(public)/for-clinics/page.tsx");
  check(
    "🔴 CONTROL the orb scan can tell a page WITHOUT an orb from one with it",
    !/SosOrb|PatientChrome/.test(marketing),
    "a marketing page is not a patient screen and does not match",
  );

  /*
   * 🔴 …and the layout still renders it for the group itself, which is the
   * half that covers the other fifteen patient pages. Asserting only the list
   * above would pass against a layout somebody had emptied.
   */
  check(
    "🔴 51.4 …and the (patient) layout renders the chrome for every page inside it",
    /PatientChrome/.test(readSource("app/(patient)/layout.tsx")) &&
      /SosOrb/.test(readSource("components/patient/chrome.tsx")),
    "one orb for the whole group, so a new page cannot forget it",
  );

  /*
   * 🔴 The crisis path does not depend on money, on an account, or on our API.
   *
   * A `fetch`, a server action or an analytics call in this component's path
   * would make the orb depend on the thing most likely to be broken in the
   * minute somebody reaches for it. It is plain `tel:` links over numbers
   * compiled into the page.
   */
  const orb = readSource("components/patient/sos-orb.tsx");
  check(
    "🔴 51.4 the orb reaches a dialler with no network call in the path",
    /href={`tel:/.test(orb) && !/fetch\(|use server|\baction=/.test(orb),
    "plain tel: links, no fetch, no server action",
  );

  /*
   * 🔴 C98 / C125 / C184 — verified numbers only, and only the READER's.
   *
   * `lineForNumber` is the function that refuses unless the dialling code
   * leaves exactly one verified line. The orb calling `CRISIS_LINES` directly
   * is the 37R.25 defect: it printed `988 · United States` to a patient whose
   * number starts +20, which looks like help and reaches nothing.
   */
  check(
    "🔴 C184 the orb asks for the reader's own line, never the whole table",
    /* W1-09: `sosLinesFor` is the one rule now, reader's number first. */
    /sosLinesFor\(/.test(orb) && !/Object\.(keys|values|entries)\(CRISIS_LINES\)/.test(orb),
    "one line for this reader, or the sentence that is true everywhere",
  );

  /*
   * The shipped copy, comments stripped. `readSource` removes them while
   * keeping line numbers, which matters here: the paragraphs BELOW explaining
   * why "bundle" is banned contain the word, and a scan that read them would
   * fail on its own documentation. That has happened seven times in this
   * repository and is why stripping is the default rather than a detail.
   */
  const cmsEnRaw = readSource("lib/content/defaults.ts");
  const cmsArRaw = readSource("lib/content/defaults-ar.ts");
  const dictionary = readSource("lib/i18n/messages.ts");

  /* --------------------------- 51.1 · copy that describes a product we no longer sell -- */

  /*
   * 🔴 A page describing a product we no longer sell is worse than no page.
   *
   * Sprint 46 replaced BUNDLES with credit and a plan: you do not buy a number
   * of sessions here, you add credit, credit is money, and what it buys is a
   * lower AI rate that stays yours. Three places still used the old word, and
   * the worst of them was `pricing.credits` in the shipped dictionary, on the
   * pricing page, one paragraph away from `pricing.creditIsMoney` contradicting
   * it.
   *
   * Retired vocabulary is the cheapest thing in a content sprint to check and
   * the easiest to miss by reading, because it reads fine. It only looks wrong
   * if you know what changed.
   */
  /*
   * 🔴 The Arabic patterns are anchored, and the first draft was not.
   *
   * `باق` as a prefix also matches `باقٍ`, which means "remaining" and is an
   * ordinary word this sprint used in a sentence about a record still being
   * there. A banned-word list that catches a different word is how a
   * vocabulary rule turns into people editing good copy to please a scan.
   */
  const RETIRED = [
    { word: "\\bbundles?\\b", why: "46 replaced bundles with credit and a plan" },
    { word: "باقة", why: "the same word in Arabic" },
    { word: "الباقات", why: "the same word in Arabic, plural and definite" },
  ];

  const stillSaying = RETIRED.filter(({ word }) =>
    [cmsEnRaw, cmsArRaw, dictionary].some((body) =>
      new RegExp(word, "i").test(body),
    ),
  );

  check(
    "🔴 51.1 no shipped copy still describes the pre-46 bundle model",
    stillSaying.length === 0,
    stillSaying.length === 0
      ? "credit is money, and nothing calls it a bundle"
      : stillSaying.map((r) => `${r.word} (${r.why})`).join(", "),
  );

  /*
   * 🔴 CONTROL — and the scan can see the word it is looking for.
   *
   * Three regexes over three files that all fail to match is exactly what a
   * broken path produces, and it prints the same green line.
   */
  check(
    "🔴 CONTROL the retired-vocabulary scan matches the word it bans",
    RETIRED.every(({ word }) =>
      new RegExp(word, "i").test(
        word.startsWith("\\b") ? "moving to a smaller bundle never strands it" : `الانتقال إلى ${word} أصغر`,
      ),
    ) &&
      // 🔴 …and does NOT match the ordinary Arabic word for "remaining".
      !RETIRED.some(({ word }) => new RegExp(word, "i").test("الملف باقٍ بعد سنوات")),
    "each banned word is caught in a planted sentence, and a different word is not",
  );

  /* ---------------------------------------------- 51.9 · sell what we already built -- */

  /*
   * 🔴 Four things this product does today and no page has ever mentioned.
   *
   * §7's own list. Each is a capability that has shipped for sprints and has
   * never appeared in copy, which is the most expensive kind of gap: the code
   * is paid for and the value is not collected. The Arabic-speaking diaspora
   * is the largest of them and needs no code at all.
   *
   * Asserted by the IDEA appearing in both dictionaries rather than by an
   * exact sentence, so a rewrite of the copy does not break the check while
   * dropping the item silently would.
   */
  const cmsEn = cmsEnRaw;
  const cmsAr = cmsArRaw;

  const SOLD: { what: string; en: RegExp; ar: RegExp }[] = [
    {
      what: "an Arabic-speaking therapist for the diaspora",
      en: /first language|speaks? your language/i,
      ar: /لغتك الأولى/,
    },
    {
      what: "a psychiatrist and a therapist on one record",
      en: /psychiatrist and a therapist/i,
      ar: /طبيب نفسي ومعالج/,
    },
    {
      what: "a verified badge a clinician can show off-platform",
      en: /verified page you can show/i,
      ar: /صفحة موثّقة/,
    },
    {
      what: "a record that is still there years later",
      en: /still there in three years/i,
      ar: /بعد ثلاث سنوات/,
    },
  ];

  const unsold = SOLD.filter((item) => !(item.en.test(cmsEn) && item.ar.test(cmsAr)));

  check(
    "🔴 51.9 the four things we built and never mentioned are on a page, in both languages",
    unsold.length === 0,
    unsold.length === 0
      ? `${SOLD.length} of ${SOLD.length} sold, English and Arabic`
      : unsold.map((item) => item.what).join("; "),
  );

  /*
   * 🔴 CONTROL — the scan is reading real files and can miss something.
   *
   * Four regexes over two files that all happen to match is indistinguishable
   * from four regexes over two EMPTY strings that all happen not to. This
   * asserts the negative case directly.
   */
  check(
    "🔴 CONTROL the 51.9 scan would notice an item that was dropped",
    SOLD.every((item) => !item.en.test("") && !item.ar.test("")) && cmsEn.length > 1000,
    "each pattern fails against nothing, and the file being read is the real one",
  );

  /* ------------------------------------------------------- 51.10 · the four rules -- */

  /*
   * 🔴 C275 — "24/7" describes the RADAR, never a response time.
   *
   * The radar is genuinely always on: clinicians are on it at every hour. What
   * is never true is that somebody answers within any particular time, and a
   * marketing page promising one to a person in crisis is the worst promise in
   * this product to break. So the phrase may not appear beside response
   * language anywhere in shipped copy.
   */
  const RESPONSE_PROMISE =
    /24\s*\/\s*7[^.]{0,60}(?:respond|reply|answer|available to you|within)|(?:respond|reply|answer)[^.]{0,60}24\s*\/\s*7/i;

  const promising = [cmsEn, cmsAr, readSource("lib/i18n/messages.ts")].filter((body) =>
    RESPONSE_PROMISE.test(body),
  );

  check(
    "🔴 51.10 / C275 no shipped copy turns 24/7 into a response time",
    promising.length === 0,
    promising.length === 0 ? "the radar is always on; nobody is promised an answer" : "FOUND",
  );

  check(
    "🔴 CONTROL the 24/7 scan catches the sentence it exists to stop",
    RESPONSE_PROMISE.test("Our therapists are available 24/7 and respond within minutes.") &&
      !RESPONSE_PROMISE.test("The radar is live 24/7. Who is on it changes hour by hour."),
    "a promised response is caught, a description of the radar is cleared",
  );

  /*
   * 🔴 C273 — a rating is withheld below a volume floor.
   *
   * One bad night at 1.0 stars follows somebody around, and a single
   * five-star rating is not evidence of anything. A missing number is more
   * honest than a meaningless one.
   */
  const feedback = readSource("lib/data/feedback.ts");
  check(
    "🔴 51.10 / C273 a star rating is withheld until enough people have given one",
    /RATINGS_VISIBLE_AFTER\s*=\s*[1-9]/.test(feedback),
    "a missing number is more honest than a meaningless one",
  );

  /*
   * 🔴 C274 — one price per clinician, never geo-priced.
   *
   * `users.sessionRateCents` is a single column and there is no second one
   * keyed by country. Charging an Egyptian patient less than a Gulf one for
   * the same clinician's hour is a decision this product does not get to make
   * on a clinician's behalf, and the schema is what keeps it that way.
   */
  check(
    "🔴 51.10 / C274 a clinician has ONE price, with no geo-priced second column",
    /sessionRateCents: integer\("session_rate_cents"\)/.test(schema) &&
      !/sessionRateCentsBy|rateCentsFor(?:Country|Region)|geoRate/i.test(schema),
    "one column, so a per-country price is not a thing that can be stored",
  );

  /* ------------------------------------------- 51.3 · designed, not assembled -- */

  /*
   * 🔴 "If a page is plain text and buttons with no structure, it is flagged
   * and rebuilt, not excused."
   *
   * Most of 51.3 is judgement a script cannot hold, and this check does not
   * pretend otherwise. What it CAN hold is the specific shape the ticket
   * names: a page that renders several paragraphs and links directly, with no
   * card and almost no component, so everything on it has the same weight and
   * a reader has to read all of it to find their line.
   *
   * Both sign-in doors were exactly that. `/patient/login` stacked a bare
   * form, a card, and then three identical grey centred sentences in a row:
   * forgot your password, create an account, are you a therapist. A person
   * arriving at two in the morning met a wall of near-identical links.
   *
   * The rule is deliberately narrow. A page whose structure lives in a
   * component it renders is not scaffolding, and flagging those would make
   * this a check people route around.
   */
  const PATIENT_ENTRY_PAGES = [
    "app/(patient)/patient/login/page.tsx",
    "app/(patient)/patient/signup/page.tsx",
  ];

  const flat = PATIENT_ENTRY_PAGES.filter((page) => {
    const body = readSource(page);
    const structured = /<Card|rounded-2xl|rounded-3xl/.test(body);
    const loose = (body.match(/<p[ >]/g) ?? []).length;
    return !structured && loose >= 3;
  });

  check(
    "🔴 51.3 the screens a patient arrives on carry structure, not a stack of grey lines",
    flat.length === 0,
    flat.length === 0
      ? `${PATIENT_ENTRY_PAGES.length} entry screens, each with its form in a card and its exits ranked`
      : flat.join(", "),
  );

  /*
   * 🔴 CONTROL — and the shape it is looking for is one it can recognise.
   *
   * An absence assertion over two files. Fed the pre-51 version of the page
   * verbatim, the predicate must fire.
   */
  const before = [
    "<main>",
    "<p>Forgot your password?</p>",
    "<p>New here? Create an account</p>",
    "<p>Are you a therapist?</p>",
    "</main>",
  ].join("\n");

  check(
    "🔴 CONTROL the 51.3 scan recognises the shape it exists to flag",
    !/<Card|rounded-2xl|rounded-3xl/.test(before) &&
      (before.match(/<p[ >]/g) ?? []).length >= 3,
    "the page as it was before this sprint is flagged by the same predicate",
  );

  /* ------------------------------ 51.11 · the literal scanner counts literals -- */

  /*
   * 🔴 The ratchet that enforces "every string is a MessageKey" was counting
   * type annotations.
   *
   * `(fn: () => Promise<State>)` matched as a text node: the `>` of the arrow,
   * a word, the `<` of a type argument. Twelve phantom literals across seven
   * files, and this sprint's first instinct was to rewrite real code to please
   * it. A ratchet that moves when somebody adds a generic cannot be ratcheted.
   *
   * Fixing a measurement lowers a number without translating anything, which
   * is a different claim from doing the work, so it is asserted here in both
   * directions: the arrow forms must NOT count, and every shape of real
   * literal must still count. Without the second half this is a scanner that
   * has been quietly blinded.
   */
  const mustNotCount = [
    "const f = (g: () => Promise<State>) => g();",
    "const h = (): Promise<void> => {};",
  ];
  const mustCount: [string, string][] = [
    ["<p>Nothing to do right now</p>", "Nothing to do right now"],
    ["<p className={cls}>When your therapist sends you a set</p>", "When your therapist sends you a set"],
    ["<>Back to home</>", "Back to home"],
    ['<p className="x">Try again</p>', "Try again"],
    ["<div><b>x</b>The link may be out of date</div>", "The link may be out of date"],
  ];

  check(
    "51.11 the literal scanner does not count a type annotation as a string",
    mustNotCount.every((source) => literalsIn(source).length === 0),
    "an arrow followed by a generic is code, not copy",
  );

  check(
    "🔴 CONTROL …and it still counts every shape of real literal",
    mustCount.every(([source, expected]) => literalsIn(source).includes(expected)),
    `${mustCount.length} literal shapes still seen, so the scanner is corrected rather than blinded`,
  );

  finish("sprint 51");
}

void main();
