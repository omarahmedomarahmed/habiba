import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { and, eq } from "drizzle-orm";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A07: saving a draft never takes a live page down. Plants its own page
 * on the dev database and removes it (H29).
 */

test("the console saves through the draft-aware writer", () => {
  const actions = stripCommentsKeepingLines(readFileSync("app/(admin)/admin/actions.ts", "utf8"));
  const save = actions.slice(actions.indexOf("export async function savePage("));
  assert.match(save.slice(0, 3000), /saveContentPage\(/);
  assert.doesNotMatch(save.slice(0, 3000), /\.update\(contentPages\)/, "savePage still writes the live row directly");
});

test("a draft of a live page sits beside it; publishing replaces the live words", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { contentPages } = await import("../lib/db/schema");
  const { saveContentPage, draftBeside, listAllPages } = await import("../lib/content/service");

  const slug = `w2a07-${Date.now()}`;
  const live = [{ type: "text", body: "The live words." }] as never;
  const draft = [{ type: "text", body: "Words in progress." }] as never;
  const [page] = await db
    .insert(contentPages)
    .values({ slug, locale: "en", title: "Live", status: "published", blocks: live, navLabel: "Live", navOrder: 99 })
    .returning({ id: contentPages.id });

  try {
    const saved = await saveContentPage({
      pageId: page!.id,
      title: "Draft title",
      description: null,
      status: "draft",
      blocks: draft,
      userId: null as never,
    });
    assert.equal(saved?.kept, "live");

    const [still] = await db.select().from(contentPages).where(eq(contentPages.id, page!.id));
    assert.equal(still!.status, "published", "saving a draft took the live page down");
    assert.deepEqual(still!.blocks, live);

    const beside = await draftBeside({ slug, locale: "en" });
    assert.ok(beside, "the draft was not kept");
    assert.deepEqual(beside!.blocks, draft);
    assert.equal(beside!.navLabel, null, "a draft would appear in the navigation");
    assert.ok(!(await listAllPages()).some((row) => row.id === beside!.id), "the list shows the draft twice");

    await saveContentPage({
      pageId: page!.id,
      title: "Published title",
      description: null,
      status: "published",
      blocks: draft,
      userId: null as never,
    });
    const [after] = await db.select().from(contentPages).where(eq(contentPages.id, page!.id));
    assert.equal(after!.status, "published");
    assert.deepEqual(after!.blocks, draft);
    assert.equal(await draftBeside({ slug, locale: "en" }), null, "the draft outlived its publishing");
  } finally {
    await db.delete(contentPages).where(and(eq(contentPages.slug, slug)));
  }
});
