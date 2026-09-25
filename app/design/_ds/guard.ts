import "server-only";

import { notFound } from "next/navigation";

import { getActor } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * 🔴 0165: THE DESIGN GALLERY DOES NOT EXIST ON THE LIVE DEPLOYMENT, unless a
 * signed-in super admin is looking at it.
 *
 * `/design` is sample screens: invented clinicians, invented patients, a
 * pretend console. On `24therapy.app` any stranger could open it, and a sample
 * patient screen at a real address reads as a real one. `noindex` in the
 * layout kept it out of search; it did not keep it off the internet.
 *
 * Not found rather than a sign-in bounce, so the live site does not advertise
 * that there is anything here. Previews and laptops keep it open, because that
 * is where it is for.
 *
 * 🔴 CALLED FROM THE LAYOUT AND FROM EVERY PAGE. A layout is not re-rendered
 * on a client navigation, and a request that says it already has the layout
 * is served the page segment alone, so a check in the layout by itself is a
 * check that a crafted request walks past. `verify:launch` fails when a page
 * under `app/design` does not call this.
 */
export async function guardDesignGallery(): Promise<void> {
  if (!env.liveDeployment) return;
  const actor = await getActor();
  if (actor?.role !== "super_admin") notFound();
}
