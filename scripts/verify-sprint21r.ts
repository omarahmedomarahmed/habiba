/**
 * Sprint 21R acceptance — the loose ends a person found.
 * PLAN.md 21R.1–21R.10, C92, C93, C94, C95.
 *
 *   npm run verify:sprint21r
 *
 * Everything this file checks was found by the founder opening the live site,
 * which is the argument for 22R. Two of the checks are the ones that matter:
 *
 *   - **C92** — no published page may claim the money never passes through us.
 *     §3c reversed that on 2026-09-06, and a public page making a false claim
 *     about where somebody's money sits is a correctness bug, not stale copy.
 *   - **C93** — a check that reads published content is deferrable *by
 *     construction*, because the rows only exist inside the callback that
 *     skips itself when they are absent.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import React from "react";

import {
  LIVE_URL,
  PRICE_IN_PROSE,
  REVERSED_CLAIM,
  readLiveSite,
} from "./check-live";
import { renderMarkup, stubModules } from "./_render";
import { reporter } from "./_verify";
import { stripComments, undeferredContentReads } from "./_scan-deferrals";
import type { LivePage } from "./_content-ready";

const { check, skipUnless, finish } = reporter();

const VERIFIERS = readdirSync("scripts").filter(
  (name) => name.startsWith("verify-") && name.endsWith(".ts"),
);

async function main() {
  console.log(
    `checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`,
  );

  /*
   * This script renders real components, so it runs WITHOUT the `react-server`
   * export condition — that build of React has no `Component`, and the demo
   * error boundary is a class. `server-only` is therefore a throw until the
   * substitutions are installed, which is why every module that reaches the
   * database is imported after this line rather than at the top of the file.
   */
  await stubModules();
  const { CACHE_VERSION } = await import("../lib/content/service");
  const { withPublishedContent } = await import("./_content-ready");

  /* ------------------------------------------------ 21R.9 · C93, the rule */

  const offenders = VERIFIERS.flatMap((name) =>
    undeferredContentReads(readFileSync(`scripts/${name}`, "utf8")).map(
      (statement) => `${name}: ${statement}`,
    ),
  );

  check(
    "🔴 21R.9 / C93 NO verifier reads published content by hand — it comes through the deferrable reader",
    offenders.length === 0,
    offenders.join(" · ") || `${VERIFIERS.length} verifiers scanned`,
  );

  /*
   * 🔴 The control. A scan that has never found anything has not been shown to
   * work. This plants a verifier of exactly the offending shape — the query
   * sprint 18R actually shipped — scans, and removes it.
   */
  const planted = "scripts/verify-c93-control.ts";
  /*
   * The offending source is assembled from a placeholder rather than written
   * out, so THIS file does not contain the pattern it is scanning for. Six
   * checkers in this repository have now matched their own text; the first
   * five were bugs, and this is the sixth caught before it shipped — the scan
   * reported this file as an offender the first time it ran.
   */
  const TABLE = "contentPages";
  try {
    writeFileSync(
      planted,
      [
        'import { db } from "../lib/db";',
        `import { ${TABLE} } from "../lib/db/schema";`,
        "const pages = await db",
        `  .select({ slug: ${TABLE}.slug })`,
        `  .from(${TABLE})`,
        `  .where(eq(${TABLE}.status, "published"));`,
        'check("a check that reads content and cannot be deferred", pages.length > 0);',
      ].join("\n"),
    );

    const caught = undeferredContentReads(readFileSync(planted, "utf8"));
    check(
      "🔴 21R.9 CONTROL — the same scan CATCHES a hand-written content read planted in a verifier",
      caught.length === 1,
      caught[0]?.slice(0, 80) ?? "THE SCAN IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  /*
   * 🔴 …and the control for the exception, which is the half that would rot.
   * A verifier's own planted fixture, read back, must NOT be reported — or the
   * rule becomes one everybody suppresses.
   */
  const control = [
    "const [row] = await db",
    `  .select({ blocks: ${TABLE}.blocks })`,
    `  .from(${TABLE})`,
    `  .where(eq(${TABLE}.slug, "verify17-control"));`,
  ].join("\n");
  check(
    "21R.9 …and a fixture the verifier planted ITSELF is not reported — the rule is about reading, not writing",
    undeferredContentReads(control).length === 0,
  );

  /* ------------------------------- 21R.9 · the mechanism, actually exercised */

  /*
   * 🔴 The behaviour on a purged database, proved rather than assumed.
   *
   * Sprint 22 empties this database. Every content check in the repository
   * meets that state within the hour, and what they must do is SKIP with a
   * reason naming 22.8b — not fail, and not pass vacuously. Asserted by
   * running the real reader against no rows and recording what happened.
   */
  const recorded: { reason: string; ran: boolean }[] = [];
  const fakeSkip = async (
    ready: boolean,
    deferredTo: string,
    reason: string,
    fn: () => void | Promise<void>,
  ) => {
    if (ready) await fn();
    recorded.push({ reason: `${deferredTo}: ${reason}`, ran: ready });
  };

  const ran = { onEmpty: false, onContent: false };
  await withPublishedContent(
    fakeSkip,
    { for: "21R.9", what: "the pricing page", pages: [] },
    () => {
      ran.onEmpty = true;
    },
  );

  check(
    "🔴 21R.9 on an EMPTY database a content check skips with its reason — it does not fail, and does not pass vacuously",
    ran.onEmpty === false && recorded[0]?.reason.startsWith("22.8b:") === true,
    recorded[0]?.reason ?? "nothing recorded",
  );

  const page: LivePage = {
    slug: "pricing",
    locale: "en",
    status: "published",
    navLabel: "Pricing",
    navOrder: 1,
    blocks: [{ type: "pricing" }] as LivePage["blocks"],
  };

  await withPublishedContent(
    fakeSkip,
    { for: "21R.9", what: "the pricing page", slug: "pricing", pages: [page] },
    () => {
      ran.onContent = true;
    },
  );

  check(
    "🔴 21R.9 …and it switches itself back ON when the content is there — nobody edits a file to un-skip it",
    ran.onContent === true,
    ran.onContent
      ? "the same check ran against one published page"
      : "STILL SKIPPED",
  );

  /* ------------------------------------------- 21R.6 · C92, the live pages */

  /*
   * 🔴 The first check in this repository that reads the PRODUCT rather than
   * the database.
   *
   * C92 was invisible to everything we had: `content_pages` held the corrected
   * pricing page, so `verify:sprint17` passed, while the site served a cached
   * copy from before the rewrite — prices in prose, no cards, and a sentence
   * §3c reversed. A check that reads the database can only ever prove what we
   * meant to publish.
   *
   * It is deferred on one thing, and deliberately not on its own result: the
   * deployment must be running this build. `revalidate: false` → a five-minute
   * ceiling only takes effect once the code ships, and a gate that goes red
   * because a merge has not happened yet is the C90 failure again.
   */
  const deployed = await fetch(`${LIVE_URL}/api/revalidate`)
    .then((response) =>
      response.ok
        ? (response.json() as Promise<{ cacheVersion?: string }>)
        : null,
    )
    .catch(() => null);

  const running = deployed?.cacheVersion ?? "unknown";

  await skipUnless(
    running === CACHE_VERSION,
    "the next deploy of main",
    `21R.6 — ${LIVE_URL} is serving cache ${running}, this build is ${CACHE_VERSION}`,
    async () => {
      const live = await readLiveSite();

      const contradicting = live.filter((page) =>
        REVERSED_CLAIM.test(page.text),
      );
      check(
        "🔴 21R.6 / C92 NO live page states the claim §3c reversed — the money is not always in your own account",
        live.length > 0 && contradicting.length === 0,
        contradicting.map((p) => `${p.path}[${p.locale}]`).join(", ") ||
          `${live.length} live pages read`,
      );

      const priced = live.filter((page) => PRICE_IN_PROSE.test(page.text));
      check(
        "🔴 21R.6 …and none of them writes a price into prose — the cards carry the numbers",
        priced.length === 0,
        priced.map((p) => `${p.path}[${p.locale}]`).join(", ") || "none",
      );

      const pricing = live.filter((page) => page.path === "/pricing");
      check(
        "21R.6 the live pricing page carries the tier cards and the currency toggle",
        pricing.length > 0 &&
          pricing.every((page) => /EGP|USD/.test(page.text)),
        pricing
          .map(
            (p) => `${p.locale}:${/EGP|USD/.test(p.text) ? "cards" : "PROSE"}`,
          )
          .join(", "),
      );
    },
  );

  /*
   * 🔴 The control for the scan above, which would otherwise be a scan that
   * has never matched anything. The reversed sentence is fed to it verbatim,
   * as the live site served it on 2026-09-07, and the conditional rewrite that
   * replaced it is fed to it too — a pattern that cannot tell those apart
   * would either miss the bug or condemn the fix.
   */
  const served =
    "15% of the session price, and nothing else. The money is a direct charge into your own Stripe account — we never hold it — and Stripe handles the payout to your bank.";
  const corrected =
    "The percentage shown on the cards above, and nothing else. Where you have a Stripe account the money is charged straight into it and we never hold it. Where you do not — Egypt, today — we collect it, hold it, and pay you out on request.";

  check(
    "🔴 21R.6 CONTROL — the scan CATCHES the sentence the site served, and CLEARS the conditional one that replaced it",
    REVERSED_CLAIM.test(served) && !REVERSED_CLAIM.test(corrected),
    `served: ${REVERSED_CLAIM.test(served) ? "caught" : "MISSED"} · corrected: ${
      REVERSED_CLAIM.test(corrected) ? "FALSELY CONDEMNED" : "cleared"
    }`,
  );

  /*
   * 🔴 …and the mechanism, so the fix is not one bump of a version string.
   * A cache entry that nothing but a person can retire will outlive the
   * content sooner or later; the timer is what makes that bounded.
   */
  const serviceSource = readFileSync("lib/content/service.ts", "utf8");
  const service = stripComments(serviceSource);
  check(
    "🔴 21R.6 the public content cache EXPIRES — a cache only a click can retire will outlive the content",
    /revalidate:\s*CACHE_SECONDS/.test(service) &&
      !/revalidate:\s*false/.test(service),
    /revalidate:\s*false/.test(service)
      ? "still never expires"
      : "bounded, and still tag-invalidated",
  );

  /*
   * 🔴 And the same control sprint 19 needed, because this checker made the
   * same mistake: the first version of it FAILED on the paragraph explaining
   * why `revalidate: false` was wrong. Seven checkers in this repository have
   * now matched their own documentation. Stripping comments is not a detail of
   * one scan, it is the default.
   */
  check(
    "🔴 21R.6 CONTROL — the same scan, run WITHOUT stripping comments, would have failed on the paragraph explaining the fix",
    /revalidate:\s*false/.test(serviceSource),
    "the prose names the old setting; the code does not",
  );

  /* ---------------------------------------------- 21R.10 · C95, the hero icon */

  /*
   * 🔴 Rendered, not read.
   *
   * C95 is invisible to every other kind of check: the block is right, the
   * props are right, the import graph is right, and the page still opens with
   * a square floating on a line of its own. The only way to see it is to
   * render the component and look at where the icon sits — so that is what
   * this does, through the real `BlockRenderer`, for a hero with an icon and
   * for a hero with an icon and no eyebrow, which is the arrangement that put
   * it alone.
   */
  const { BlockRenderer } = await import("../components/public/blocks");

  const heroWith = (extra: Record<string, unknown>) =>
    React.createElement(BlockRenderer as never, {
      slug: "verify21r",
      blocks: [
        {
          type: "hero",
          heading: "Three rates. No seats, no setup fee.",
          body: "A sentence under the heading.",
          icon: "chart",
          ...extra,
        },
      ],
    });

  const withEyebrow = await renderMarkup(heroWith({ eyebrow: "Pricing" }));
  const withoutEyebrow = await renderMarkup(heroWith({}));

  /**
   * The icon's own element, and what shares its parent.
   *
   * The mark renders as `<span class="flex h-10 w-10 …"><svg …></span>`; the
   * bug is that element being an only child of a block-level row. So the test
   * is whether the div wrapping it also contains text — the eyebrow, or the
   * heading — rather than whether any particular class is present.
   */
  const iconRowHasText = (html: string) => {
    const icon = html.indexOf("h-10 w-10");
    if (icon === -1) return false;

    const rowStart = html.lastIndexOf("<div", icon);
    if (rowStart === -1) return false;

    // Walk to this div's own closing tag, counting nested ones on the way.
    let depth = 0;
    let end = html.length;
    for (const tag of html.slice(rowStart).matchAll(/<(\/?)div\b/g)) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) {
        // Past the whole `</div>`, not just the part the pattern matched —
        // stopping inside the tag leaves "</div" behind as "text".
        end = html.indexOf(">", rowStart + tag.index! + tag[0].length) + 1;
        break;
      }
    }

    const text = html
      .slice(rowStart, end)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 0;
  };

  check(
    "🔴 21R.10 / C95 the hero icon sits WITH the text — it does not break to a line of its own",
    iconRowHasText(withEyebrow) && iconRowHasText(withoutEyebrow),
    `with an eyebrow: ${iconRowHasText(withEyebrow) ? "inline" : "ALONE"} · without one: ${
      iconRowHasText(withoutEyebrow) ? "inline" : "ALONE"
    }`,
  );

  /*
   * 🔴 …and it is inline in ARABIC too, which is where this hides.
   *
   * The row is laid out with flex and `gap`, so direction is handled by the
   * document rather than by a rule per side. The check that matters is 19.3's:
   * the hero's own markup must pin no physical side, or the icon would be
   * correct in English and on the wrong side of the heading in Arabic.
   */
  const heroSource = stripComments(
    readFileSync("components/public/blocks.tsx", "utf8"),
  );
  const heroBlock = heroSource.slice(
    heroSource.indexOf("function Hero("),
    heroSource.indexOf("function Features("),
  );
  const physical =
    heroBlock.match(/\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right)/g) ??
    [];
  check(
    "🔴 21R.10 …in both directions — the hero pins no physical side, so Arabic needs no second rule",
    physical.length === 0,
    physical.join(", ") || "flex and gap only, direction from the document",
  );

  /*
   * The control: the same reader, run against the arrangement that shipped —
   * the icon as an only child between the eyebrow and the heading. A test that
   * cannot fail on the old markup has not tested the new markup.
   */
  const asItShipped =
    '<div><span class="inline-flex">Pricing</span><div><span class="flex h-10 w-10"><svg></svg></span></div><h1>Three rates.</h1></div>';
  check(
    "🔴 21R.10 CONTROL — the same reader CALLS OUT the arrangement that shipped",
    !iconRowHasText(asItShipped),
    iconRowHasText(asItShipped)
      ? "THE READER IS BLIND"
      : "the icon alone in its row is reported",
  );

  finish("sprint 21R");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
