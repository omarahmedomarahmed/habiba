import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui";
import { StateDot } from "@/components/marketing/state-dot";
import { INTEGRATIONS, STATE_LABEL, findIntegration } from "@/lib/integrations/registry";

export function generateStaticParams() {
  return INTEGRATIONS.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = findIntegration(slug);
  if (!entry) return { title: "Not found" };

  return {
    title: `${entry.name}, 24Therapy`,
    description: entry.summary,
  };
}

/**
 * One integration, in full. PLAN.md 28.5, C149.
 *
 * ## 🔴 Every page has a "what it does not do"
 *
 * Including the ones that work. A limits section that only appears on the
 * broken entries is a limits section readers learn to treat as a warning
 * label, and the useful information on this page is mostly in that paragraph:
 * Stripe does not pay out to Egypt, one microphone cannot tell two voices
 * apart, a record extract is not a certificate.
 */
export default async function IntegrationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = findIntegration(slug);
  if (!entry) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link
        href="/integrations"
        className="flex w-fit items-center gap-1 text-sm font-medium text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All integrations
      </Link>

      <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-500">
        <StateDot state={entry.state} />
        {STATE_LABEL[entry.state]}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{entry.name}</h1>

      <h2 className="mt-8 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        What it does today
      </h2>
      <p className="mt-2 leading-relaxed text-slate-700">{entry.today}</p>

      <h2 className="mt-8 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        What it does not do
      </h2>
      <p className="mt-2 leading-relaxed text-slate-700">{entry.limits}</p>

      {entry.waitingOn ? (
        <Card className="mt-8 border-slate-200 bg-slate-50 p-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Waiting on {entry.waitingOn}. That is the piece of work it depends on, not a date. We
            do not publish dates for things that are not built, and we do not keep a list of people
            to tell first: a waiting list is a commitment with the accountability taken out.
          </p>
        </Card>
      ) : null}
    </main>
  );
}
