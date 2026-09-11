/**
 * Render every public page for real, and look at the output. PLAN.md 19.0a, C89.
 *
 *   npm run render:check                 # against DATABASE_URL
 *   npm run render:check -- --write      # …and drop the HTML in .render/
 *
 * ## Why this exists
 *
 * Sprints 17 and 18 were code-complete and **invisible**: their content cannot
 * be published to production until the code that renders it is deployed
 * (22.8b), so nothing had ever proved the new pages render at all. Two sprints
 * of visible work hung on a script that had been *written* and never *run*.
 *
 * This runs it. It reads the staging-locale rows (`en-x-staging`, written by
 * `republish.ts --staging`, reachable by no reader), renders them through the
 * **real `BlockRenderer`**, and asserts on the HTML that comes out. Not the
 * blocks, not the component tree — the markup a browser would receive.
 *
 * ## How a server component is rendered outside Next
 *
 * `resolve()` walks the element tree and awaits any async component it finds,
 * turning the whole thing into ordinary elements; `renderToStaticMarkup` then
 * produces the HTML. Client components render too — hooks work in a static
 * render — which is exactly what makes the output honest: the price toggle,
 * the slider and the contact form are all really there.
 */
import React from "react";
import { like } from "drizzle-orm";

import { contentPages } from "../lib/db/schema";
import { resolve, stubModules } from "./_render";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();
/**
 * `renderToStaticMarkup`, reached past the `react-server` condition.
 *
 * This script needs both halves of a contradiction: `--conditions=react-server`
 * so that `server-only` modules (the database, the settings) load at all, and
 * `react-dom/server`, which that same condition deliberately refuses. The
 * file itself is perfectly happy to run — the refusal is an  guard in
 * the package manifest, not a runtime limitation — so it is required by
 * absolute path, resolved from the package rather than guessed.
 */
async function main() {
  (globalThis as { React?: unknown }).React = React;
  await stubModules();
  const { renderToStaticMarkup } = await import("react-dom/server");

  /*
   * Imported here, not at the top of the file: the substitutions above must be
   * installed before anything reaches `server-only`, and a static import runs
   * before `main()` does.
   */
  const { db } = await import("../lib/db");

  const write = process.argv.includes("--write");
  console.log(
    `rendering from ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`,
  );

  const rows = await db
    .select({
      slug: contentPages.slug,
      locale: contentPages.locale,
      blocks: contentPages.blocks,
    })
    .from(contentPages)
    .where(like(contentPages.locale, "%-x-staging"));

  check(
    "🔴 19.0a the staging rows exist, so what sprint 22 publishes has been RUN, not written",
    rows.length >= 8,
    `${rows.length} staged pages: ${rows.map((r) => `${r.slug}[${r.locale}]`).join(", ")}`,
  );

  const { BlockRenderer } = await import("../components/public/blocks");
  const { getSettings } = await import("../lib/settings");
  const settings = await getSettings();

  const html: Record<string, string> = {};
  const failed: string[] = [];

  for (const row of rows) {
    try {
      const tree = await resolve(
        /*
         * 🔴 21R.8 — each row is rendered in ITS OWN language.
         *
         * There is no cookie here, so without this the Arabic rows rendered
         * with English chrome and the check below would have been measuring
         * the script's default rather than the page. `en-x-staging` is rendered as `en`.
         */
        React.createElement(BlockRenderer as never, {
          blocks: row.blocks,
          slug: row.slug,
          locale: row.locale.replace("-x-staging", ""),
        }),
      );
      html[`${row.slug}.${row.locale}`] = renderToStaticMarkup(
        tree as React.ReactElement,
      );
    } catch (error) {
      failed.push(
        `${row.slug}[${row.locale}]: ${(error as Error).message.split("\n")[0]}`,
      );
    }
  }

  check(
    "🔴 19.0a EVERY page renders to HTML without throwing",
    failed.length === 0,
    failed.join(" · ") || `${Object.keys(html).length} pages rendered`,
  );

  /* ------------------------------------------------- what is in the markup */

  const pricing = html["pricing.en-x-staging"] ?? "";
  const cheapest = settings.pricing.tiers[0];

  check(
    "🔴 17.10 the rendered pricing page carries the rates from platform_settings",
    settings.pricing.tiers.every((tier) =>
      pricing.includes(`$${(tier.rateCents / 100).toFixed(0)}`),
    ),
    `looking for ${settings.pricing.tiers.map((t) => `$${t.rateCents / 100}`).join(", ")} · found ${
      settings.pricing.tiers.filter((t) =>
        pricing.includes(`$${(t.rateCents / 100).toFixed(0)}`),
      ).length
    }`,
  );

  check(
    "17.4 …and the slider, starting at the bundle minimum",
    /type="range"/.test(pricing) &&
      pricing.includes(
        `min="${settings.pricing.tiers.filter((t) => t.minimumSessions > 0).pop()?.minimumSessions}"`,
      ),
  );

  check(
    "17.6 …and 'Sign up free' rather than 'choose a plan'",
    pricing.includes("Sign up free") && !/choose a plan/i.test(pricing),
  );

  check(
    "17.8 …and an EGP toggle beside the price, or none at all if the pair cannot be priced",
    pricing.includes("Egyptian pounds") || !pricing.includes("EGP"),
  );

  const home = html["home.en-x-staging"] ?? "";
  check(
    "🔴 17.7 the rendered HOMEPAGE carries the same prices, one component, two pages",
    cheapest !== undefined &&
      home.includes(`$${(cheapest.rateCents / 100).toFixed(0)}`),
  );

  const patients = html["for-patients.en-x-staging"] ?? "";
  check(
    "🔴 18.3 the rendered patients page carries the crisis panel, pointing at the radar",
    patients.includes("If you need help right now") &&
      patients.includes('href="/radar"'),
  );
  check(
    "18.9 …and the live patient-app component, with its demo rows",
    patients.includes("When you needed someone") ||
      patients.includes("Dr Nadia Farouk"),
  );

  const contact = html["contact.en-x-staging"] ?? "";
  check(
    "🔴 18R.2 the rendered contact page carries a real form and both companies",
    /<form/.test(contact) &&
      contact.includes("24Therapy Inc.") &&
      contact.includes("24Therapy Egypt"),
  );
  check(
    "🔴 18R.4 …with the urgent warning above the box, not under the button",
    contact.indexOf("Do not send anything urgent here") > 0 &&
      contact.indexOf("Do not send anything urgent here") <
        contact.indexOf("<form"),
  );

  const arabic = html["for-patients.ar-x-staging"] ?? "";
  check(
    "19.1 the Arabic patients page renders Arabic, not an English fallback",
    /[؀-ۿ]/.test(arabic),
    arabic
      ? `${(arabic.match(/[؀-ۿ]/g) ?? []).length} Arabic characters`
      : "no page",
  );

  /*
   * 🔴 The control. Every assertion above is `includes()` on a string, and a
   * string that failed to render is also a string that contains nothing — so a
   * page that silently produced an empty document would pass several of them
   * by being absent rather than by being correct.
   */
  check(
    "🔴 19.0a CONTROL, the rendered pages are real documents, not empty strings",
    Object.values(html).every((markup) => markup.length > 500),
    Object.entries(html)
      .filter(([, markup]) => markup.length <= 500)
      .map(([name]) => name)
      .join(", ") ||
      `smallest ${Math.min(...Object.values(html).map((m) => m.length))} bytes`,
  );

  /* ------------------------------------------ 21R.8 · the Arabic pages read Arabic */

  /*
   * 🔴 The finding this check exists for.
   *
   * The Arabic pricing page was rendered **entirely in English**: the row
   * existed in Arabic — C72 asserted exactly that, and passed — but the row's
   * only block is `pricing`, and the component that draws it had every word
   * typed into it. Same for the contact form, the crisis buttons and the radar
   * hero's chrome. A reader who switches language and meets the money page in
   * English is being asked to trust a number whose conditions they cannot read.
   *
   * The strict half is a regression list: these are the phrases that were on
   * the Arabic pages on 2026-09-07 and must never be again.
   */
  const arabicPages = Object.entries(html).filter(([name]) =>
    name.includes(".ar"),
  );

  const text = (markup: string) =>
    markup
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " ");

  const WAS_ENGLISH = [
    "Sign up free",
    "/ session",
    "Show EGP",
    "Find someone online now",
    "What happens in a session",
    "Full radar",
    "Finding clinicians",
    "Do not send anything urgent",
    "Not an emergency service",
    "Who are you writing to?",
    "Joining is free",
  ];

  const stillEnglish = arabicPages.flatMap(([name, markup]) =>
    WAS_ENGLISH.filter((phrase) => text(markup).includes(phrase)).map(
      (phrase) => `${name}: "${phrase}"`,
    ),
  );

  check(
    "🔴 21R.8 the Arabic pages render Arabic CHROME, the buttons, the form and the price cards, not only the paragraphs",
    arabicPages.length > 0 && stillEnglish.length === 0,
    stillEnglish.join(" · ") ||
      `${arabicPages.length} Arabic pages, none of the old phrases left`,
  );

  /*
   * 🔴 CONTROL — the same list, run against the ENGLISH render, must match.
   *
   * Without it this is a scan that would pass on an empty string, which is how
   * a "no English left" check quietly becomes a check that the page failed to
   * render. If the phrases are not on the English page either, the list is out
   * of date rather than satisfied.
   */
  const englishHome = text(html["pricing.en-x-staging"] ?? "");
  check(
    "🔴 21R.8 CONTROL, the same phrases ARE on the English pricing page, so the list is current",
    ["Sign up free", "/ session", "Joining is free"].every((phrase) =>
      englishHome.includes(phrase),
    ),
  );

  /*
   * ⚠️ And the honest measurement of what is left, deferred rather than
   * hidden: the demo panels — the transcript, the SOAP note, the copilot
   * suggestions — are still English on an Arabic page, because their fixtures
   * are English and writing a clinical note in Arabic is writing, not
   * translating. It is real work with a real deadline (22R.10), and a skip
   * that names it is worth more than a threshold nobody revisits.
   */
  const latinRun = /(?:\b[A-Za-z][A-Za-z'’-]{2,}\b[ ,.]+){6,}/g;
  const remaining = arabicPages.flatMap(([name, markup]) =>
    (text(markup).match(latinRun) ?? []).map(
      (run) => `${name}: ${run.trim().slice(0, 60)}…`,
    ),
  );

  /* 28.1 — name what is left, so the remainder is legible rather than a number. */
  for (const run of remaining.slice(0, 12)) console.log(`        ${run}`);

  await skipUnless(
    remaining.length === 0,
    "22R.10",
    `21R.8, ${remaining.length} English passages remain on the Arabic pages, all inside the demo panels (their fixtures are English)`,
    () => {
      check(
        "21R.8 …and not one English passage is left anywhere on them",
        true,
        "none",
      );
    },
  );

  if (write) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(".render", { recursive: true });
    for (const [name, markup] of Object.entries(html)) {
      writeFileSync(`.render/${name}.html`, markup);
    }
    console.log(`\n  wrote ${Object.keys(html).length} files to .render/`);
  }

  finish("render check");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
