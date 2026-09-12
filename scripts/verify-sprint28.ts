/**
 * Sprint 28 acceptance: the site talks to patients honestly. PLAN.md 28.1-28.6.
 *
 *   npm run verify:sprint28
 *
 * Three rules, all of them about words, so all of them checked as words and
 * every one proved against a planted offender:
 *
 *   - **28.2 / C109** "paid sessions cover our fee" appears nowhere. It is
 *     arithmetically false at the prices this is sold at.
 *   - **28.3 / C110** no earnings promise anywhere. A forecast about somebody
 *     else's business is not ours to make.
 *   - **28.4** the patient page says plainly that they never talk to the model,
 *     and the claim is backed by 24.2's import guard rather than by the
 *     sentence.
 *
 * 🔴 Every content check reads the **published rows**, never the defaults
 * file. C148: the code being right has never been the same thing as the
 * database serving the right thing, and that has now cost four sprints.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { DEFAULT_PAGES } from "../lib/content/defaults";
import { DEFAULT_PAGES_AR } from "../lib/content/defaults-ar";
import { honestyProblems, honestyProblemsIn, readableStrings } from "../lib/content/honesty";
import { CONTENT_DEMOS } from "../lib/db/schema";
import { withPublishedContent } from "./_content-ready";
import { stripComments } from "./_dashes";
import { reporter, readSource } from "./_verify";

const { check, skipUnless, finish } = reporter();

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  /* --------------------------------------------- 28.2 / 28.3 · the rows */

  await withPublishedContent(
    skipUnless,
    { for: "28.2", what: "the page corpus" },
    (content) => {
      const hits = content.published.flatMap((page) =>
        honestyProblemsIn(`${page.slug}[${page.locale}]`, page.blocks),
      );

      const fee = hits.filter((hit) => hit.rule === "fee");
      const earnings = hits.filter((hit) => hit.rule === "earnings");

      check(
        "🔴 28.2 / C109 no published page says the sessions cover our fee",
        fee.length === 0,
        fee.map((hit) => `${hit.where}: "${hit.text}"`).join(" · ") ||
          `${content.published.length} pages scanned`,
      );

      check(
        "🔴 28.3 / C110 nor promises anybody an income",
        earnings.length === 0,
        earnings.map((hit) => `${hit.where}: "${hit.text}"`).join(" · ") ||
          `${content.published.length} pages scanned`,
      );
    },
  );

  /*
   * The shipped defaults too, because a purge reseeds from them: a page that
   * is clean in the database and dishonest in `defaults.ts` is one `db:seed`
   * away from being live, which is C148 read forwards instead of backwards.
   */
  const inDefaults = [...DEFAULT_PAGES, ...DEFAULT_PAGES_AR].flatMap((page) =>
    honestyProblemsIn(page.slug, page.blocks),
  );

  check(
    "🔴 28.2 / 28.3 …and neither does the copy a purge would reseed from",
    inDefaults.length === 0,
    inDefaults.map((hit) => `${hit.where}: "${hit.text}"`).join(" · ") ||
      `${DEFAULT_PAGES.length + DEFAULT_PAGES_AR.length} default pages scanned`,
  );

  /*
   * 🔴 The controls. Both sentences, in the forms somebody would actually
   * write them, because a scanner that has never caught anything has not been
   * shown to work.
   */
  const feeControl = honestyProblems(
    "control",
    "Two paid sessions cover our fee, so for most therapists the platform is free.",
  );
  check(
    "🔴 28.2 CONTROL, the same scan CATCHES the false claim §7 names",
    feeControl.some((hit) => hit.rule === "fee"),
    feeControl[0]?.text ?? "THE SCAN IS BLIND",
  );

  const earningsControl = honestyProblems(
    "control",
    "Go on the radar and you will earn up to $3,000 a month.",
  );
  check(
    "🔴 28.3 CONTROL, and catches an earnings promise",
    earningsControl.some((hit) => hit.rule === "earnings"),
    earningsControl.find((hit) => hit.rule === "earnings")?.text ?? "THE SCAN IS BLIND",
  );

  /*
   * 🔴 And the other half of a usable rule: the legitimate sentences must
   * survive. "Earnings" is a real word here — there is an earnings page, and
   * the fee comes out of held earnings — so a scanner that flagged those would
   * be switched off within a month, which is the failure mode 24.1 avoided by
   * exempting comments.
   */
  const legitimate = [
    "You can watch every step of that on your earnings page.",
    "What you owe comes out of what you earn before it reaches your account.",
    "Go online and get booked by somebody who needs an hour tonight.",
    "When we are holding your earnings the session fee comes out of them automatically.",
  ];
  const falsePositives = legitimate.filter((text) => honestyProblems("legit", text).length > 0);

  check(
    "🔴 28.2 / 28.3 …and the TRUE sentences about money are not flagged, or the rule gets deleted",
    falsePositives.length === 0,
    falsePositives.join(" · ") || `${legitimate.length} legitimate passages left alone`,
  );

  /* ------------------------------------------ 28.2 / 28.3 · at the door */

  const adminActions = stripComments(readSource("app/(admin)/admin/actions.ts"));
  check(
    "🔴 28.2 / 28.3 an admin cannot PUBLISH one either, the save refuses it",
    /honestyProblemsIn\(/.test(adminActions) && /return \{ error: honestyMessage\(/.test(adminActions),
    "refused at savePage, so the scan above is about history rather than the future",
  );

  /* ------------------------------------------------------ 28.1 / 28.4 */

  await withPublishedContent(
    skipUnless,
    { for: "28.1", what: "the patient page" },
    (content) => {
      const pages = content.published.filter((page) => page.slug === "for-patients");

      check(
        "28.1 the patient page is published in both languages",
        new Set(pages.map((page) => page.locale)).size >= 2,
        pages.map((page) => page.locale).join(", ") || "none published",
      );

      for (const page of pages) {
        const text = readableStrings(page.blocks)
          .map((entry) => entry.text)
          .join(" ");

        /*
         * 🔴 28.4 asserted as a claim the page MAKES, in the reader's own
         * language. English looks for the sentence; Arabic looks for the two
         * words that carry it, because a translation is not a string match.
         */
        const saysIt =
          page.locale === "ar"
            ? /لا تتحدث إلى الذكاء/.test(text)
            : /you never talk to the ai/i.test(text);

        check(
          `🔴 28.4 the patient page says plainly that you never talk to the model [${page.locale}]`,
          saysIt,
        );

        const saysPortability =
          page.locale === "ar" ? /ينتقل معك/.test(text) : /moves with you/i.test(text);

        check(
          `28.1 …and is repositioned around the record moving with you [${page.locale}]`,
          saysPortability,
        );
      }
    },
  );

  /*
   * 🔴 28.4's claim is only honest because 24.2 enforces it. Asserted here as
   * well as there, because this is the sprint that PUBLISHES the sentence, and
   * a claim on a marketing page whose guard was quietly deleted is worse than
   * no claim at all.
   */
  const guard = readSource("scripts/verify-sprint24.ts");
  check(
    "🔴 28.4 …and the sentence is backed by the import guard rather than by itself",
    /reachesAi/.test(guard) && /app\/\(patient\)/.test(guard),
    "24.2 walks every patient page to its imports, transitively",
  );

  /* --------------------------------------------------------- 28.5 */

  const routes = [
    "app/(public)/integrations/page.tsx",
    "app/(public)/integrations/[slug]/page.tsx",
    "app/(public)/for-clinics/page.tsx",
    "app/(public)/developers/page.tsx",
    "app/(public)/verify/page.tsx",
    "app/(public)/verify/[code]/page.tsx",
  ];
  const missing = routes.filter((route) => {
    try {
      readSource(route);
      return false;
    } catch {
      return true;
    }
  });

  check("28.5 every new public page exists as a route", missing.length === 0, missing.join(", "));

  const { INTEGRATIONS } = await import("../lib/integrations/registry");

  /*
   * 🔴 C149 — the integrations page is only honest if a `planned` entry SAYS
   * so. Asserted on the data rather than the rendering: every entry declares a
   * state, and every unbuilt one says "nothing works today" in its own prose,
   * so a future editor cannot soften one without the check noticing.
   */
  const unlabelled = INTEGRATIONS.filter(
    (entry) => entry.state === "planned" && !/nothing works today/i.test(entry.today),
  );

  check(
    "🔴 28.5 / C149 every unbuilt integration says so in its own words, not in a footnote",
    unlabelled.length === 0,
    unlabelled.map((entry) => entry.slug).join(", ") ||
      `${INTEGRATIONS.filter((entry) => entry.state === "planned").length} marked not built`,
  );

  check(
    "28.5 …and every integration carries what it does NOT do, including the ones that work",
    INTEGRATIONS.every((entry) => entry.limits.trim().length > 40),
    `${INTEGRATIONS.length} entries`,
  );

  const developers = stripComments(readSource("app/(public)/developers/page.tsx"));
  check(
    "🔴 28.5 the developer page says there is no API rather than documenting the internal routes",
    /There is no public API yet/.test(developers) && !/https?:\/\/[^"]*\/api\//.test(developers),
    "an endpoint list for an unversioned internal route is a lie with syntax highlighting",
  );

  /* --------------------------------------------------------- 28.6 */

  const showcase = stripComments(readSource("components/demo/component-showcase.tsx"));
  const drawable = [...showcase.matchAll(/case "([a-z-]+)":/g)].map((match) => match[1]!);

  check(
    "28.6 the two screens sprint 26 gave the patient are drawable as live components",
    drawable.includes("summary") && drawable.includes("journal"),
    drawable.join(", "),
  );

  check(
    "28.6 …and every demo the content model offers is one the renderer can draw",
    CONTENT_DEMOS.filter((demo) => demo !== "none").every(
      (demo) => drawable.includes(demo) || ["session-room", "radar"].includes(demo),
    ),
    CONTENT_DEMOS.join(", "),
  );

  /*
   * 🔴 C123 governs the PICTURE of the journal as well as the journal. A demo
   * that draws a reassuring shield beside somebody's 3am entry makes the same
   * false promise in a smaller frame.
   */
  const journalDemo = showcase.slice(showcase.indexOf('case "journal"'));
  check(
    "🔴 28.6 / C123 the journal demo promises no watcher either",
    !/therapist (reads|is reading)|watching|monitor/i.test(journalDemo.slice(0, 900)),
    "no shield, no reassurance, in the demo or the real screen",
  );

  /* ------------------------------------------------- C147, proved */

  /*
   * 🔴 The handover's other finding, proved rather than asserted: a verifier
   * pointed at a database with no fixtures must read like an operator mistake.
   * Run in a subprocess so the exit code and the message are the real ones.
   */
  const probe = "scripts/_verify28-probe.ts";
  try {
    writeFileSync(
      probe,
      `import { required } from "./_verify";\nrequired(undefined, "therapist to plant fixtures against");\n`,
    );

    let output = "";
    let code = 0;
    try {
      output = execFileSync(
        "node",
        ["--import", "tsx", "--conditions=react-server", probe],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stderr?: string; stdout?: string };
      code = failure.status ?? 0;
      output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    }

    check(
      "🔴 C147 CONTROL, a missing fixture exits 1 with an operator message and no stack trace",
      code === 1 && /has no therapist/.test(output) && !/TypeError/.test(output),
      output.trim().split("\n")[1]?.trim() ?? output.trim().slice(0, 80),
    );
  } finally {
    rmSync(probe, { force: true });
  }

  finish("sprint 28");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
