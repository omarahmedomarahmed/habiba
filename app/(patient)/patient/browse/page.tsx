import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { Card } from "@/components/ui";
import { PatientBack } from "@/components/patient/back";
import { TherapistCard } from "@/components/patient/therapist-card";
import { categories, search } from "@/lib/data/discover";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "Find a therapist", robots: { index: false } };
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

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [results, cats] = await Promise.all([
    query ? search(query) : Promise.resolve([]),
    categories(),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <PatientBack />

      <h1 className="text-xl font-bold tracking-tight text-slate-900">Find a therapist</h1>

      <form action="/patient/browse" className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Anxiety, Arabic, grief…"
          aria-label="What do you need help with?"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pe-4 ps-10 text-sm text-slate-900 outline-none focus:border-brand-400"
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
            <p className="text-sm leading-relaxed text-slate-600">
              Nobody on 24Therapy has listed that yet. Try one of the areas below, or open the
              radar to see who is free right now.
            </p>
          </Card>
        )
      ) : null}

      {cats.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-900">What do you want help with?</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Only areas a verified therapist has actually listed. The number is how many.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cats.map((category) => (
              <li key={category.code}>
                <Link
                  href={`/patient/browse?q=${encodeURIComponent(category.code)}`}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                >
                  {category.label}
                  <span className="text-xs text-slate-400">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Nobody has been listed yet. The radar shows who is available this minute.
          </p>
        </Card>
      )}
    </main>
  );
}
