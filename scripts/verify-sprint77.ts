/**
 * Sprint 77 acceptance: nothing on the public site is a picture of itself.
 *
 *   npm run verify:sprint77
 *
 * ## The founder's four sentences, and what is mechanical about each
 *
 * > *Make the bottom nav on every mobile mockup clickable like the real app.
 * > Add a full app hero for patients to interact with till they book a session
 * > through the radar, no account needed. The copilot in the live session hero
 * > is still dark. The note shouldn't stay there empty till the session is
 * > done. Sweep for that gray or thin font text and replace it with clearer
 * > text all over the website. Make every single mockup interactive.*
 *
 * Three of those are properties of the source and one is a judgement.
 *
 *   - **Clickable** is a property: the frame renders a `<button>` when the
 *     caller hands it an `onTab`, and `PatientApp` hands it one.
 *   - **Grey** is a property: a class name, in a file, on a public surface.
 *   - **Interactive** is a property at the level this can reach: a demo whose
 *     component holds no state is a still frame, so each named demo must
 *     resolve to a client component that does.
 *   - Whether the result reads better is not checkable here, and this file
 *     does not pretend otherwise.
 *
 * ## 🔴 §6 — EVERY ABSENCE HERE CARRIES A PLANTED OFFENDER
 *
 * The grey sweep is exactly the shape of defect §6 describes: a scan that
 * passes because its regex never matched anything, on any file, ever. So the
 * scanner is a function, it is run against a planted line as well as against
 * the tree, and a pass is only reported when the plant is caught.
 */
import { readdirSync } from "node:fs";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

/**
 * The surfaces an anonymous visitor can reach.
 *
 * 🔴 `components/radar` is here and `components/admin` is not, and the line is
 * not "marketing". It is who is standing in front of the screen: the radar is
 * rendered into the homepage's own fold, so its greys are the homepage's greys.
 * The admin console is staff-only and 37L.3 already says it is English by
 * decision; widening this scan to it would be a different argument nobody has
 * made.
 */
const PUBLIC_DIRS = [
  "app/(public)",
  "components/public",
  "components/demo",
  "components/visual",
  "components/radar",
  /*
   * 🔴 77.11 — THE THREE THE FIRST DRAFT MISSED, AND HOW THEY WERE FOUND.
   *
   * The first version of this list was the five directories whose NAMES say
   * public, and the live homepage then shipped twelve grey classes anyway. A
   * public page renders more than `components/public`: the hero draws the real
   * `TranscriptPanel` and the real `NoteCard`, the header draws the language
   * switch, and every card and button comes from `components/ui`. A rule
   * scoped by directory name rather than by what actually renders is the §6
   * defect in its purest form — it passed on every file it looked at and the
   * page it was about was still wrong.
   *
   * Found by reading the deployed HTML, not the source, which is the only way
   * that gap was ever going to show up.
   */
  "components/clinical",
  "components/i18n",
  "components/ui",
];

/*
 * 🔴 AND `components/session` IS DELIBERATELY NOT HERE.
 *
 * It is the clinician's room: thirty-odd greys, most on dark surfaces where
 * the fix is lighter rather than darker, and no visitor ever sees one of them.
 * Sweeping it belongs to the sprint that looks at the portal, and adding it to
 * this list without doing the work would make this gate red on a rule nobody
 * had agreed to. It is named here so the omission is a decision rather than an
 * oversight.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/**
 * The scanner, as a function, so the control below runs the same code the tree
 * does. A check whose logic exists only inline is a check nobody can falsify.
 *
 * Two exemptions, both deliberate:
 *
 *   - `placeholder:` — the hint inside an empty field is meant to recede, and
 *     it is not content: a reader who cannot see it has lost nothing.
 *   - `cursor-not-allowed` — a disabled control is muted ON PURPOSE, and
 *     darkening one would make it look pressable.
 */
const GREY = /(?<!placeholder:)\btext-slate-(400|500)\b/;

function greyLines(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !line.includes("cursor-not-allowed"))
    .filter((line) => !line.includes("disabled:text-slate"))
    .filter((line) => GREY.test(line));
}

function main() {
  /* ================================================================== */
  /*  77.1 · the grey sweep                                             */
  /* ================================================================== */

  const offenders: string[] = [];
  for (const dir of PUBLIC_DIRS) {
    for (const file of walk(dir)) {
      /*
       * 🔴 C205 — `readSource` strips comments and `readFileSync` does not.
       *
       * Half this sprint's comments NAME the colour they removed, because the
       * reason a grey went is worth keeping. Reading raw source would report
       * every one of those explanations as the defect they describe.
       */
      for (const line of greyLines(readSource(file))) {
        offenders.push(`${file}: ${line.trim().slice(0, 70)}`);
      }
    }
  }

  check(
    "🔴 77.1 no slate-400 or slate-500 text on any surface a visitor reaches",
    offenders.length === 0,
    offenders.slice(0, 6).join("\n     ") ||
      `${String(PUBLIC_DIRS.length)} directories scanned, clean`,
  );

  /*
   * 🔴 THE CONTROL. Without this, a typo in `GREY` makes the check above pass
   * on every file in the repository and report a clean sweep for ever.
   */
  check(
    "🔴 CONTROL the scanner catches a planted grey, and skips the two exemptions",
    greyLines(`<p className="text-xs text-slate-400">a planted offender</p>`).length === 1 &&
      greyLines(`<input className="placeholder:text-slate-400" />`).length === 0 &&
      greyLines(`<button className="cursor-not-allowed text-slate-400" />`).length === 0 &&
      greyLines(`<input className="disabled:text-slate-500" />`).length === 0,
    "an absence assertion with no planted offender measures the regex, not the tree",
  );

  /* ================================================================== */
  /*  77.2 · the live session hero                                      */
  /* ================================================================== */

  const hero = readSource("components/demo/session-demo.tsx");

  check(
    "🔴 77.2 the hero's copilot is the white one, and the dark toasts are gone",
    hero.includes("SessionCopilot") && !hero.includes("CopilotToasts"),
    "dark grey cards at 13px over a navy transcript is the one thing nobody reads mid-session",
  );

  check(
    "🔴 …and the note slot runs the session rather than promising a note",
    /type Phase = "live" \| "writing" \| "done"/.test(hero) &&
      /phase === "done" \?/.test(hero) &&
      /<SessionCopilot key=\{run\}/.test(hero),
    "a third of the fold reserved for fifteen seconds to say something will appear here",
  );

  check(
    "🔴 …and ending it is a control, not only a timer",
    /labels\.endSession/.test(hero) && /function endNow\(\)/.test(hero) &&
      /labels\.replay/.test(hero),
    "76.82 asked for a room that ends; a reader who wants the note now presses End",
  );

  /* ================================================================== */
  /*  77.3 · every phone's bottom bar is a control                      */
  /* ================================================================== */

  const frame = readSource("components/demo/device-frame.tsx");
  const app = readSource("components/demo/patient-app.tsx");

  check(
    "🔴 77.3 the frame's bar is buttons when a caller gives it somewhere to go",
    /onTab \? \(\s*<button/.test(frame) && /aria-current=\{on \? "page" : undefined\}/.test(frame),
    "a dead button is worse than a picture of one: it invites a press and answers nothing",
  );

  check(
    "🔴 …and the patient app hands it one, with the tab you are on lit",
    /onTab=\{/.test(app) && /activeTab=\{/.test(app),
    "the bar had the right five tabs and not one of them did anything",
  );

  check(
    "🔴 …and every screen says its own name at the top",
    /SCREEN_TITLE/.test(app) && /truncate text-\[15px\] font-bold/.test(app),
    "a list of dated cards under no heading is a screen nobody could have navigated to",
  );

  /*
   * 🔴 AND THE FRAME DOES NOT WRAP A DEMO THAT BRINGS ITS OWN.
   *
   * `frameFor("radar")` returning `phone` put a phone inside a phone, which is
   * the one arrangement that reads as a bug rather than as a screen.
   */
  check(
    "🔴 …and a self-framed demo is not framed twice",
    /const SELF_FRAMED/.test(frame) &&
      /if \(SELF_FRAMED\.has\(demo\)\) return \{ as: "none" \};/.test(frame),
    "a phone drawn inside a phone",
  );

  /* ================================================================== */
  /*  77.4 · every mockup is something a person can work                */
  /* ================================================================== */

  const showcase = readSource("components/demo/component-showcase.tsx");
  const clinical = readSource("components/demo/clinical-demo.tsx");

  check(
    "🔴 77.4 the transcript, the note and the risk banner carry their own controls",
    /case "transcript":\s*return <TranscriptDemo/.test(showcase) &&
      /case "note":\s*return <NoteDemo/.test(showcase) &&
      /case "risk":\s*return <RiskDemo/.test(showcase),
    "a still frame cannot make a claim about something happening",
  );

  check(
    "🔴 …and each control is the real one: off the record, approve, dismiss",
    clinical.startsWith('"use client"') &&
      /setOffRecord/.test(clinical) &&
      /status=\{approved \? "approved" : "draft"\}/.test(clinical) &&
      /onDismiss=\{\(\) => \{ setShown\(false\); \}\}/.test(clinical),
    "off the record, the approval, and the dismissal are the three things these claims are about",
  );

  /*
   * 🔴 C98 HELD IN THE DEMO TOO. The real banner takes the reader's country's
   * crisis line or renders a sentence; a marketing page has no country in hand,
   * so it must pass neither. A number on this page reaches nothing from Cairo.
   */
  check(
    "🔴 …and the risk demo draws no phone number",
    !/line=\{/.test(clinical) && !/\b988\b|\b105\b/.test(clinical),
    "C98: a button that looks like help and is not is worse than no button",
  );

  /* ================================================================== */
  /*  77.5 · the audience pages open the way the homepage opens         */
  /* ================================================================== */

  const companies = readSource("app/(public)/for-companies/page.tsx");
  const clinics = readSource("app/(public)/for-clinics/page.tsx");
  const audienceHero = readSource("components/public/audience-hero.tsx");

  check(
    "🔴 77.5 both dedicated pages open with the hero band and their own console",
    /<AudienceHero/.test(companies) && /demo=\{<CompanyDemo \/>\}/.test(companies) &&
      /<AudienceHero/.test(clinics) && /demo=\{<ClinicDemo \/>\}/.test(clinics),
    "the strongest presentation of an audience's argument was on the page about everybody",
  );

  check(
    "🔴 …and the band imports no demo of its own",
    !/audience-demos|portal-demo|patient-app/.test(audienceHero),
    "a page that wants the clinic console should not drag the sponsor's fixtures in with it",
  );

  /* ================================================================== */
  /*  77.6 · the patient hero                                           */
  /* ================================================================== */

  const blocks = readSource("components/public/blocks.tsx");
  const schema = readSource("lib/db/schema.ts");
  const defaults = readSource("lib/content/defaults.ts");
  const defaultsAr = readSource("lib/content/defaults-ar.ts");

  check(
    "🔴 77.6 a hero can render the patient's app, in both the type and the renderer",
    /\| "patient-app"/.test(schema) &&
      /block\.demo === "patient-app" \?/.test(blocks),
    "a demo name the schema allows and the renderer ignores is a blank column",
  );

  check(
    "🔴 …and both locales ship it on the patients page and on the homepage",
    (defaults.match(/demo: "patient-app"/g) ?? []).length >= 2 &&
      (defaultsAr.match(/demo: "patient-app"/g) ?? []).length >= 2,
    "a default that exists in English only publishes an English page under `ar`",
  );

  /*
   * 🔴 AND IT BOOKS NOTHING. The property that makes a working booking flow
   * safe on an anonymous page is that there is no path from it to a calendar:
   * fixtures, local state, no action and no fetch.
   */
  check(
    "🔴 …and the app it renders reaches no action, no route and no fetch",
    !/from "@\/app\//.test(app) &&
      !/\bfetch\(/.test(app) &&
      !/useRouter|redirect\(/.test(app),
    "a clinical-looking surface on an anonymous page is safe because it cannot reach a row",
  );

  /* ================================================================== */
  /*  77.12 · every email, sendable from the one process with the key    */
  /* ================================================================== */

  const previews = readSource("lib/mail-previews.ts");
  const adminActions = readSource("app/(admin)/admin/actions.ts");
  const script = readSource("scripts/mail-preview.ts");
  const settings = readSource("app/(admin)/admin/settings/page.tsx");

  /* All fourteen, counted, so a template that is dropped is visible. */
  const sends = (previews.match(/\n    \{\s*\n?\s*name: "/g) ?? []).length ||
    (previews.match(/name: "/g) ?? []).length;
  check(
    "🔴 77.12 all fourteen templates are in one list",
    sends === 14,
    `${String(sends)} found`,
  );

  /*
   * 🔴 AND THE SCRIPT READS THAT LIST rather than carrying a second copy.
   *
   * Two copies of a subject line is C60's shape applied to a message: the day
   * one changes, the other is the one somebody is reading.
   */
  check(
    "🔴 …and the preview script renders the same list rather than its own",
    /previewMessages\(\)/.test(script) && !/sendSessionReport\(/.test(script),
    "the fourteen were typed into the script and the console needed them too",
  );

  check(
    "🔴 …and the console can send them, owner only and written down",
    /export async function sendEveryTemplate/.test(adminActions) &&
      /sendEveryTemplate[\s\S]{0,400}requireRole\("super_admin"\)/.test(adminActions) &&
      /action: "email\.previewAll"/.test(adminActions),
    "a button that sends fourteen emails is one somebody will ask about later",
  );

  check(
    "🔴 …and it is reachable, on the screen behind the same door as the prices",
    /<MailCheck \/>/.test(settings),
    "58.3: a surface nothing links to is a surface nobody uses",
  );

  /*
   * 🔴 C127 — INVENTED PEOPLE ONLY, and this one is reachable from a console
   * rather than from a shell, which makes the rule matter more rather than
   * less. Every surname is Demo or Example and every address is at the domain
   * RFC 2606 reserves.
   */
  const names = previews.match(/"[A-Z][a-z]+ (?:[A-Z][a-z]+)"/g) ?? [];
  const strangers = names.filter((n) => !/(Demo|Example|Practice)"$/.test(n));
  check(
    "🔴 …and every person in the fourteen is invented",
    strangers.length === 0 && !/@(?!example\.com)[\w-]+\.[a-z]{2,}/.test(previews),
    strangers.join(", ") || `${String(names.length)} names, all Demo or Example`,
  );

  check(
    "🔴 CONTROL that name scan catches a stranger",
    ['"Mariam Demo"', '"Nour Demo"', '"Sarah Connor"']
      .filter((n) => !/(Demo|Example|Practice)"$/.test(n)).length === 1,
    "a surname rule that matched everything would clear a real patient's name",
  );

  finish("sprint 77");
}

main();
