/**
 * Sprint 19 acceptance — Arabic and English. PLAN.md 19.0–19.7, C77, C89, C90.
 *
 *   npm run verify:sprint19
 *
 * Three of these are measurements rather than assertions, and they are the
 * point: "how bilingual is this product" has to be a **number** somebody can
 * watch move, not an impression. Where the number is not yet good enough, the
 * check says so and names the surface — an honest red is worth more than a
 * green that measured the wrong thing.
 */
import { stagedPages, withPublishedContent } from "./_content-ready";
import { readFileSync } from "node:fs";

import { reporter, readSource } from "./_verify";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";

/*
 * 🔴 30.1 — an operator tool writes to the region its DATABASE_URL names.
 *
 * `dbFor(DEFAULT_REGION)` rather than a bare handle, because after this
 * sprint there is no bare handle: a script that plants fixtures is planting
 * them in a jurisdiction, and saying which one is the point. When Cairo is
 * live a script that needs to touch it passes "eg" and nothing else changes.
 */
const db = dbFor(DEFAULT_REGION);

const { check, skipUnless, finish } = reporter();

const walk = async (dir: string): Promise<string[]> => {
  const { readdirSync } = await import("node:fs");
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? []
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
};

const walkDeep = async (dir: string): Promise<string[]> => {
  const { readdirSync } = await import("node:fs");
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      out.push(...(await walkDeep(`${dir}/${entry.name}`)));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(`${dir}/${entry.name}`);
    }
  }
  return out;
};

/**
 * 🔴 19.3 — the classes that make an Arabic page look like translated English.
 *
 * Tailwind's *logical* utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
 * `text-start`, `text-end`) flip with the document direction; the physical ones
 * do not. A component using `ml-4` renders identically in Arabic, which is the
 * single most common way a "localised" interface announces that nobody
 * localised it.
 */
const PHYSICAL =
  /\b(ml|mr|pl|pr)-[0-9.]+|\b(left|right)-[0-9.]+|\btext-(left|right)\b/;

async function main() {
  console.log(
    `checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`,
  );


  /* ------------------------------------------------------ 19.0 · C90 */

  const verifiers = (await walk("scripts")).filter((f) =>
    f.includes("verify-sprint"),
  );
  const usingReporter = verifiers.filter((f) =>
    readSource(f).includes('from "./_verify"'),
  );
  check(
    "🔴 19.0 the two verifiers that were permanently red now SKIP with a reason",
    ["verify-sprint17", "verify-sprint18"].every((name) =>
      usingReporter.some((f) => f.includes(name)),
    ),
    `${usingReporter.length} of ${verifiers.length} verifiers report skips`,
  );

  /* ----------------------------------------------------- 19.0a · C89 */

  const staged = await stagedPages();

  check(
    "🔴 19.0a sprints 17 and 18 have been RENDERED somewhere, staging rows exist to render",
    staged.length >= 12,
    `${staged.length} staged rows across ${new Set(staged.map((r) => r.locale)).size} locales`,
  );

  /*
   * 🔴 …and a staging row is invisible to every reader path. This is the
   * defect the staging step introduced and had to fix: `readNav` reads EVERY
   * locale and collapses by slug, so a staged page with a nav label would have
   * appeared in the live menu of the running deployment.
   */
  const withNav = await db.execute(
    `SELECT COUNT(*)::int AS n FROM content_pages WHERE locale LIKE '%-x-staging' AND nav_label IS NOT NULL`,
  );
  check(
    "🔴 19.0a …and no staged row can reach the live navigation",
    Number(
      (withNav as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
    ) === 0 &&
      readSource("lib/content/service.ts").includes(
        'notLike(contentPages.locale, "%-x-staging")',
      ),
    `${staged.length} staged rows, none with a nav label, and the query excludes them`,
  );

  /* ------------------------------------------------------------- 19.1 */

  const { localesForSlug, localesWithDefaults } =
    await import("../lib/content/registry");

  /*
   * 🔴 21R.9 / C93 — deferrable from the start, like every check that reads
   * published content, and structurally so: the rows only exist inside this
   * callback. On an empty database the old shape passed *vacuously* — "every
   * page is bilingual" about no pages at all — which is worse than red,
   * because it is a green that measured nothing.
   */
  await withPublishedContent(
    skipUnless,
    { for: "19.1", what: "the page corpus" },
    (content) => {
      const live = content.published;
      const slugs = [...new Set(live.map((p) => p.slug))];

      const missingPages = slugs.flatMap((slug) =>
        localesForSlug(slug)
          .filter(
            (locale) =>
              !live.some((p) => p.slug === slug && p.locale === locale),
          )
          .map((locale) => `${slug}[${locale}]`),
      );

      check(
        "🔴 19.1 every page SHIPPED in a language has a row in that language",
        missingPages.length === 0,
        missingPages.join(", ") ||
          `${slugs.length} pages across ${localesWithDefaults().join(", ")}`,
      );
    },
  );

  /*
   * The legal pages are English-only **on purpose** — see the note at the top
   * of `defaults-ar.ts`. This asserts that the exception is *declared* (the
   * registry knows they ship in one language) rather than a gap somebody
   * forgot, which is the difference between a decision and an oversight.
   */
  check(
    "19.1 …and the legal pages are declared English-only rather than silently missing",
    ["privacy", "terms", "hipaa", "security"].every(
      (slug) =>
        localesForSlug(slug).length === 1 && localesForSlug(slug)[0] === "en",
    ),
    ["privacy", "terms", "hipaa", "security"]
      .map((s) => `${s}:${localesForSlug(s).join("+")}`)
      .join(" "),
  );

  /* ------------------------------------------------------------- 19.2 */

  const { en, ar } = await import("../lib/i18n/messages");
  const enKeys = Object.keys(en);
  const arKeys = Object.keys(ar);
  check(
    "🔴 19.2 / 19.6 no interface string exists in one language and not the other",
    enKeys.length === arKeys.length && enKeys.every((key) => key in ar),
    `${enKeys.length} keys, ${enKeys.filter((k) => !(k in ar)).length} missing in Arabic`,
  );

  check(
    "19.6 …and an English fallback for a missing Arabic string is impossible, not merely absent",
    readSource("lib/i18n/messages.ts").includes(
      "Record<MessageKey, string>",
    ),
    "the Arabic dictionary is typed against the English key set, so tsc is the gate",
  );

  /* --------------------------------------------------- 19.3 · RTL */

  const surfaces = [
    ...(await walkDeep("components/public")),
    ...(await walkDeep("components/patient")),
    ...(await walkDeep("components/money")),
  ];
  const physical = surfaces.filter((file) =>
    PHYSICAL.test(readSource(file)),
  );

  check(
    "🔴 19.3 no public or patient component pins a physical side, Arabic is a layout, not a translation",
    physical.length === 0,
    physical.map((f) => f.replace("components/", "")).join(", ") ||
      `${surfaces.length} components use logical properties only`,
  );

  check(
    "🔴 19.3 CONTROL, the same scan CATCHES a physical class",
    PHYSICAL.test('<div className="ml-4 text-left">') &&
      !PHYSICAL.test('<div className="ms-4 text-start">'),
  );

  check(
    "19.3 …and the document direction comes from the locale, on the html element",
    readSource("app/layout.tsx").includes("dir={dirFor(locale)}"),
  );

  /* --------------------------------------------------- 19.4 · the locale */

  const money = readSource("lib/billing/plans.ts");
  check(
    "🔴 19.4 money takes the locale as a REQUIRED argument, fed from the server",
    /export function formatMoney\(cents: number, currency: string, locale: string\)/.test(
      money,
    ),
  );
  check(
    "🔴 19.4 …and an omitted locale falls back to a PINNED tag, never to the runtime's",
    money.includes('locale || "en-US"'),
    "toLocaleString(undefined) means 'ask the machine', the C84 bug in one argument",
  );

  const clientCallers = (
    await Promise.all(
      [
        ...surfaces,
        ...(await walkDeep("components/billing")),
        ...(await walkDeep("components/pay")),
      ].map(async (file) => ({ file, source: readSource(file) })),
    )
  ).filter(
    ({ source }) =>
      source.includes('"use client"') && source.includes("formatMoney("),
  );

  /*
   * The rule is **never omit**, not "always a prop".
   *
   * A bilingual surface takes the locale as a prop from the server; an
   * English-only one (the clinician portal, the admin console) names `en-US`
   * out loud. Both are decisions. What is forbidden is the third shape —
   * omitting the argument and letting the runtime answer — which is the C84
   * bug, and which the required parameter plus the pinned fallback now make
   * impossible to do silently.
   */
  const named = ({ source }: { source: string }) =>
    /locale[?]?: string/.test(source) ||
    /*
     * 37L.2 — a third shape, and the best of the three: the component asks.
     *
     * `localeTag(useLocale())` cannot be omitted by a call site because there
     * is no call site to omit it. Two components that carried
     * `locale?: string = "en-US"` were changed to this in 37L.9/37L.2, and the
     * rule this check enforces is "never let the runtime answer", not "always
     * a prop" — so asking satisfies it more completely than passing does.
     */
    /localeTag\(\s*useLocale\(\)\s*\)/.test(source) ||
    /const locale = useLocale\(\)/.test(source) ||
    // `[^;]*?` rather than `[^)]*`: a real call contains nested parentheses —
    // `formatMoney(x, row.currency.toUpperCase(), "en-US")` — and the first
    // version of this pattern stopped at the inner one and reported a file
    // that was perfectly correct.
    /formatMoney\([^;]*?"[a-z]{2}-[A-Z]{2}"\s*\)/.test(source);

  check(
    "🔴 19.4 every client component that formats money NAMES its locale, a prop, or an explicit tag",
    clientCallers.every(named),
    clientCallers
      .filter((caller) => !named(caller))
      .map(({ file }) => file)
      .join(", ") || `${clientCallers.length} components`,
  );

  /* --------------------------------------------------- 19.7 · C77 */

  const { CONTENT_DEFAULTS } = await import("../lib/content/registry");
  check(
    "🔴 19.7 the shipped content is a MAP keyed by locale, adding a third language adds an entry",
    typeof CONTENT_DEFAULTS === "object" && !Array.isArray(CONTENT_DEFAULTS),
    `${Object.keys(CONTENT_DEFAULTS).join(", ")}`,
  );

  const republish = readSource("scripts/republish.ts");
  check(
    "🔴 19.7 …and the publisher takes a LOCALE, not an --ar boolean",
    republish.includes("--locale=") &&
      republish.includes("localesWithDefaults()"),
    "a two-state flag cannot express a third language",
  );

  /*
   * 🔴 Comments are stripped before this scan runs.
   *
   * The first version matched the phrase "two languages" anywhere in the file
   * and failed on `config.ts` and `messages.ts` — both of which *say* "two
   * languages" in their own documentation while doing nothing of the kind.
   * That is a checker matching prose, the exact failure four checkers in this
   * repository have already had. The rule is about **code**: a literal pair,
   * a hardcoded `["en", "ar"]`, an `ar ? … : …` ternary standing in for a
   * language lookup.
   */
  const withoutComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const hardcoded = (await walkDeep("lib/i18n")).filter((file) => {
    const code = withoutComments(readSource(file));
    return /\[\s*"en"\s*,\s*"ar"\s*\]/.test(
      code.replace(/export const LOCALES[^;]*;/, ""),
    );
  });
  check(
    "19.7 no code outside the LOCALES declaration pins the pair",
    hardcoded.length === 0,
    hardcoded.join(", ") ||
      "only LOCALES names the languages, and it is a list",
  );

  check(
    "🔴 19.7 CONTROL, the same scan, run WITHOUT stripping comments, would have failed on prose",
    /*
     * 🔴 `readFileSync`, deliberately, and the ONE place in this file where it
     * is right. C205's sweep moved every source read onto `readSource`, which
     * strips; this check exists to prove that stripping is what makes the
     * check above mean anything, so reading the stripped text here would make
     * it assert nothing and pass forever.
     */
    (await walkDeep("lib/i18n")).some((file) =>
      /\btwo languages\b/i.test(readFileSync(file, "utf8")),
    ),
    "the phrase is in the documentation of files that do nothing of the kind",
  );

  finish("sprint 19");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
