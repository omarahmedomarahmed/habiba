import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://24therapy.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/pricing", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/for-therapists", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/find-therapist", priority: 0.9, changeFrequency: "daily" as const },
    { url: "/ai-scribe", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/features", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/features/ai-copilot", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/features/teletherapy", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/features/analytics", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/features/memory-layer", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/enterprise", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/security", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/hipaa", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/privacy", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/terms", priority: 0.5, changeFrequency: "monthly" as const },
  ];

  return routes.map(({ url, priority, changeFrequency }) => ({
    url: `${BASE_URL}${url}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}

// Reviewed: 2026-06-13 — 24Therapy audit
