import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { verifyExtract } from "@/lib/data/export";

export const metadata: Metadata = {
  title: "Check a 24Therapy record extract",
  description:
    "Confirm that a record extract was produced by 24Therapy, and what it contained when it was made.",
};
export const dynamic = "force-dynamic";

/**
 * The public verification page. PLAN.md 26.9, C127.
 *
 * ## 🔴 The two sentences this page exists to keep apart
 *
 * "24Therapy produced this document" is something we can say. "The diagnosis
 * in this document is correct" is not, and the gap between them is the whole
 * ruling: a platform that lets a code resolve to a person's clinical facts has
 * written a certificate, whatever it calls itself.
 *
 * So this page answers with counts and a date and nothing else. No name, no
 * clinician, no diagnosis, not even a confirmation that the code belongs to
 * whoever is holding the paper. An unknown code and a real one that is not
 * yours look identical, deliberately.
 *
 * It is a plain GET form: somebody is typing a code off a printed page, often
 * on a desktop in an office, and there is nothing here worth a fetch.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const entered = (code ?? "").trim();
  const result = entered ? await verifyExtract(entered) : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Check a record extract
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        A 24Therapy record extract carries a code on its cover page. Enter it here to confirm that
        we produced the document and what it contained on the day it was made.
      </p>

      <form action="/verify" className="mt-6 flex flex-wrap gap-2">
        <input
          type="text"
          name="code"
          defaultValue={entered}
          placeholder="XXXX-XXXX-XXXX"
          aria-label="Extract code"
          className="h-12 min-w-[14rem] flex-1 rounded-xl border border-slate-200 px-3.5 font-mono tracking-widest text-slate-900 uppercase outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white"
        >
          Check it
        </button>
      </form>

      {result ? (
        result.known ? (
          <Card className="mt-6 p-5">
            <p className="text-sm font-semibold text-slate-900">
              24Therapy produced a record extract with this code.
            </p>
            <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-slate-500">Produced on</dt>
              <dd className="text-slate-800">{result.issuedAt.toISOString().slice(0, 10)}</dd>
              <dt className="text-slate-500">Sessions in it</dt>
              <dd className="text-slate-800">{result.sessions}</dd>
              <dt className="text-slate-500">Notes signed by a clinician</dt>
              <dd className="text-slate-800">{result.signedNotes}</dd>
              <dt className="text-slate-500">Summary versions</dt>
              <dd className="text-slate-800">{result.summaryVersions}</dd>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              That is everything we are able to tell you. We do not confirm who the document is
              about, and we do not say that any clinical judgement inside it is right. A note in
              that extract carries the name and licence of the clinician who signed it, and they
              are the person to ask.
            </p>
          </Card>
        ) : (
          <Card className="mt-6 p-5">
            <p className="text-sm font-semibold text-slate-900">We do not recognise that code.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Check the twelve characters on the cover page. There is no letter O and no number 0
              in a code we issue. A code that was never issued and one that is not yours look the
              same here, on purpose.
            </p>
          </Card>
        )
      ) : null}
    </main>
  );
}
