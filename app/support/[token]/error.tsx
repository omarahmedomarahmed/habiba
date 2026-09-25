"use client";

import { RouteError } from "@/components/patient/route-error";

/** 🔴 W3: the same boundary `/pay` and `/join` have, SOS orb included. */
export default function SupportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} where="support" />;
}
