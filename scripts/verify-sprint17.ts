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
import { writesTo, reporter, readSource } from "./_verify";
import { stubModules } from "./_render";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { DICTIONARIES } from "../lib/i18n/messages";
import { seatMonthlyCents } from "../lib/settings/defs";

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

/*
 * 🔴 76.77 — A COMPETITOR'S PUBLISHED PRICE IS THE ONE FIGURE THIS RULE MUST NOT
 * CATCH, AND THE EXEMPTION IS TWO FIELDS RATHER THAN A BLOCK.
 *
 * 17.10 says no published page may state a price of its own, and the reason is
 * C60: a figure typed into content can disagree with `platform_settings`, and it
 * did, for a fortnight, while a hero paragraph went on selling $6.
 *
 * That reason does not reach a rival's price list. There is no settings row
 * holding what SimplePractice charges, there never will be, and a comparison
 * table that cannot name their price is a comparison table nobody can use. So
 * `price` and `theirs`, the two fields that hold THEIR figures, are skipped.
 *
 * 🔴 `ours` IS STILL SCANNED, and that is the half that matters. It is where
 * this product's own prices would be typed, it is exactly C60's shape, and the
 * first draft of the comparison did it: "or $1 + $3 a session with nothing
 * monthly", in a row that would have gone on saying so through a reprice. This
 * check caught it. Anything else on the block is scanned too, so a price
 * smuggled into a heading or into `who` still fails.
 */
const RIVAL_FIGURE_FIELDS = new Set(["price", "theirs"]);

function moneyIn(blocks: ContentBlock[]): string[] {
  const found: string[] = [];
  const walk = (value: unknown, exempt = false) => {
    if (typeof value === "string") {
      if (exempt) return;
      for (const hit of value.matchAll(new RegExp(MONEY, "g")))
        found.push(hit[0]);
    } else if (Array.isArray(value)) value.forEach((one) => { walk(one, exempt); });
    else if (value && typeof value === "object") {
      const rival = (value as { type?: unknown }).type === "competitors";
      for (const [key, inner] of Object.entries(value)) {
        walk(inner, exempt || (rival ? false : RIVAL_FIGURE_FIELDS.has(key)));
      }
    }
  };
  /*
   * The exemption is switched on per FIELD, walking down from a competitors
   * block. A `price` key on any other block type is not exempt, which is why
   * the flag is computed at each object rather than once at the top.
   */
  const walkBlock = (block: ContentBlock) => {
    if (block.type !== "competitors") { walk(block); return; }
    walk(block.heading);
    for (const item of block.items) {
      walk(item.name);
      walk(item.who);
      for (const row of item.rows) {
        walk(row.claim);
        walk(row.ours);
      }
    }
  };
  blocks.forEach(walkBlock);
  return found;
}

async function main() {
  // 🔴 Sprint 57 — this verifier WRITES. It refuses production like its siblings.
  writesTo();
  /*
   * 🔴 76.8 — THE SHARED HARNESS, not a private copy of it.
   *
   * This file used to carry its own `stubNextLink()`, a near-duplicate of
   * `_render.ts`'s `stubModules()`. Two harnesses meant two places to teach
   * about a module that cannot load outside a renderer, and only one of them
   * ever got taught: when sprint 76 put `<Money>` into the pricing tree, the
   * component reached for the i18n provider, `createContext` did not exist
   * under `--conditions=react-server`, and this verifier died on an import.
   *
   * The first fix was a third stub. That is the wrong shape — it answers this
   * component and waits for the next one. `stubModules()` also replaces
   * `server-only`, which is the whole reason the react-server condition was on
   * this script, so the condition came off and the full React build is used
   * here exactly as `render-check` and `verify:sprint21r` already use it.
   */
  await stubModules();
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

  /*
   * 🔴 AMENDED AGAIN BY 57.5, and the two additions are different in kind.
   *
   * `monthlyCents` is a figure the page now renders and the set did not know
   * about, which is an omission. The ALL-IN price is the interesting one: the
   * headline reads "$4 a session", which is `platformFeeCents + aiRateCents`
   * and appears in no settings field at all.
   *
   * The rule this check defends is "no money on this page is a number written
   * in a file", not "every rendered figure is a settings field verbatim". A
   * figure DERIVED from settings by arithmetic satisfies the rule; widening the
   * set to a range, or dropping the check to a warning, would not. So the
   * derivation is named here, which also means a page that starts printing some
   * other sum still fails.
   */
  const fromSettings = new Set<number>([
    settings.session.platformFeeCents,
    ...settings.pricing.tiers.map((t) => t.aiRateCents),
    ...settings.pricing.tiers.map((t) => t.unlockCents),
    ...settings.pricing.tiers.map((t) => t.monthlyCents),
    // The all-in price of a metered session, which the headline states.
    ...settings.pricing.tiers
      .filter((t) => t.monthlyCents === 0)
      .map((t) => settings.session.platformFeeCents + t.aiRateCents),
    /*
     * 🔴 AMENDED A THIRD TIME BY 62.4, and found by running this gate in sprint 65.
     *
     * Sprint 62 put the seat ladder on the pricing page and this set did not know about
     * it, so a real figure the page renders — $270, the price of a practice at the second
     * band boundary — had no source here and the check was red. Nobody noticed, because
     * nothing ran `verify:sprint17` between sprint 62 and sprint 65.
     *
     * The rule is unchanged and is the reason this is a derivation rather than a widening:
     * *no money on this page is a number written in a file.* `seatMonthlyCents` over the
     * bands in `platform_settings` is where every one of these comes from, so a page that
     * started printing some other seat price still fails.
     */
    ...Array.from({ length: 500 }, (_, i) =>
      seatMonthlyCents(i + 1, settings.pricing.seatBands),
    ),
    /*
     * 🔴 AMENDED A FOURTH TIME BY 76.72. The clinic card and the comparison
     * grid both print the per-seat RATE ("$72 a seat, a month"), which is
     * `band.perSeatCents` and is not any band's monthly TOTAL, so it was in no
     * derivation above. It is a settings field read at render time, which is
     * the rule; a rate typed into a file would still fail.
     */
    ...settings.pricing.seatBands.map((band) => band.perSeatCents),
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

  /*
   * 🔴 C200 / 65.14 — THE HANDLE IS THE DICTIONARY KEY, NOT TWO PHRASES INSIDE IT.
   *
   * This grepped for "holding your earnings" and "own Stripe account". Sprint 65 shortened
   * `pricing.netting` and the check went red while C69's property held exactly: the
   * sentence is published when netting is on, absent when it is off, and it is written
   * conditionally rather than as a universal.
   *
   * The condition is what this check is for, so the presence test reads the string that
   * IS the conditional, and the hedge test reads its own words rather than a copy of them.
   */
  const netting = DICTIONARIES.en["pricing.netting"];

  check(
    "🔴 C69 the netting sentence is published, and written conditionally, not as a universal",
    settings.payouts.netFeeFromHeldEarnings
      ? text.includes(netting) && /\bwhile\b|\bwhere\b|\bwhen\b/i.test(netting)
      : !text.includes(netting),
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

  /* ------------------------------------------------------------ 76.77 -- */

  /*
   * 🔴 76.77 — THE ADMIN CONSOLE COULD NOT SAVE THE HOMEPAGE.
   *
   * `sanitiseBlocks` in `app/(admin)/admin/actions.ts` returned `null` for any
   * block type outside a hand-written list of six, and `savePage` turns that
   * into "The content structure is not valid" and writes nothing. Nine block
   * types have shipped since that list was typed. The homepage carries
   * `pricing` and `crisis`; the patients page carries `flow` and `seesWhat`.
   * An operator fixing a typo on either got a refusal that named the wrong
   * cause.
   *
   * This is the check that stops it happening a tenth time, and it reads BOTH
   * sides rather than restating either: the union out of the schema, the keys
   * out of the sanitiser's own exported list. A new block type fails here the
   * day it is added, which is the day somebody can still fix it in one edit.
   */
  const schemaSource = readSource("lib/db/schema.ts");
  const unionStart = schemaSource.indexOf("export type ContentBlock =");
  const unionEnd = schemaSource.indexOf("export const contentPages");
  const declared = [
    ...new Set(
      [...schemaSource.slice(unionStart, unionEnd).matchAll(/\btype: "(\w+)";/g)].map((m) => m[1]!),
    ),
  ].sort();

  /*
   * 🔴 77.13 — it moved out of the `"use server"` file, and that is the point.
   *
   * Such a file may export async functions and nothing else. This constant was
   * an exported array sitting in one, which compiled, typechecked, and answered
   * 500 on the first page that imported an action beside it.
   */
  const { SANITISER_BLOCK_TYPES } = await import("../lib/content/sanitise");
  const missing = declared.filter((t) => !SANITISER_BLOCK_TYPES.includes(t));
  const extra = SANITISER_BLOCK_TYPES.filter((t) => !declared.includes(t));

  check(
    "🔴 76.77 every block type the schema declares can be SAVED by the admin console",
    missing.length === 0 && extra.length === 0,
    missing.length > 0
      ? `the console refuses to save a page containing: ${missing.join(", ")}`
      : extra.length > 0
        ? `the sanitiser keeps types the schema does not have: ${extra.join(", ")}`
        : `${String(declared.length)} types, both sides agree`,
  );

  /*
   * 🔴 THE CONTROL. The check above is an equality between two lists, and it
   * passes just as happily if the scan finds nothing at all on either side: two
   * empty sets are equal. This proves the union was actually read.
   */
  check(
    "🔴 76.77 CONTROL, the scan really read the union rather than matching nothing",
    declared.length >= 10 && declared.includes("pricing") && declared.includes("crisis"),
    `${String(declared.length)} declared: ${declared.join(", ")}`,
  );

  finish("sprint 17");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
