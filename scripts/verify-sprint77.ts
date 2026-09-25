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
import { readdirSync, readFileSync } from "node:fs";

import robots from "../app/robots";
import { CONTENT_DEMOS } from "../lib/db/schema";
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

function walk(dir: string, out: string[] = [], ext = ".tsx"): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out, ext);
    else if (path.endsWith(ext)) out.push(path);
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

  /*
   * 🔴 THIS ASSERTED A SYNTAX THAT TASK 137 DELETED ON PURPOSE.
   *
   * The old form looked for `| "patient-app"` in the schema, which was the
   * hero's own inline union of demo names. Task 137 removed that union
   * precisely because it existed: `hero` carried its own list while every
   * other block used `ContentDemo`, so half the product was renderable on one
   * block type and invisible to the rest. The hero now reads `ContentDemo`
   * like everything else, which is the outcome this check wanted, and the
   * check went red for it.
   *
   * The property is "the type allows it and the renderer draws it", so that is
   * what is asserted: the name is in the ONE list, the hero's demo field is
   * typed by that list rather than by a union of its own, and blocks.tsx
   * renders it. A check bound to how something was written fails when somebody
   * improves it, which teaches people to read past a red line.
   */
  check(
    "🔴 77.6 a hero can render the patient's app, in both the type and the renderer",
    CONTENT_DEMOS.includes("patient-app") &&
      /demo\?: ContentDemo;/.test(schema) &&
      /block\.demo === "patient-app" \?/.test(blocks),
    "a demo name the schema allows and the renderer ignores is a blank column",
  );

  /*
   * 🔴 CONTROL — the list is the real one, and the hero has not quietly grown a
   * second one. Without this, `includes` could be reading an empty import and
   * the regex could be matching a comment.
   */
  check(
    "🔴 77.6 CONTROL the demo list is the real one and the hero has only that one",
    CONTENT_DEMOS.length > 10 &&
      !CONTENT_DEMOS.includes("verify77-not-a-demo" as never) &&
      !/demo\?:\s*"[a-z-]+"\s*\|/.test(schema),
    `${String(CONTENT_DEMOS.length)} demo names, and no inline union beside them`,
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
  /*  77.13 · a "use server" file exports async functions and nothing else */
  /* ================================================================== */

  /*
   * 🔴 THE DEFECT THIS IS FOR, AND IT SHIPPED.
   *
   * Sprint 76 put `export const SANITISER_BLOCK_TYPES = …` into
   * `app/(admin)/admin/actions.ts`, which carries `"use server"`. Next
   * validates a server module's exports when something pulls it into a page's
   * graph, so it sat there for a sprint; the moment `/admin/settings` imported
   * an action from that file the whole page answered 500 with *"A `use server`
   * file can only export async functions, found object"*, naming a file the
   * operator was not editing.
   *
   * It compiles. It typechecks. No gate read it. It was found by opening
   * `/admin/errors` on production, which is exactly what that page is for and
   * is not a method anybody should have to rely on twice.
   */
  const serverFiles: string[] = [];
  for (const dir of ["app", "lib", "components"]) {
    for (const file of walk(dir)) serverFiles.push(file);
  }
  for (const dir of ["app", "lib"]) {
    for (const file of walk(dir, [], ".ts")) serverFiles.push(file);
  }

  const badExports: string[] = [];
  for (const file of [...new Set(serverFiles)]) {
    const source = readSource(file);
    if (!/^\s*["']use server["']/.test(source)) continue;
    for (const m of source.matchAll(/^export\s+(?!async function)(?!type\b)(?!interface\b)(\w+)/gm)) {
      badExports.push(`${file}: export ${m[1]}`);
    }
  }

  check(
    "🔴 77.13 no \"use server\" file exports anything but an async function",
    badExports.length === 0,
    badExports.slice(0, 5).join("\n     ") || "every server module is actions only",
  );

  check(
    "🔴 CONTROL that scan catches the export that shipped",
    /^export\s+(?!async function)(?!type\b)(?!interface\b)(\w+)/m.test(
      '"use server";\nexport const SANITISER_BLOCK_TYPES = [];\n',
    ) &&
      !/^export\s+(?!async function)(?!type\b)(?!interface\b)(\w+)/m.test(
        '"use server";\nexport async function doIt() {}\nexport type State = { ok?: boolean };\n',
      ),
    "the real one was an array; a scan that also flagged the type alias would be turned off",
  );

  /* ================================================================== */
  /*  77.12 · every email, sendable from the one process with the key    */
  /* ================================================================== */

  const previews = readSource("lib/mail-previews.ts");
  const adminActions = readSource("app/(admin)/admin/actions.ts");
  const script = readSource("scripts/mail-preview.ts");
  const settings = readSource("app/(admin)/admin/settings/page.tsx");

  /*
   * 🔴 78.4 — EVERY AUDIENCE, NOT A NUMBER.
   *
   * This asserted `=== 14` and passed for a sprint while the list was twelve
   * patient messages, one clinician's and one shared. The founder read all
   * fourteen and had to ask whether a company or a clinic gets anything at all,
   * which is a question a count cannot answer and a gate counting to fourteen
   * would never have raised.
   *
   * So the property is coverage: every recipient type this product mails has at
   * least one template here. The count is still reported, because a template
   * silently dropped is worth seeing, but it is no longer what passes.
   */
  const audiences = ["patient", "clinician", "company", "partner", "our staff"] as const;
  const missing = audiences.filter((who) => !previews.includes(`audience: "${who}"`));
  const sends = (previews.match(/\n      audience: "/g) ?? []).length;
  check(
    "🔴 77.12 every audience this product mails is in the one list",
    missing.length === 0 && sends >= audiences.length,
    missing.length > 0 ? `nothing for: ${missing.join(", ")}` : `${String(sends)} templates`,
  );

  /*
   * 🔴 CONTROL, because "does this string appear" passes for the wrong reason
   * as easily as any other absence check. An audience nothing uses must be
   * reported missing, or the check above is reading the type alias rather than
   * the list.
   */
  check(
    "🔴 CONTROL an audience with no template is reported missing",
    !previews.includes('audience: "regulator"'),
    "a scan that matched anything would clear an audience nobody wrote a message for",
  );

  /* Each one says WHEN it fires, which is the half a subject line cannot carry. */
  const whens = (previews.match(/\n      when: "/g) ?? []).length;
  check(
    "🔴 …and each one says what makes it fire",
    whens === sends,
    `${String(whens)} of ${String(sends)}`,
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
    "the list was typed into the script and the console needed it too",
  );

  check(
    "🔴 …and the console can send them, owner only and written down",
    /export async function sendEveryTemplate/.test(adminActions) &&
      /sendEveryTemplate[\s\S]{0,600}requireRole\("super_admin"\)/.test(adminActions) &&
      /action: "email\.previewAll"/.test(adminActions),
    "a button that sends every template is one somebody will ask about later",
  );

  check(
    "🔴 …and it is reachable, on the screen behind the same door as the prices",
    /<MailCheck roster=\{previewRoster\(previewMessages\(\)\)\} \/>/.test(settings),
    "58.3: a surface nothing links to is a surface nobody uses",
  );

  /*
   * 🔴 AND THE FORM WORKS WITH JAVASCRIPT OFF, which is not a nicety here.
   *
   * A `<form action={…}>` whose action is an inline client function is not a
   * server reference, so React renders no hidden action fields and the button
   * does nothing at all without scripting. The action takes the
   * `useActionState` shape and the component passes it straight through, which
   * is the same arrangement the staff sign-in form already had.
   */
  const card = readSource("components/admin/mail-check.tsx");

  /*
   * 🔴 AND THE PAGE SHOWS WHO EACH ONE IS FOR, which is what the founder had to
   * ask about after reading all fourteen in an inbox.
   */
  check(
    "🔴 78.4 the console groups the list by recipient",
    /const AUDIENCES = \["patient", "clinician", "company", "partner", "our staff"\]/.test(card) &&
      /previewRoster\(previewMessages\(\)\)/.test(settings),
    "a flat list of every message reads as a survey of the product and is a survey of one audience",
  );

  check(
    "🔴 …and its form is a direct server reference, so it submits without JavaScript",
    /useActionState<AdminActionState, FormData>\(sendEveryTemplate, \{\}\)/.test(card) &&
      /_previous: AdminActionState,\s*\n\s*form: FormData,/.test(adminActions),
    "a wrapper makes the action a client function and the button dies with scripting off",
  );

  /*
   * 🔴 77.14 — AND THE SENDS ARE PACED, because the first version was not.
   *
   * Resend allows ten requests a second. Fourteen bare awaits cleared it and
   * four came back "Too many requests" — the last four in the list, which is
   * the worst failure a tool for looking at every template can have. A count
   * that reports 10 of 14 honestly is still the wrong count. The list is longer
   * now, so the pacing matters more rather than less.
   */
  check(
    "🔴 77.14 the sends are paced and a rejection is retried once",
    /await pause\(150\)/.test(adminActions) && /await pause\(1_000\)/.test(adminActions),
    "ten a second is the provider's limit and a flat loop beats it",
  );

  check(
    "🔴 …and the page allows the action time to finish",
    /export const maxDuration = 60;/.test(settings),
    "a default ceiling cuts the loop off and the count becomes a story about a timeout",
  );

  /*
   * 🔴 C127 — INVENTED PEOPLE ONLY, and this one is reachable from a console
   * rather than from a shell, which makes the rule matter more rather than
   * less. Every surname is Demo or Example and every address is at the domain
   * RFC 2606 reserves.
   */
  /*
   * 🔴 78.4 — THE SCAN READS THE PROSE TOO, because the names moved into it.
   *
   * It matched only a name that was the WHOLE of a quoted string, which was
   * true of every template while each one passed `therapistName: "Dr Nour
   * Demo"` as a field. Twelve of the new messages go through `sendNotification`
   * and build their sentence themselves, so the names are now inside the body,
   * as in "Dr Sara Demo can read your history from now on", where the old
   * pattern could not see them and a real clinician's name would have sailed
   * through.
   *
   * So both shapes are scanned: a quoted name on its own, and any `Dr First
   * Last` anywhere in the file.
   */
  const quoted = previews.match(/"[A-Z][a-z]+ (?:[A-Z][a-z]+)"/g) ?? [];
  const titled = previews.match(/Dr [A-Z][a-z]+ [A-Z][a-z]+/g) ?? [];
  const named = [...quoted, ...titled];
  const strangers = named.filter((n) => !/(Demo|Example|Practice)"?$/.test(n));
  check(
    "🔴 …and every person in the list is invented, in a field or in a sentence",
    strangers.length === 0 && !/@(?!example\.com)[\w-]+\.[a-z]{2,}/.test(previews),
    strangers.join(", ") || `${String(named.length)} names, all Demo or Example`,
  );

  check(
    "🔴 CONTROL that name scan catches a stranger, quoted or in prose",
    ['"Mariam Demo"', '"Nour Demo"', '"Sarah Connor"', "Dr Sara Demo", "Dr Sarah Connor"].filter(
      (n) => !/(Demo|Example|Practice)"?$/.test(n),
    ).length === 2,
    "a surname rule that matched everything would clear a real patient's name",
  );

  /* ================================================================== */
  /*  Area E · the demos do what the product does                       */
  /* ================================================================== */

  check(
    "🔴 E the note demo names its patient through the dictionary, not a literal",
    /patientLabel=\{t\("hdemo\.patientLabel"\)\}/.test(clinical) && !/patientLabel="/.test(clinical),
    "an Arabic reader got 'Session note for demo' in English",
  );

  /*
   * "This is not me" must not call `next`. The detector reads the Tap that
   * carries `pclaim.notMe` and asks what its handler does.
   */
  const notMeAdvances = (src: string) =>
    /<Tap[^>]*onClick=\{next\}[^>]*>\s*\{t\("pclaim\.notMe"\)\}/.test(src);
  const flow = readSource("components/demo/flow-demo.tsx");
  check(
    "🔴 E 'This is not me' in the claim demo declines, as `claim-flow.tsx` does",
    !notMeAdvances(flow) && /set\("declined", true\)/.test(flow) && /pclaim\.noneTitle/.test(flow),
    "saying no walked the reader into the code screen as if they had said yes",
  );
  check(
    "🔴 CONTROL the detector catches the old handler",
    notMeAdvances('<Tap variant="secondary" onClick={next}>\n          {t("pclaim.notMe")}'),
    "a detector that cannot see the old shape proves nothing about the new one",
  );

  const portal = readSource("components/demo/portal-demo.tsx");
  const realRota = readSource("app/(clinic)/clinic/page.tsx");
  check(
    "🔴 E the clinic demo's rota has no column the real /clinic rota lacks",
    !/dpo\.where|modality/.test(portal) &&
      !/modality/.test(readSource("lib/marketing/fixtures.ts")) &&
      !/modality/.test(realRota),
    "the demo showed video or in person; the practice's own rota never has",
  );

  /*
   * 🔴 An Arabic reader keeps the written Arabic floor over an English row.
   * Read at the query: a language with its own constant asks for its own row
   * only, so the English row cannot be the one chosen.
   */
  const demoSrc = readSource("lib/content/demo.ts");
  check(
    "🔴 E the demo copy prefers the same language, then that language's own floor",
    /const ownFloor = floor !== DEMO_FALLBACK;/.test(demoSrc) &&
      /locale === "en" \|\| ownFloor \? \[locale\] : \[locale, "en"\]/.test(demoSrc),
    "an English CMS demo row won over DEMO_FALLBACK_AR",
  );

  const mobileNav = readSource("components/public/mobile-nav.tsx");
  check(
    "🔴 E the phone menu carries the language switch the header hides below 640px",
    /<LanguageSwitch[^>]*offered=\{offered\}[^>]*pathname=\{pathname\}/.test(mobileNav) &&
      /<MobileNav[\s\S]{0,400}offered=\{/.test(readSource("components/public/site-chrome.tsx")) &&
      /hidden sm:inline-flex/.test(readSource("components/public/site-chrome.tsx")),
    "a phone reader of the marketing site could not change language",
  );

  check(
    "🔴 E the Arabic contact default carries no admin instruction as an address",
    !/اضبط العنوان/.test(readFileSync("lib/content/defaults-ar.ts", "utf8")),
    "the Arabic page printed 'set the registered address from the console' as each company's address",
  );

  /*
   * 🔴 PRIVACY: robots. Run, not read: the function the site serves, asked about
   * every door that is not the public site, and about the public pages, which
   * must stay open (the radar exists to be found).
   */
  const rules = robots().rules;
  const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((r) =>
    r.disallow === undefined ? [] : Array.isArray(r.disallow) ? r.disallow : [r.disallow],
  );
  const blocked = (path: string, list: string[]) => list.some((prefix) => path.startsWith(prefix));
  const PRIVATE = [
    "/patient/journal", "/pay/tok", "/feedback/tok", "/records/tok", "/support/tok",
    "/welcome/tok", "/clinic", "/clinic/bills", "/sponsor/pot", "/partner/webhooks", "/j/code",
    "/join/tok", "/sessions/x/room",
  ];
  const PUBLIC = ["/", "/pricing", "/radar", "/for-clinics", "/for-patients", "/t/x", "/ar/pricing"];
  const open = PRIVATE.filter((p) => !blocked(p, disallow));
  const shut = PUBLIC.filter((p) => blocked(p, disallow));
  check(
    process.env.SIMULATION_RUNNING === "1"
      ? "🔴 E robots: a simulation is running, so everything is shut (the rest is not measured)"
      : "🔴 E robots disallows every private door and no public page",
    process.env.SIMULATION_RUNNING === "1" ? disallow.includes("/") : open.length === 0 && shut.length === 0,
    open.length || shut.length
      ? `crawlable: ${open.join(", ") || "none"} · wrongly shut: ${shut.join(", ") || "none"}`
      : `${String(disallow.length)} prefixes`,
  );
  check(
    "🔴 CONTROL the old list leaves the patient record and the capability links crawlable",
    ["/patient/journal", "/pay/tok", "/records/tok", "/clinic"].every(
      (p) => !blocked(p, ["/join/", "/dashboard", "/sessions", "/patients", "/billing", "/admin", "/api/"]),
    ),
    "a prefix test that blocked everything would pass the check above for the wrong reason",
  );

  finish("sprint 77");
}

main();
