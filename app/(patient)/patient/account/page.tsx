import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { eq } from "drizzle-orm";

import { ChangeNumber } from "@/components/patient/change-number";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { patientAccounts } from "@/lib/db/schema";
import { lockUntil } from "@/lib/data/phone-change";
import { requirePatient } from "@/lib/patient-auth/guard";
import { zoneLabel } from "@/lib/scheduling/tz";
import { getCountries } from "@/lib/settings";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Who they are, and the doors out. PLAN.md 15.1's fifth tab.
 *
 * Deliberately small. §3d gives phone changes a 90-day discipline and a staff
 * queue (20.13–20.17), and sprint 20 puts the request *here* rather than
 * behind a support ticket: the patient starts it, a person checks it, and a
 * code to the new number finishes it. Everything else on this screen is either
 * a handle or a door to something that is genuinely self-service.
 */
export default async function PatientAccountPage() {
  const actor = await requirePatient();

  const [account] = await db
    .select({
      phoneVerifiedAt: patientAccounts.phoneVerifiedAt,
      createdAt: patientAccounts.createdAt,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, actor.accountId))
    .limit(1);

  const countries = await getCountries();
  const locked = account ? lockUntil(account) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {actor.firstName} {actor.lastName ?? ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Your account and who can see your record.</p>
      </div>

      <ChangeNumber
        current={actor.phone}
        countries={countries.map((c) => ({ code: c.code, name: c.name }))}
        lockedUntilLabel={locked ? locked.toISOString().slice(0, 10) : null}
      />

      <Card className="p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-mono text-slate-800">{actor.phone ?? "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">Email</dt>
            {/*
              13R.6 — an account may legitimately have no address. Saying so is
              better than an empty line, and the sentence names what adding one
              buys rather than nagging.
            */}
            <dd className="truncate text-slate-800">{actor.email ?? "Not added"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">Time zone</dt>
            <dd className="text-slate-800">
              {actor.timezone ? zoneLabel(actor.timezone) : "Not set"}
            </dd>
          </div>
        </dl>

        {!actor.email ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            You signed up with your phone number. Adding an email lets you sign in with it too, and
            means we can reach you if WhatsApp fails.
          </p>
        ) : null}
      </Card>

      <Link href="/patient/consent">
        <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
          <ShieldCheck className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">Who can see your record</span>
            <span className="block text-xs text-slate-500">
              Give access, take it back, and see what you were asked.
            </span>
          </span>
        </Card>
      </Link>

      <Link href="/patient/profile">
        <Card className="p-4 active:bg-slate-50">
          <span className="block text-sm font-semibold text-slate-900">Your own documents</span>
          <span className="block text-xs text-slate-500">
            Anything you have uploaded or written down about yourself.
          </span>
        </Card>
      </Link>

      {/*
        🔴 §6 — a patient never sees a transcript or a clinical note. There is
        deliberately no link here to one, and `lib/data/patient-view.ts` is
        what makes that structural rather than a matter of which links exist.
      */}
    </main>
  );
}
