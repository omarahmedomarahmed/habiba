/**
 * DD-2: no published `content_pages` row makes a claim that is false today.
 *
 * Database-bound and read-only. Allowed on production:
 *
 *     npm run on:production -- verify:cms-claims
 *
 * For each failing row it prints the `content:sync` command that replaces the
 * offending block types from the shipped defaults. The static half, over the
 * defaults themselves, is `verify:claims-defaults`.
 */
import type { ContentBlock } from "../lib/db/schema";
import { REQUIRED_STATEMENTS, claimStrings, forbiddenClaimsIn } from "../lib/content/claims";
import { withPublishedContent } from "./_content-ready";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  /* T2: the scanner must catch a planted row before its silence means anything. */
  const planted: ContentBlock[] = [
    { type: "prose", body: "Subprocessors are covered by a business associate agreement." } as ContentBlock,
  ];
  check("control: a planted false claim is caught", forbiddenClaimsIn("planted", planted).length > 0);

  await withPublishedContent(skipUnless, { for: "DD-2", what: "the page corpus" }, (content) => {
    const stale = new Map<string, Set<string>>();
    const lines: string[] = [];
    for (const page of content.published) {
      page.blocks.forEach((block, index) => {
        const hits = forbiddenClaimsIn(`${page.slug}[${page.locale}] #${index} ${block.type}`, block);
        if (hits.length === 0) return;
        const types = stale.get(page.slug) ?? new Set<string>();
        types.add(block.type);
        stale.set(page.slug, types);
        for (const hit of hits) lines.push(`${hit.where} (${hit.rule}): "${hit.text}"`);
      });
    }
    check(
      "no published page makes a claim that is false today",
      lines.length === 0,
      lines.join(" · ") || `${content.published.length} rows scanned`,
    );
    if (stale.size > 0) {
      console.log("\n  re-sync from the shipped defaults (dry run first, then without --dry):");
      for (const [slug, types] of stale) {
        console.log(`    npm run on:production -- content:sync -- ${slug} ${[...types].join(" ")} --dry`);
      }
      console.log("");
    }

    for (const required of REQUIRED_STATEMENTS) {
      const row = content.published.find((p) => p.slug === required.slug && p.locale === required.locale);
      if (!row) continue;
      const text = claimStrings(row.blocks).map((entry) => entry.text).join("\n");
      check(`/${required.slug} [${required.locale}] says ${required.what}`, required.pattern.test(text));
    }
  });

  finish("verify:cms-claims");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
