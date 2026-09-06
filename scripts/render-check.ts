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
import { reporter } from "./_verify";

const { check, finish } = reporter();

/**
 * Two narrow module substitutions, and why each is needed.
 *
 * `next/link` builds a React context at import time and there is no renderer
 * mounted here; it is replaced by a plain anchor (see `verify-sprint17.ts`).
 *
 * `server-only` is a bundler guard whose entire implementation is a throw
 * unless the `react-server` export condition is set — and this script needs
 * the *full* React build, because the demo error boundary is a class component
 * and the react-server build has no `Component`. Nothing under test changes:
 * these are the real modules, rendered on a server, in a script.
 *
 * Deliberately two exact module ids. A broad mock would let a real failure be
 * answered by a stub.
 */
async function stubModules() {
  const { createRequire } = await import("node:module");
  const Module = (await import("node:module")).default as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string;
  };
  const require = createRequire(import.meta.url);
  const link = require.resolve("./_stub-link.tsx");
  const empty = require.resolve("./_stub-empty.ts");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === "next/link") return link;
    if (request === "server-only") return empty;
    return original.call(this, request, ...rest);
  };
}

/** Await every async component in the tree, leaving plain elements behind. */
async function resolve(node: unknown): Promise<unknown> {
  if (node === null || node === undefined || typeof node !== "object") return node;

  if (Array.isArray(node)) return Promise.all(node.map(resolve));

  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!("type" in element)) return node;

  if (typeof element.type === "function") {
    /*
     * Server components are run here; client components are left for React.
     *
     * The distinction cannot be read off the function, so it is discovered by
     * trying: a **server** component is a plain function that returns markup
     * (or a promise of it), while a client component reaches for a hook
     * dispatcher that only exists inside a renderer, and a class component
     * cannot be called at all. Both fail loudly and immediately, and the
     * element is handed back untouched for `renderToStaticMarkup`, which knows
     * how to do it properly.
     *
     * This has to run *through* synchronous server components, not only async
     * ones: `PricingTiers` is returned by a plain `Block`, and the first
     * version of this walk stopped at `Block` and reported three pages as "a
     * component suspended" — a failure that had nothing to do with the pages.
     * A partial walk is worse than none, because it still looks like a render.
     */
    try {
      const produced = (element.type as (p: unknown) => unknown)(element.props ?? {});
      const awaited = produced instanceof Promise ? await produced : produced;
      return await resolve(awaited);
    } catch {
      return node;
    }
  }

  if (element.props && "children" in element.props) {
    return {
      ...element,
      props: { ...element.props, children: await resolve(element.props.children) },
    };
  }

  return node;
}

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
  console.log(`rendering from ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

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
        React.createElement(BlockRenderer as never, { blocks: row.blocks, slug: row.slug }),
      );
      html[`${row.slug}.${row.locale}`] = renderToStaticMarkup(tree as React.ReactElement);
    } catch (error) {
      failed.push(`${row.slug}[${row.locale}]: ${(error as Error).message.split("\n")[0]}`);
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
      settings.pricing.tiers.filter((t) => pricing.includes(`$${(t.rateCents / 100).toFixed(0)}`)).length
    }`,
  );

  check(
    "17.4 …and the slider, starting at the bundle minimum",
    /type="range"/.test(pricing) &&
      pricing.includes(`min="${settings.pricing.tiers.filter((t) => t.minimumSessions > 0).pop()?.minimumSessions}"`),
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
    "🔴 17.7 the rendered HOMEPAGE carries the same prices — one component, two pages",
    cheapest !== undefined && home.includes(`$${(cheapest.rateCents / 100).toFixed(0)}`),
  );

  const patients = html["for-patients.en-x-staging"] ?? "";
  check(
    "🔴 18.3 the rendered patients page carries the crisis panel, pointing at the radar",
    patients.includes("If you need help right now") && patients.includes('href="/radar"'),
  );
  check(
    "18.9 …and the live patient-app component, with its demo rows",
    patients.includes("When you needed someone") || patients.includes("Dr Nadia Farouk"),
  );

  const contact = html["contact.en-x-staging"] ?? "";
  check(
    "🔴 18R.2 the rendered contact page carries a real form and both companies",
    /<form/.test(contact) && contact.includes("24Therapy Inc.") && contact.includes("24Therapy Egypt"),
  );
  check(
    "🔴 18R.4 …with the urgent warning above the box, not under the button",
    contact.indexOf("Do not send anything urgent here") > 0 &&
      contact.indexOf("Do not send anything urgent here") < contact.indexOf("<form"),
  );

  const arabic = html["for-patients.ar-x-staging"] ?? "";
  check(
    "19.1 the Arabic patients page renders Arabic, not an English fallback",
    /[؀-ۿ]/.test(arabic),
    arabic ? `${(arabic.match(/[؀-ۿ]/g) ?? []).length} Arabic characters` : "no page",
  );

  /*
   * 🔴 The control. Every assertion above is `includes()` on a string, and a
   * string that failed to render is also a string that contains nothing — so a
   * page that silently produced an empty document would pass several of them
   * by being absent rather than by being correct.
   */
  check(
    "🔴 19.0a CONTROL — the rendered pages are real documents, not empty strings",
    Object.values(html).every((markup) => markup.length > 500),
    Object.entries(html)
      .filter(([, markup]) => markup.length <= 500)
      .map(([name]) => name)
      .join(", ") ||
      `smallest ${Math.min(...Object.values(html).map((m) => m.length))} bytes`,
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
