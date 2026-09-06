"use client";

import { useEffect, useState } from "react";

import { readerZone } from "./tz";

/**
 * The browser's zone, but only after mount. 12.3, corrected.
 *
 * ## Why a hook and not a `const`
 *
 * Next.js server-renders client components. `readerZone()` at module scope
 * therefore runs twice — once in Node, where `Intl` answers with the *server's*
 * zone (UTC on Vercel), and once in the browser, where it answers with the
 * reader's. The two passes render different strings, React reports a hydration
 * mismatch on every date, and anybody east of UTC watches the wrong day flash
 * before it corrects itself.
 *
 * This returns `null` on the server pass and on the first client render — so
 * both agree — and the real zone from an effect afterwards. The dates render
 * once in the fallback zone and once in the reader's, deliberately, in that
 * order.
 *
 * ## When to use it, and when not to
 *
 * 🔴 **Prefer a prop.** Where the server knows the reader's zone — every
 * clinician screen, because `actor.timezone` is on the actor — pass it down.
 * That renders the right string on the very first pass with no swap at all.
 *
 * This exists for the screens where the server genuinely does not know: the
 * patient portal, which has no stored zone until §3b's signup collects one.
 * `fallback` is what to show until the effect runs — pass whatever the server
 * does know, and `null` means UTC.
 */
export function useReaderZone(fallback: string | null = null): string | null {
  const [zone, setZone] = useState<string | null>(fallback);

  useEffect(() => {
    const found = readerZone();
    if (found) setZone(found);
  }, []);

  return zone;
}
