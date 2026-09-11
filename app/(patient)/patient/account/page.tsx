import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { eq } from "drizzle-orm";

import { ChangeNumber } from "@/components/patient/change-number";
import { IdentityEditor } from "@/components/patient/identity-editor";
import { Card } from "@/components/ui";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patientAccounts, people } from "@/lib/db/schema";
import { lockUntil } from "@/lib/data/phone-change";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { zoneLabel } from "@/lib/scheduling/tz";
import { getCountries } from "@/lib/settings";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/account/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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

  const [person] = await db
    .select({ avatarUrl: people.avatarUrl })
    .from(people)
    .where(eq(people.id, actor.personId))
    .limit(1);

  const countries = await getCountries();
  const locked = account ? lockUntil(account) : null;
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {actor.firstName} {actor.lastName ?? ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t("paccount.body")}</p>
      </div>

      {/* 25.7 / C115 — name and picture, both theirs. */}
      <IdentityEditor
        personId={actor.personId}
        firstName={actor.firstName}
        lastName={actor.lastName ?? null}
        hasPhoto={Boolean(person?.avatarUrl)}
      />

      <ChangeNumber
        current={actor.phone}
        countries={countries.map((c) => ({ code: c.code, name: c.name }))}
        lockedUntilLabel={locked ? locked.toISOString().slice(0, 10) : null}
      />

      <Card className="p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t("paccount.phone")}</dt>
            <dd className="font-mono text-slate-800">{actor.phone ?? "-"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t("paccount.email")}</dt>
            {/*
              13R.6 — an account may legitimately have no address. Saying so is
              better than an empty line, and the sentence names what adding one
              buys rather than nagging.
            */}
            <dd className="truncate text-slate-800">{actor.email ?? t("paccount.notAdded")}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t("paccount.timezone")}</dt>
            <dd className="text-slate-800">
              {actor.timezone ? zoneLabel(actor.timezone) : t("paccount.notSet")}
            </dd>
          </div>
        </dl>

        {!actor.email ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            {t("paccount.addEmailBody")}
          </p>
        ) : null}
      </Card>

      <Link href="/patient/consent">
        <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
          <ShieldCheck className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{t("paccount.whoCanSee")}</span>
            <span className="block text-xs text-slate-500">
              {t("paccount.whoCanSeeBody")}
            </span>
          </span>
        </Card>
      </Link>

      <Link href="/patient/profile">
        <Card className="p-4 active:bg-slate-50">
          <span className="block text-sm font-semibold text-slate-900">{t("paccount.ownDocuments")}</span>
          <span className="block text-xs text-slate-500">
            {t("paccount.ownDocumentsBody")}
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
