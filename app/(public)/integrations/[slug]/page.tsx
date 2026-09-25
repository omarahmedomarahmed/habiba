import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DarkBand, Glow } from "@/components/public/site-ui";
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
    <main>
      <DarkBand className="px-5 pt-10 pb-14 sm:px-6 sm:pt-14 sm:pb-20">
        <Glow className="-start-40 top-0 h-[420px] w-[420px] opacity-50" />
        <div className="mx-auto max-w-3xl">
          <Link
            href="/integrations"
            className="flex w-fit items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-[13px] font-semibold text-white/85 ring-1 ring-white/15 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            All integrations
          </Link>

          <p className="mt-8 flex items-center gap-2 text-[14px] font-semibold text-white/85">
            <StateDot state={entry.state} />
            {STATE_LABEL[entry.state]}
          </p>
          <h1 className="mt-2 text-balance text-[38px] font-bold leading-[1.04] tracking-tight text-white sm:text-[52px]">
            {entry.name}
          </h1>
        </div>
      </DarkBand>

      <div className="mx-auto grid max-w-3xl gap-4 px-5 py-12 sm:px-6 sm:py-16">
        <section className="rounded-[24px] bg-navy-50 p-6 ring-1 ring-navy-100">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-brand-700 rtl:tracking-normal">
            What it does today
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-navy-600">{entry.today}</p>
        </section>

        <section className="rounded-[24px] bg-white p-6 ring-1 ring-navy-100">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-navy-400 rtl:tracking-normal">
            What it does not do
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-navy-600">{entry.limits}</p>
        </section>

        {entry.waitingOn ? (
          <Card className="rounded-[24px] border-amber-200 bg-amber-50 p-6">
            <p className="text-[15px] leading-relaxed text-amber-900">
              Waiting on {entry.waitingOn}. That is the piece of work it depends on, not a date. We
              do not publish dates for things that are not built, and we do not keep a list of people
              to tell first: a waiting list is a commitment with the accountability taken out.
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
