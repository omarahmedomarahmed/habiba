import type { Metadata } from "next";
import Link from "next/link";

import { eq } from "drizzle-orm";

import { AskHistory } from "@/components/patient/ask-history";
import { PatientBack } from "@/components/patient/back";
import { ConsentList } from "@/components/patient/consent-list";
import { InviteTherapist } from "@/components/patient/invite-therapist";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patients, sessions, users } from "@/lib/db/schema";
import { asksForPerson, invitesForPerson } from "@/lib/data/portability";
import { grantsForPerson, pendingRequestsFor } from "@/lib/data/grants";
import { requirePatient } from "@/lib/patient-auth/guard";
import { fullName } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/consent/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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

  const [requests, grants, invites, asks, seen] = await Promise.all([
    pendingRequestsFor(actor.personId),
    grantsForPerson(actor.personId),
    invitesForPerson(actor.personId),
    asksForPerson(actor.personId),
    /*
     * 27.7 — only clinicians who have actually seen them. Drawn from their own
     * sessions rather than typed, so this cannot become a way to message any
     * clinician on the platform.
     */
    db
      .selectDistinct({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(sessions)
      .innerJoin(patients, eq(patients.id, sessions.patientId))
      .innerJoin(users, eq(users.id, sessions.therapistId))
      .where(eq(patients.personId, actor.personId))
      .limit(20),
  ]);

  /* A live code is one nobody has used and nobody has cancelled. */
  const now = Date.now();
  const liveInvites = invites.filter(
    (invite) => !invite.revokedAt && invite.expiresAt.getTime() > now,
  );

  const named = <T extends { therapistFirstName: string; therapistLastName: string }>(row: T) =>
    fullName(row.therapistFirstName, row.therapistLastName);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Who can read your history
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Your history is yours. A therapist can ask to read it, and you can stop them at any time -
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

      {/* 27.2 / C102b — the patient's own way to bring somebody in. */}
      <InviteTherapist
        live={liveInvites.map((invite) => ({
          id: invite.id,
          code: invite.code,
          expiresOn: invite.expiresAt.toISOString().slice(0, 10),
          redeemedBy: invite.redeemedBy,
          /* 37R.25 — "look above" is only true while the request is above. */
          awaitingAnswer: requests.some(
            (request) => fullName(request.therapistFirstName, request.therapistLastName, "") === invite.redeemedBy,
          ),
        }))}
      />

      {/* 27.7 / C108 — asking backwards, with the answer guaranteed. */}
      <AskHistory
        clinicians={seen.map((row) => ({
          userId: row.userId,
          name: fullName(row.firstName, row.lastName, "A therapist"),
        }))}
        asks={asks.map((ask) => ({
          id: ask.id,
          therapistName: ask.therapistName,
          status: ask.status,
          declineReason: ask.declineReason,
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
        already read or the notes they wrote, those are their own clinical records, which they are
        required to keep.
      </p>
    </main>
  );
}
