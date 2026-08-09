import "server-only";

import { asc, eq, isNotNull } from "drizzle-orm";

import { db, isDatabaseUnavailable } from "@/lib/db";
import { contentPages, type ContentBlock } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { DEFAULT_PAGES, findDefaultPage } from "./defaults";

export type PublicPage = {
  slug: string;
  title: string;
  description: string | null;
  layout: "marketing" | "document";
  blocks: ContentBlock[];
};

/**
 * Load a published page.
 *
 * Falls back to the built-in definition whenever the database is unreachable or
 * the CMS table is missing. Two reasons that matters: the marketing site should
 * not go dark because Postgres blinked, and `next build` prerenders these
 * routes — without a fallback, a build machine that cannot reach the database
 * fails the deploy rather than shipping a static page.
 */
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  try {
    const [row] = await db
      .select()
      .from(contentPages)
      .where(eq(contentPages.slug, slug))
      .limit(1);

    if (row && row.status === "published") {
      return {
        slug: row.slug,
        title: row.title,
        description: row.description,
        layout: row.layout,
        blocks: row.blocks,
      };
    }
    if (row) return null; // exists but is a draft
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    log.warn("CMS unavailable, serving built-in content", { slug });
  }

  const fallback = findDefaultPage(slug);
  if (!fallback) return null;
  return {
    slug: fallback.slug,
    title: fallback.title,
    description: fallback.description,
    layout: fallback.layout,
    blocks: fallback.blocks,
  };
}

export type NavItem = { slug: string; label: string };

export async function getPublicNav(): Promise<NavItem[]> {
  try {
    const rows = await db
      .select({
        slug: contentPages.slug,
        navLabel: contentPages.navLabel,
        navOrder: contentPages.navOrder,
      })
      .from(contentPages)
      .where(isNotNull(contentPages.navLabel))
      .orderBy(asc(contentPages.navOrder));

    const published = rows.filter((r) => r.navLabel && (r.navOrder ?? 99) < 10);
    if (published.length > 0) {
      return published.map((r) => ({ slug: r.slug, label: r.navLabel! }));
    }
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return DEFAULT_PAGES.filter((p) => p.navLabel && (p.navOrder ?? 99) < 10).map((p) => ({
    slug: p.slug,
    label: p.navLabel!,
  }));
}

export async function getFooterLinks(): Promise<NavItem[]> {
  try {
    const rows = await db
      .select({
        slug: contentPages.slug,
        navLabel: contentPages.navLabel,
        navOrder: contentPages.navOrder,
      })
      .from(contentPages)
      .where(isNotNull(contentPages.navLabel))
      .orderBy(asc(contentPages.navOrder));

    const legal = rows.filter((r) => r.navLabel && (r.navOrder ?? 0) >= 10);
    if (legal.length > 0) return legal.map((r) => ({ slug: r.slug, label: r.navLabel! }));
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return DEFAULT_PAGES.filter((p) => p.navLabel && (p.navOrder ?? 0) >= 10).map((p) => ({
    slug: p.slug,
    label: p.navLabel!,
  }));
}

/** Every published page, for the sitemap. Falls back to the shipped defaults. */
export async function publishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  try {
    const rows = await db
      .select({ slug: contentPages.slug, updatedAt: contentPages.updatedAt })
      .from(contentPages)
      .where(eq(contentPages.status, "published"));
    if (rows.length > 0) return rows;
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return DEFAULT_PAGES.map((page) => ({ slug: page.slug, updatedAt: new Date() }));
}

/** Admin view: every page, drafts included. */
export async function listAllPages() {
  return db.select().from(contentPages).orderBy(asc(contentPages.navOrder), asc(contentPages.slug));
}

export async function getPageById(id: string) {
  const [row] = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
  return row ?? null;
}
