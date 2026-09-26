import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { Card } from "@/components/patient/kit";
import { PatientBack } from "@/components/patient/back";
import { TherapistCard } from "@/components/patient/therapist-card";
import { categories, exploreTherapists, search } from "@/lib/data/discover";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { cn } from "@/lib/utils";

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

  /*
   * 🔴 Founder, 26 Sep: "the therapists page should show all therapists by
   * default and not wait for the patient to click a filter". With no query it
   * lists everybody listed, in the explore rail's order (online first, then a
   * daily rotation, never a ranking), and the areas are chips that narrow it.
   */
  const [results, cats] = await Promise.all([
    query ? search(query, 100) : exploreTherapists(500),
    categories(),
  ]);
  const activeCode = cats.find((category) => category.code.toLowerCase() === query.toLowerCase())?.code ?? null;
  const heading = !query
    ? t("browse.allTitle")
    : (cats.find((category) => category.code === activeCode)?.label ?? t("browse.resultsFor", { q: query }));

  return (
    <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
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

      {/* The areas, as filters over the list below. "All" is where the page starts. */}
      {cats.length > 0 ? (
        <nav aria-label={t("browse.areas")} className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
          <ul className="flex w-max gap-2 pb-1">
            <li>
              <Link
                href="/patient/browse"
                aria-current={!query ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap",
                  !query ? "bg-navy-900 text-white" : "border border-navy-100 bg-white text-navy-600",
                )}
              >
                {t("browse.allChip")}
              </Link>
            </li>
            {cats.map((category) => (
              <li key={category.code}>
                <Link
                  href={`/patient/browse?q=${encodeURIComponent(category.code)}`}
                  aria-current={category.code === activeCode ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap",
                    category.code === activeCode
                      ? "bg-navy-900 text-white"
                      : "border border-navy-100 bg-white text-navy-600",
                  )}
                >
                  {category.label}
                  <span className={cn("text-xs", category.code === activeCode ? "text-white/70" : "text-navy-400")}>
                    {category.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section>
        <h2 className="text-[17px] font-bold text-navy-700">{heading}</h2>
        {results.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {results.map((therapist) => (
              <li key={therapist.userId}>
                <TherapistCard therapist={therapist} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-3 p-4">
            <p className="text-sm leading-relaxed text-navy-400">
              {query ? t("browse.nothingMatched") : `${t("browse.none")} ${t("browse.noneBody")}`}
            </p>
          </Card>
        )}
      </section>
    </main>
  );
}
