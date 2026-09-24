"use client";

import { RouteError } from "@/components/patient/route-error";

/**
 * 🔴 P19: somebody waiting to be let into a session. A throw here used to
 * reach the global page, in English and without the SOS orb; `RouteError`
 * says why that matters.
 */
export default function JoinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} where="join" />;
}
