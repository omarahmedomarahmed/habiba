"use client";

import { RouteError } from "@/components/patient/route-error";

/**
 * The patient app's boundary. Why it exists, and why it keeps the SOS orb, is
 * written once on `RouteError`, which `/pay` and `/join` render too (P19).
 */
export default function PatientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} where="patient" />;
}
