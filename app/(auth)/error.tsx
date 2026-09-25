"use client";

import { RouteError } from "@/components/patient/route-error";

/**
 * 🔴 0165: THE SIGN-IN PAGES' OWN BOUNDARY.
 *
 * A throw on sign in, sign up or a password reset reached the global page, in
 * English and with no way back but the browser. Somebody signing up may be a
 * patient reaching out, so this is `RouteError` with its orb, in the reader's
 * language, and with no stack or message on the screen.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} where="auth" />;
}
