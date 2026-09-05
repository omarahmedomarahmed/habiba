import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { pendingRequestsFor } from "@/lib/data/grants";
import { nextStepFor } from "@/lib/data/homework";
import { requirePatient } from "@/lib/patient-auth/guard";
import { db } from "@/lib/db";
import { patients, people } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const metadata: Metadata = { title: "Your sessions", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The patient's home.
 *
 * A shell for sprint 13, which brings the globe, the bottom navigation and the
 * session lists. What it shows today is exactly what sprints 5 and 6 make
 * true: who they are, whether their record is claimed, and how many clinical
 * files are attached to it.
 *
 * 🔴 It deliberately shows **no clinical content**. §6: a patient never sees a
 * transcript or a clinical note, enforced server-side. This page reads two
 * counts and a name; the notes written *for* the patient arrive in 13.4 and go
 * through their own query.
 */
export default async function PatientHomePage() {
  const actor = await requirePatient();

  // 7.4 — an unanswered request is the one thing on this page that is waiting
  // on them, so it is counted here rather than discovered by navigating.
  const waiting = await pendingRequestsFor(actor.personId);
  const pending = waiting.length;

  /*
   * 9.5 — one step. `nextStepFor` returns a single row and a capped count of
   * what else is waiting; it cannot return a rate, a streak or a history,
   * which is how the ⚠️ rule is enforced rather than remembered.
   */
  const next = await nextStepFor(actor.personId);

  const [person] = await db
    .select({
      claimedAt: people.claimedAt,
      records: sql<number>`(SELECT COUNT(*)::int FROM ${patients} WHERE ${patients.personId} = ${people.id})`,
    })
    .from(people)
    .where(eq(people.id, actor.personId))
    .limit(1);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Welcome, {actor.firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{actor.email}</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Your record</p>
          {person?.claimedAt ? (
            <Badge tone="teal">Yours</Badge>
          ) : (
            <Badge tone="slate">Not claimed yet</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {person?.records
            ? `${person.records} therapist file${person.records === 1 ? "" : "s"} attached.`
            : "No therapist files are attached to your account yet."}
        </p>
        <Link
          href="/patient/claim"
          className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
        >
          {person?.claimedAt ? "Claim another record" : "Do you have records to claim?"}
        </Link>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Who can read your history</p>
          {pending > 0 ? <Badge tone="amber">{pending} waiting</Badge> : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {pending > 0
            ? `${pending} therapist${pending === 1 ? " has" : "s have"} asked to read your history. You decide, and you can change your mind later.`
            : "Nobody reads your history unless you say so. You can stop anyone at any time."}
        </p>
        <Link
          href="/patient/consent"
          className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
        >
          {pending > 0 ? "Answer now" : "Manage access"}
        </Link>
      </Card>

      {next ? (
        <Card className="border border-brand-200 p-4">
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
            To try before your next session
          </p>
          <p className="mt-1.5 text-base leading-relaxed font-medium text-slate-900">
            {next.title}
          </p>
          {next.detail ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{next.detail}</p>
          ) : null}
          <Link
            href="/patient/homework"
            className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
          >
            {next.othersWaiting > 0
              ? `Open this and ${next.othersWaiting}${next.othersWaiting === 9 ? "+" : ""} more`
              : "Open it"}
          </Link>
        </Card>
      ) : null}

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Your profile</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Letters, prescriptions and anything you want a therapist to know. It travels with you.
        </p>
        <Link
          href="/patient/profile"
          className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
        >
          Open your profile
        </Link>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Coming next</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Your sessions, your homework and your billing appear here.
        </p>
      </Card>
    </main>
  );
}
