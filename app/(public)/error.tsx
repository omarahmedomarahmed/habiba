"use client";

import { RouteError } from "@/components/patient/route-error";

/**
 * 🔴 0165: THE PUBLIC SITE'S OWN BOUNDARY.
 *
 * A throw on the home page, a clinician's public profile or the radar fell
 * through to `app/global-error.tsx`, which replaces the root layout: the site
 * header and the language went with it, and the one page a stranger in crisis
 * is sent to (`/radar`) lost its SOS orb at the moment it failed. `RouteError`
 * keeps the orb, speaks the reader's language, and shows no stack or message,
 * only the digest in the console.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} where="public" />;
}
