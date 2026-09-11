import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";
import { StateDot } from "@/components/marketing/state-dot";
import { INTEGRATIONS, STATE_LABEL, type IntegrationState } from "@/lib/integrations/registry";

export const metadata: Metadata = {
  title: "What 24Therapy connects to",
  description:
    "Every integration with its real state: what works today, what half-works, and what is not built. No logo grid.",
};

/**
 * The integrations page. PLAN.md 28.5, C149.
 *
 * 🔴 It is deliberately not a logo grid. Every entry states whether it works,
 * and the ones that do not say so at the top of their own card rather than in
 * a footnote. A clinic reading this should be able to decide without emailing
 * anybody, which is the only reason a page like this is worth having.
 */
export default function IntegrationsPage() {
  const groups = ["live", "partial", "planned"] as const;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">What this connects to</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
        Every entry below says whether it works. Three of them do not, and they are on this page
        anyway, labelled, because you finding out from us is better than you finding out after
        signing something.
      </p>

      {groups.map((state) => {
        const rows = INTEGRATIONS.filter((entry) => entry.state === state);
        if (rows.length === 0) return null;

        return (
          <section key={state} className="mt-10">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <StateDot state={state} />
              {STATE_LABEL[state]}
            </h2>
            <ul className="mt-3 space-y-3">
              {rows.map((entry) => (
                <li key={entry.slug}>
                  <Link href={`/integrations/${entry.slug}`}>
                    <Card className="p-4 transition hover:border-slate-300">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="font-semibold text-slate-900">{entry.name}</p>
                        <p className="text-xs text-slate-400">{entry.category}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{entry.summary}</p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
