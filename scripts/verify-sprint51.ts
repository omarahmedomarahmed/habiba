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
    /lineForNumber\(/.test(orb) && !/Object\.(keys|values|entries)\(CRISIS_LINES\)/.test(orb),
    "one line for this reader, or the sentence that is true everywhere",
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
