/**
 * Sprint 17 acceptance — the pricing story. PLAN.md 17.1–17.10, C25, C69.
 *
 *   npm run verify:sprint17
 *
 * The acceptance criterion is one sentence — *no page states a price, rate,
 * cut or minimum that disagrees with `platform_settings`, in either currency*
 * — and it is the criterion C60 failed for a fortnight while a hero paragraph
 * went on selling $6.
 *
 * So this does not read the source and hope. It **renders the real component**
 * and walks the element tree it returns, reading the numbers actually handed
 * to every price on the page, and it scans every published content row in
 * every locale for a price-shaped string — with a planted offender to prove
 * the scan can see one.
 */
import React from "react";
import { and, eq } from "drizzle-orm";

import { contentPages, type ContentBlock } from "../lib/db/schema";
import { withPublishedContent } from "./_content-ready";
import { reporter } from "./_verify";
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

/* ---------------------------------------------------------------- tree -- */

type Node = { type: unknown; props: Record<string, unknown> } | unknown;

/** Every element in a rendered tree, flattened. Server components included. */
async function flatten(
  node: Node,
  out: { name: string; props: Record<string, unknown> }[] = [],
) {
  if (node === null || node === undefined || typeof node === "boolean")
    return out;

  if (Array.isArray(node)) {
    for (const child of node) await flatten(child, out);
    return out;
  }

  if (typeof node === "object" && node !== null && "props" in node) {
    const element = node as { type: unknown; props: Record<string, unknown> };
    const name =
      typeof element.type === "string"
        ? element.type
        : typeof element.type === "function"
          ? ((element.type as { name?: string }).name ?? "anonymous")
          : "unknown";

    out.push({ name, props: element.props ?? {} });

    /*
     * A nested *server* component has not run yet — it is an element whose
     * type is an async function. Calling it is what makes this a real render
     * rather than a look at the outermost layer, and it is how the slider's
     * props get read at all.
     */
    if (
      typeof element.type === "function" &&
      name !== "PriceTag" &&
      name !== "BundleSlider"
    ) {
      try {
        const rendered = await (element.type as (p: unknown) => unknown)(
          element.props,
        );
        await flatten(rendered, out);
      } catch {
        /* A client component that cannot run here is fine — its props are already recorded. */
      }
    }

    if (element.props && "children" in element.props) {
      await flatten(element.props.children as Node, out);
    }
  }

  return out;
}

function textOf(nodes: { props: Record<string, unknown> }[]): string {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") parts.push(value);
    else if (typeof value === "number") parts.push(String(value));
    else if (Array.isArray(value)) value.forEach(walk);
  };
  for (const node of nodes) walk(node.props.children);
  return parts.join(" ");
}

const MONEY = /(?:\$|USD\s?|EGP\s?|E£)\s?\d[\d,.]*|\b\d+\s?%/;

function moneyIn(blocks: ContentBlock[]): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      for (const hit of value.matchAll(new RegExp(MONEY, "g")))
        found.push(hit[0]);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  };
  walk(blocks);
  return found;
}

/**
 * `next/link` reaches for React context at import time, which does not exist
 * outside a React renderer. The component under test is not being tested for
 * its links, so the module is replaced with a plain anchor before it loads.
 *
 * Deliberately narrow: exactly one module id, resolved to one stub. A broad
 * mock would let a real failure inside the component be swallowed by a stub
 * that answers for everything.
 */
async function stubNextLink() {
  const { createRequire } = await import("node:module");
  const Module = (await import("node:module")).default as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string;
  };
  const require = createRequire(import.meta.url);
  const stub = require.resolve("./_stub-link.tsx");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === "next/link") return stub;
    return original.call(this, request, ...rest);
  };
}

async function main() {
  /*
   * The components are compiled with the classic JSX runtime under tsx, which
   * expects `React` to be in scope at the call site. Putting it on the global
   * is the least invasive way to run a real component outside Next's compiler
   * — nothing about the component changes.
   */
  (globalThis as { React?: unknown }).React = React;
  await stubNextLink();
  console.log(
    `checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`,
  );

  const { getSettings } = await import("../lib/settings");
  const settings = await getSettings();

  /* ------------------------------------------------- 17.2, 17.5, 17.7 */

  /*
   * 🔴 19.0 / C90 / 21R.9 — the precondition for every content check below,
   * and since 21R it is structural: the pages exist only inside this callback,
   * so a check that reads them cannot be written outside a deferral.
   *
   * Sprint 17 moved the prices out of the page and into a `pricing` block. A
   * database that has not had that content published yet cannot pass these,
   * and failing them would make this gate permanently red for a reason
   * everybody already knows — which is how the next real failure gets skimmed
   * past. When 22.8b publishes, this flips on with no file edited.
   */
  await withPublishedContent(
    skipUnless,
    {
      for: "17.9",
      what: "the sprint 17 pricing content",
      block: { slug: "pricing", type: "pricing" },
    },
    (content) => {
      const pricingPages = content.published.filter(
        (p) => p.slug === "pricing",
      );
      check(
        "17.9 the pricing page is published in BOTH locales",
        pricingPages.some((p) => p.locale === "en") &&
          pricingPages.some((p) => p.locale === "ar"),
        pricingPages.map((p) => p.locale).join(", "),
      );

      check(
        "🔴 17.2 the tier cards are the FIRST block on the pricing page, no hero above them",
        pricingPages.every((p) => p.blocks[0]?.type === "pricing"),
        pricingPages.map((p) => `${p.locale}:${p.blocks[0]?.type}`).join(", "),
      );

      check(
        "17.5 …and the billing FAQ is below them",
        pricingPages.every((p) => {
          const faq = p.blocks.findIndex((b) => b.type === "faq");
          const cards = p.blocks.findIndex((b) => b.type === "pricing");
          return faq > cards && cards >= 0;
        }),
      );

      const homePages = content.published.filter((p) => p.slug === "home");
      check(
        "🔴 17.7 the homepage carries THE SAME BLOCK, not a copy of the numbers",
        homePages.length > 0 &&
          homePages.every((p) => p.blocks.some((b) => b.type === "pricing")),
        homePages.map((p) => p.locale).join(", "),
      );
    },
  );

  /* ------------------------- 🔴 the acceptance criterion, on real content */

  await withPublishedContent(
    skipUnless,
    {
      for: "17.10",
      what: "the sprint 17 pricing content",
      block: { slug: "pricing", type: "pricing" },
    },
    (content) => {
      const published = content.published;
      const offenders = published
        .map((page) => ({ page, hits: moneyIn(page.blocks) }))
        .filter((row) => row.hits.length > 0);

      check(
        "🔴 17.10 NO published page states a price, rate, cut or minimum of its own, in any locale",
        offenders.length === 0,
        offenders.length === 0
          ? `${published.length} pages scanned, every figure comes from platform_settings`
          : offenders
              .map(
                (o) => `${o.page.slug}[${o.page.locale}]: ${o.hits.join(" ")}`,
              )
              .join(" · "),
      );
    },
  );

  /*
   * 🔴 The control runs ALWAYS, published content or not.
   *
   * A skip is allowed to defer a claim about the database; it is never allowed
   * to defer the proof that the scan works. If the scanner were blind, the
   * deferred check above would pass the day sprint 22 publishes and nobody
   * would ever know it had not been tested.
   *
   * The control. A scan that has never found anything has not been shown to
   * work — and this is C60's scan, so it had better work. A draft page with
   * the exact sentence the old pricing hero carried is planted, scanned, and
   * removed.
   */
  await db
    .insert(contentPages)
    .values({
      slug: "verify17-control",
      locale: "en",
      title: "control",
      status: "draft",
      blocks: [
        {
          type: "prose",
          body: "Three rates. $6 a session, or 15% of what you charge.",
        },
      ],
    })
    .onConflictDoNothing();

  const [planted] = await db
    .select({ blocks: contentPages.blocks })
    .from(contentPages)
    .where(
      and(
        eq(contentPages.slug, "verify17-control"),
        eq(contentPages.locale, "en"),
      ),
    )
    .limit(1);

  check(
    "🔴 17.10 CONTROL, the same scan CATCHES the sentence C60 shipped",
    moneyIn(planted?.blocks ?? []).length >= 2,
    moneyIn(planted?.blocks ?? []).join(" ") || "THE SCAN IS BLIND",
  );

  await db
    .delete(contentPages)
    .where(eq(contentPages.slug, "verify17-control"));

  /* ------------------------------- the component, actually rendered */

  const { PricingTiers } = await import("../components/public/pricing-tiers");
  const nodes = await flatten(await PricingTiers({}));
  const text = textOf(nodes);

  /*
   * 🔴 AMENDED BY 46.9. 17.10 asserted that every rendered price is a tier
   * rate, when the page rendered one PriceTag per tier. The page now leads
   * with the two FEES, and the tier thresholds are a second row beneath them,
   * so the assertion is about the figures rather than about the component: no
   * money on this page may be a number written in a file.
   */
  const figures = [
    ...text.matchAll(/\$(\d+(?:\.\d{2})?)/g),
  ].map((m) => Math.round(Number(m[1]) * 100));

  const fromSettings = new Set<number>([
    settings.session.platformFeeCents,
    ...settings.pricing.tiers.map((t) => t.aiRateCents),
    ...settings.pricing.tiers.map((t) => t.unlockCents),
  ]);

  check(
    "🔴 17.10 / 46.9 every figure the pricing page renders comes from platform_settings",
    figures.length > 0 && figures.every((cents) => fromSettings.has(cents)),
    `rendered ${figures.join(", ")} · settings ${[...fromSettings].join(", ")}`,
  );

  /*
   * 🔴 46.9 — the platform fee is ON the page, not merely consistent with it.
   *
   * The check above passes against a page that renders nothing at all, which
   * is the §6 family in its pricing costume. This is the half that says the
   * unconditional fee is actually in front of the reader.
   */
  check(
    "🔴 46.9 the unconditional platform fee is on the page",
    figures.includes(settings.session.platformFeeCents),
    `$${settings.session.platformFeeCents / 100} every session`,
  );

  /*
   * 🔴 46.3 — and the bundle is gone from the words as well as the code.
   *
   * Deleting `BundleSlider` is not the same as removing the offer: a page that
   * still reads "10 sessions" describes a product we no longer sell, renders
   * perfectly, and passes every other check in this file.
   */
  check(
    "🔴 46.3 the word `sessions` has left the offer",
    !/\b\d+\s+sessions\b/i.test(text),
    "no `N sessions` in the rendered text",
  );

  check(
    "46.10 the page never suggests what a therapist should charge a patient",
    !/raise your (price|rate|fee)/i.test(text) && !/charge (more|extra)/i.test(text),
    "both sentences are true and only one of them is ours to say",
  );

  check(
    "17.6 the call to action is 'Sign up free'",
    text.includes("Sign up free"),
  );
  check(
    "🔴 17.6 …and the page never says 'choose a plan', because there are no plans",
    !/choose a plan/i.test(text),
  );

  check(
    "17.3 the free-to-use statement and the radar line are on the page",
    text.includes("Joining is free") && text.includes("Crisis Radar"),
  );

  /* ------------------------------------------------------------- C69 */

  check(
    "🔴 C69 the netting sentence is published, and written conditionally, not as a universal",
    settings.payouts.netFeeFromHeldEarnings
      ? text.includes("holding your earnings") &&
          text.includes("own Stripe account")
      : !text.includes("holding your earnings"),
    settings.payouts.netFeeFromHeldEarnings
      ? "netting on, sentence present and hedged"
      : "netting off, sentence absent",
  );

  /*
   * 🔴 The control for it. §6 forbids describing a mechanic the product does
   * not have, so the sentence must **disappear** when netting is switched off.
   * This turns the setting off in the database, re-renders, and turns it back
   * on — the only honest way to prove a conditional is conditional.
   */
  const { platformSettings } = await import("../lib/db/schema");
  const [stored] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "payouts"))
    .limit(1);

  try {
    await db
      .insert(platformSettings)
      .values({ key: "payouts", value: { netFeeFromHeldEarnings: false } })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: {
            ...(stored?.value as object),
            netFeeFromHeldEarnings: false,
          },
        },
      });

    const { getSettings: fresh } = await import(
      `../lib/settings/index.ts?off=${Date.now()}`
    );
    const off = await fresh();
    const offText = textOf(await flatten(await PricingTiers({})));

    check(
      "🔴 C69 CONTROL, switch netting off and the sentence is GONE from the page",
      off.payouts.netFeeFromHeldEarnings === false &&
        !offText.includes("holding your earnings"),
      off.payouts.netFeeFromHeldEarnings === false
        ? offText.includes("holding your earnings")
          ? "STILL THERE, the page describes a mechanic that is switched off"
          : "gone"
        : "the setting did not take effect, so this proves nothing",
    );
  } finally {
    if (stored) {
      await db
        .update(platformSettings)
        .set({ value: stored.value })
        .where(eq(platformSettings.key, "payouts"));
    } else {
      await db
        .delete(platformSettings)
        .where(eq(platformSettings.key, "payouts"));
    }
  }

  finish("sprint 17");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
