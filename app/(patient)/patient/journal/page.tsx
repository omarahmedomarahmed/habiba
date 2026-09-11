import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";
import { PatientBack } from "@/components/patient/back";
import { JournalWriter } from "@/components/patient/journal-writer";
import { grantsForPerson } from "@/lib/data/grants";
import { journalsForPerson } from "@/lib/data/journals";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDateTime, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Your journal", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The journal. PLAN.md 26.5 to 26.8, C123.
 *
 * ## 🔴 What this page is not allowed to say
 *
 * It does not say anybody is watching. Not "your therapist reads this", not
 * "we are here", not a shield, not a reassurance after a difficult entry.
 * C123's ruling is that promising monitoring we cannot staff is the most
 * dangerous thing this product could do, and the failure mode is specific: a
 * person writes the worst sentence of their life at 3am, believes it has been
 * seen, and waits.
 *
 * What it says instead is the narrow true thing: exactly which therapists can
 * read this, by name, because that is a fact and because a person deciding
 * what to write deserves to know who the audience is. When nobody holds a
 * grant it says that too, which is the honest version of privacy.
 *
 * And the SOS orb is on this screen like every other, from the chrome. The
 * crisis line being always available is the part of this we can actually keep.
 */
export default async function JournalPage() {
  const actor = await requirePatient();

  const [entries, grants] = await Promise.all([
    journalsForPerson(actor.personId),
    grantsForPerson(actor.personId),
  ]);

  const { t, locale } = await getI18n();

  const readers = grants
    .filter((grant) => grant.status === "granted")
    .map((grant) => fullName(grant.therapistFirstName, grant.therapistLastName, "A therapist"));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <PatientBack />

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("journal.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("journal.body")}
        </p>
      </div>

      {/*
        Who can read it, named. Not a promise that they do, and not a promise
        that anybody is reading now: a list of who has access, which is a fact.
      */}
      <Card className="border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">{t("journal.whoCanOpen")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {readers.length === 0
            ? t("journal.nobody")
            : t("journal.readers", { names: readers.join("، ") })}
        </p>
        <Link
          href="/patient/consent"
          className="mt-2.5 inline-flex text-sm font-semibold text-brand-600"
        >
          {t("home.whoCanRead")}
        </Link>
      </Card>

      <JournalWriter />

      {entries.length > 0 ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="p-4">
                <p className="text-xs text-slate-400">
                  {formatDateTime(entry.createdAt, actor.timezone, locale)}
                  {entry.source === "dictated" ? " · spoken" : ""}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                  {entry.body}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
