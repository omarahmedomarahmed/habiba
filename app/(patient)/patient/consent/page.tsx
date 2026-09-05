import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ConsentList } from "@/components/patient/consent-list";
import { grantsForPerson, pendingRequestsFor } from "@/lib/data/grants";
import { requirePatient } from "@/lib/patient-auth/guard";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Who can read your history", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The consent screen. PLAN.md 7.4 / 7.5, and the first half of 13.7.
 *
 * Everything on it is keyed on the signed-in person, so there is no id in the
 * URL to tamper with — the page cannot be pointed at somebody else's consents
 * even by a person who knows their ids.
 *
 * 🔴 No clinical content, deliberately (§6). It shows clinician names, the
 * shape of each grant, and the note attached to a request. It does not show
 * what any of them wrote.
 */
export default async function ConsentPage() {
  const actor = await requirePatient();

  const [requests, grants] = await Promise.all([
    pendingRequestsFor(actor.personId),
    grantsForPerson(actor.personId),
  ]);

  const named = <T extends { therapistFirstName: string; therapistLastName: string }>(row: T) =>
    fullName(row.therapistFirstName, row.therapistLastName);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <Link
          href="/patient"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Who can read your history
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Your history is yours. A therapist can ask to read it, and you can stop them at any time —
          they do not have to agree and you do not have to explain.
        </p>
      </div>

      <ConsentList
        requests={requests.map((r) => ({
          id: r.id,
          therapistName: named(r),
          requestNote: r.requestNote,
          requestedAt: r.requestedAt,
        }))}
        grants={grants.map((g) => ({
          id: g.id,
          status: g.status,
          shape: g.shape,
          therapistName: named(g),
          expiresAt: g.expiresAt,
          decidedAt: g.decidedAt,
          revokedAt: g.revokedAt,
        }))}
      />

      {/*
        Said once, at the bottom, and phrased as fact rather than warning.
        §3: revoking stops new reading and cannot un-read what was already
        seen — the patient is entitled to know that before they rely on it,
        and not to be alarmed by it.
      */}
      <p className="px-1 pb-4 text-xs leading-relaxed text-slate-500">
        Stopping access stops any further reading straight away. It does not erase what a therapist
        already read or the notes they wrote — those are their own clinical records, which they are
        required to keep.
      </p>
    </main>
  );
}
