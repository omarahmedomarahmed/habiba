import type { Metadata } from "next";

import { ClaimFlow } from "@/components/patient/claim-flow";
import { requirePatient } from "@/lib/patient-auth/guard";

import { mySuggestions } from "./actions";

export const metadata: Metadata = { title: "Your records", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * §3's claim flow, steps 2 through 8.
 *
 * Reached straight after signup, and reachable again later — somebody who
 * skipped it, or who saw a new clinician since, comes back here.
 *
 * **An empty list is a normal, complete outcome.** 56 of 66 patients in this
 * database have no email and none has a phone number, so most people will
 * match nothing and that is not a failure to apologise for. The page says so
 * and points at the invite route, which is the one that works for them.
 */
export default async function ClaimPage() {
  const actor = await requirePatient();
  const suggestions = await mySuggestions();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Have you seen a therapist before?
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          If they already keep notes about you, you can take ownership of them, {actor.firstName}.
        </p>
      </div>
      <ClaimFlow suggestions={suggestions} />
    </main>
  );
}
