import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/public/blocks";
import { getPublicPage } from "@/lib/content/service";

/**
 * Revalidate rather than render per request: this page is identical for every
 * visitor and must never touch clinical data. The CMS editor revalidates the
 * path explicitly on publish, so an edit is live immediately rather than in an
 * hour.
 */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicPage("home");
  if (!page) return {};
  return { title: page.title, description: page.description ?? undefined };
}

export default async function HomePage() {
  const page = await getPublicPage("home");
  if (!page) notFound();
  return <BlockRenderer blocks={page.blocks} slug="home" />;
}
