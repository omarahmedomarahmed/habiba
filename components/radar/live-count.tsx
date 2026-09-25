"use client";

import { useEffect, useState } from "react";

import type { RadarEntry } from "@/components/radar/types";
import { viewerId } from "@/lib/viewer";

/**
 * 🔴 B30 — HOW MANY ARE ONLINE, READ FROM THE RADAR ITSELF.
 *
 * The home page is a static CMS page, and beside a phone full of invented
 * clinicians marked "Free now" it said nothing about the real radar, so a
 * visitor at three in the morning was promised somebody while `/radar` said
 * nobody was there. This reads the same `/api/radar` the radar page reads and
 * counts the same `online` rows, so the two cannot disagree, and when the
 * count is zero it says so.
 *
 * Polled at the radar hero's cadence, and only while the tab is visible.
 */
const REFRESH_MS = 4_000;

export function LiveCount({
  strings,
  className,
}: {
  /** From the server, so both passes render the same words (C84). `{count}` is filled here. */
  strings: { checking: string; online: string; nobody: string };
  className?: string;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const viewer = viewerId();
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/radar?v=${encodeURIComponent(viewer)}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const entries = (await response.json()).therapists as RadarEntry[];
        setCount(entries.filter((entry) => entry.status === "online").length);
      } catch {
        /* A failed poll keeps the last figure rather than inventing one. */
      }
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const text =
    count === null ? strings.checking : count === 0 ? strings.nobody : strings.online.replace("{count}", String(count));

  return (
    <p role="status" className={className}>
      <span
        aria-hidden
        className={
          count
            ? "live-dot me-2 inline-block h-2 w-2 rounded-full bg-brand-400"
            : "me-2 inline-block h-2 w-2 rounded-full bg-white/40"
        }
      />
      {text}
    </p>
  );
}
