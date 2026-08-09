import type { MetadataRoute } from "next";

import { publishedSlugs } from "@/lib/content/service";
import { env } from "@/lib/env";

/**
 * Only public marketing pages and the radar. Nothing behind a login, and
 * emphatically nothing under `/join/*`.
 *
 * Built from what is actually published in the CMS, so unpublishing a page
 * removes it from the sitemap rather than leaving a 404 advertised to crawlers.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await publishedSlugs();

  return [
    { url: env.appUrl, changeFrequency: "weekly", priority: 1 },
    {
      // The one page whose value is that it is up to the minute.
      url: `${env.appUrl}/radar`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    ...pages
      .filter((page) => page.slug !== "home")
      .map((page) => ({
        url: `${env.appUrl}/${page.slug}`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
  ];
}
