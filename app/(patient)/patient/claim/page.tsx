import type { Metadata } from "next";

import { ClaimChallenge } from "@/components/patient/claim-challenge";
import { ClaimFlow } from "@/components/patient/claim-flow";
import { ProveHandle } from "@/components/patient/prove-handle";
import { Card } from "@/components/ui";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patientAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { openChallenges } from "@/lib/data/challenge";
import { requirePatient } from "@/lib/patient-auth/guard";

import { mySuggestions } from "./actions";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/claim/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "Your records", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * §3b's claim flow — the challenge, then the old routes behind it.
 *
 * Reached straight after signup, and reachable again later: somebody who
 * skipped it, or who saw a new clinician since, comes back here.
 *
 * ## Two paths, and the order matters
 *
 * A verified **phone number** produces `openChallenges` — the two questions of
 * §3b, one record at a time. That is the path this sprint built and the one
 * almost everybody takes, because 12.4 makes the number mandatory on every
 * record a therapist writes down.
 *
 * `ClaimFlow` below it is sprint 6's email-matching route, which still runs for
 * an account whose email matched something its number did not. It is second on
 * the page rather than removed, because §3b keeps email as a complete fallback
 * (13.9) — but the challenge is what a person sees first.
 *
 * **An empty page is a normal, complete outcome**, not a failure to apologise
 * for. It means nobody has written this person down yet, and the invite route
 * is what fixes that.
 */
export default async function ClaimPage() {
  const actor = await requirePatient();

  /*
   * 🔴 25.14 / C121 — the handle first, and the page says so.
   *
   * Before this, an account whose number was never proved fell through to the
   * empty state, which reads "nobody has written you down under this number".
   * That protects the secret by telling somebody a lie about their own care.
   * What is true, and says nothing about anybody, is that we have not looked.
   */
  const [account] = await db
    .select({
      phone: patientAccounts.phone,
      email: patientAccounts.email,
      phoneVerifiedAt: patientAccounts.phoneVerifiedAt,
      emailVerifiedAt: patientAccounts.emailVerifiedAt,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, actor.accountId))
    .limit(1);

  const proven = Boolean(account?.phoneVerifiedAt || account?.emailVerifiedAt);

  const [suggestions, challenges] = proven
    ? await Promise.all([mySuggestions(), openChallenges(actor.accountId)])
    : [[], []];

  const nothing = proven && suggestions.length === 0 && challenges.length === 0;

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

      {proven ? null : (
        <ProveHandle handle={account?.phone ?? account?.email ?? "your number"} />
      )}

      {challenges.length > 0 ? <ClaimChallenge challenges={challenges} /> : null}

      {suggestions.length > 0 ? <ClaimFlow suggestions={suggestions} /> : null}

      {nothing ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">Nothing to claim yet</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Nobody has written you down under this number or address. If you are seeing a therapist
            on 24Therapy, ask them to send you an invite. It is one button on your record.
          </p>
        </Card>
      ) : null}
    </main>
  );
}
