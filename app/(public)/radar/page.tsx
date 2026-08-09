import type { Metadata } from "next";
import Link from "next/link";

import { PublicRadar } from "@/components/radar/public-radar";
import { listRadar } from "@/lib/data/radar";

export const metadata: Metadata = {
  title: "Crisis Radar — talk to a therapist now",
  description:
    "See which licensed therapists are available this minute, what languages they speak and what they charge. No account, no waiting list.",
};

/**
 * Rendered per request, never cached.
 *
 * Availability is the entire content of this page. A cached radar is a page
 * that sends someone in crisis to a clinician who logged off twenty minutes
 * ago, which is worse than showing them nothing.
 */
export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const therapists = await listRadar();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-wider text-teal-600 uppercase">Crisis Radar</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Someone is on shift right now
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Every dot is a licensed therapist who is online this minute. Pick one, tell them what to
          call you, and you are in a session in under a minute — no account, no waiting list, no
          form about your insurance.
        </p>
      </div>

      <div className="mt-6">
        <PublicRadar initial={therapists} />
      </div>

      <div className="mt-8 rounded-2xl bg-slate-100 px-4 py-4">
        <p className="text-sm font-semibold text-slate-900">If you are in immediate danger</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          This is not an emergency service. In the US, call or text{" "}
          <span className="font-semibold">988</span> for the Suicide &amp; Crisis Lifeline, or 911.
          Elsewhere, call your local emergency number.
        </p>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Are you a therapist?{" "}
        <Link href="/signup" className="font-semibold text-brand-600">
          Go on the radar
        </Link>{" "}
        and get paid for sessions you take between appointments.
      </p>
    </div>
  );
}
