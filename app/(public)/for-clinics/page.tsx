import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "For clinics",
  description:
    "What a clinic gets, what it does not get, and the four questions to ask us before you put your practice on this.",
};

/**
 * The clinic page. PLAN.md 28.5.
 *
 * ## 🔴 Written as the questions a clinic should ask, not the features we have
 *
 * A practice manager evaluating this is deciding where their patients' records
 * live. The page that helps them is the one that answers the awkward
 * questions, and the page that wins the meeting is the one with the logo grid.
 * We are shipping the first one.
 *
 * Two of the four answers below are "not yet". They are on the page because a
 * clinic discovering either of them after signing is a clinic we have wasted.
 */
export default function ForClinicsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">For clinics</h1>
      <p className="mt-3 leading-relaxed text-slate-600">
        Several clinicians, one practice, and somebody accountable for what happens to the records.
        Here is what that looks like, in the order a practice manager actually asks.
      </p>

      <Question
        q="Who can see a patient's chart?"
        a="The clinician treating them, and nobody else by default. Not their colleague in the next room, not a practice manager, not us. A second clinician reads a patient's history only when that patient has said so, signed in, on their own screen, and the database refuses the access outright until they do. There is no administrative override, and no impersonation: an operator cannot log in as one of your clinicians to look at a chart."
      />
      <Question
        q="What happens when a clinician leaves?"
        a="The notes they wrote stay in the record, because a clinical record has to stay as it was written. Their access to anything live ends when their account does. Patients they were seeing keep their own record and can hand it to whoever picks them up, in one tap, without anybody at the practice moving files."
      />
      <Question
        q="Can we get our data out?"
        a="A patient can have their whole record emailed to themselves today, in full, with the licence of the clinician behind each signed note. A clinic-level export into your own record system is not built. That is the honest answer and it is the one that should decide whether this is right for you yet."
      />
      <Question
        q="Where does it run, and under what law?"
        a="On infrastructure in the United States today. Egyptian data staying in Egypt is designed and not live: the seam every query goes through exists, and it currently points at the US instance. Turning it on is a configuration change rather than a rebuild, which is deliberate, and it has not happened. If your regulator requires otherwise, this is the conversation to have with us before anything else."
      />

      <Card className="mt-10 border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">What is not here yet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Pushing a finished note into the record system you already use, and a shared clinic-level
          view across clinicians. Both are real work rather than switches, and both are on the{" "}
          <Link href="/integrations" className="font-semibold text-brand-600 underline">
            integrations page
          </Link>{" "}
          marked as not built.
        </p>
      </Card>
    </main>
  );
}

function Question({ q, a }: { q: string; a: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{q}</h2>
      <p className="mt-2 leading-relaxed text-slate-700">{a}</p>
    </section>
  );
}
