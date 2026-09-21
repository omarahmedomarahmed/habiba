import type { Metadata } from "next";
import { headers } from "next/headers";

import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { env } from "@/lib/env";
import { alternatesFor } from "@/lib/i18n/paths";

/**
 * 🔴 `hreflang` for every public page, declared once. PLAN.md 31.1.
 *
 * In the **layout**, deliberately. Next merges metadata down the segment
 * chain, so a page that says nothing about alternates inherits this, and a new
 * marketing page is correct on the day it is added rather than on the day
 * somebody notices. The alternative — the same four lines copied into eleven
 * `generateMetadata` functions — is the shape that produced C84 and C150: a
 * rule some call sites remember.
 *
 * A crawler that finds `/ar/pricing` with no link back to `/pricing` treats
 * them as unrelated documents competing with each other, which is worse for
 * both than publishing one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  return { alternates: alternatesFor(pathname, env.appUrl) };
}

/**
 * 🔴 The chrome is a component now, not markup in this file. Task 153.
 *
 * It used to be ninety lines of header and footer typed here, which is why the
 * sign in pages did not have it: they are in four other route groups and there
 * was nothing to import. See the note at the top of
 * `components/public/site-chrome.tsx`.
 *
 * 77.10 still applies and is now enforced in one place rather than this one:
 * every string in that chrome reads from the dictionary, because six of them
 * were typed inline and rendered in English on every Arabic page.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
