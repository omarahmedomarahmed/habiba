import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { Card } from "@/components/patient/kit";
import { PatientBack } from "@/components/patient/back";
import { TherapistCard } from "@/components/patient/therapist-card";
import { categories, search } from "@/lib/data/discover";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.findATherapist"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Browse and search. PLAN.md 25.1.
 *
 * ## A plain GET form, on purpose
 *
 * No client state, no debounce, no fetch. The form submits to this page and
 * the server renders the answer, which means it works on a four-year-old
 * Android with a bad connection and it survives a back button. Search on a
 * patient app is not a place to be clever.
 */
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePatient();
  const { t } = await getI18n();

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [results, cats] = await Promise.all([
    query ? search(query) : Promise.resolve([]),
    categories(),
  ]);

  return (
    <main className="mx-auto flex flex-col min-h-dvh w-full max-w-lg gap-4 px-5 pt-16 pb-10">
      <PatientBack />

      <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("browse.title")}</h1>

      <form action="/patient/browse" className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("browse.placeholder")}
          aria-label={t("browse.searchAria")}
          className="w-full rounded-2xl border border-navy-100 bg-white py-3.5 pe-4 ps-10 text-sm text-navy-700 outline-none focus:border-brand-400"
        />
      </form>

      {query ? (
        results.length > 0 ? (
          <ul className="space-y-2.5">
            {results.map((therapist) => (
              <li key={therapist.userId}>
                <TherapistCard therapist={therapist} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-4">
            <p className="text-sm leading-relaxed text-navy-400">
              {t("browse.nothingMatched")}
            </p>
          </Card>
        )
      ) : null}

      {cats.length > 0 ? (
        <section>
          <h2 className="text-[17px] font-bold text-navy-700">{t("browse.areas")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-navy-400">
            {t("browse.areasBody")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cats.map((category) => (
              <li key={category.code}>
                <Link
                  href={`/patient/browse?q=${encodeURIComponent(category.code)}`}
                  className="flex items-center gap-1.5 rounded-full border border-navy-100 bg-white px-3.5 py-2 text-sm font-medium text-navy-600"
                >
                  {category.label}
                  <span className="text-xs text-navy-400">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-navy-400">
            {t("browse.none")} {t("browse.noneBody")}
          </p>
        </Card>
      )}
    </main>
  );
}
