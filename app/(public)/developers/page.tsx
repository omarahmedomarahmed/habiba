import type { Metadata } from "next";

import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "There is no public API yet. What exists, what it would have to guarantee before it opened, and how to reach a person.",
};

/**
 * The developer page. PLAN.md 28.5, C149.
 *
 * ## 🔴 A documentation page for an API that does not exist is a lie with
 * syntax highlighting
 *
 * The obvious version of this page is a base URL, an authentication section
 * and three endpoints, written from the internal routes. Every one of those
 * routes exists, and not one of them is a contract: they take a session cookie
 * and a same-origin check, they change shape whenever a screen does, and they
 * are not versioned. Publishing them as an API means the first integrator
 * builds on something we will break in a fortnight without knowing we did.
 *
 * So this page says there is no API, says exactly what one would have to
 * guarantee before it existed, and stops. When sprints 42 and 43 build the
 * partner plane and SMART on FHIR, this page becomes the documentation for
 * something real.
 */
export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Developers</h1>

      <Card className="mt-6 border-amber-200 bg-amber-50 p-5">
        <p className="font-semibold text-amber-900">There is no public API yet.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
          Not a beta, not an early access programme, not a form. The routes this product runs on
          are internal: they authenticate with a session cookie, they are not versioned, and their
          shape changes whenever a screen does. Documenting them would hand you something we will
          break in a fortnight without knowing we broke it.
        </p>
      </Card>

      <h2 className="mt-10 text-lg font-bold tracking-tight text-slate-900">
        What one would have to promise before it opened
      </h2>
      <p className="mt-2 leading-relaxed text-slate-600">
        This is the list we hold ourselves to rather than a roadmap. An API that cannot do all four
        is worse for you than no API, because it looks like a commitment.
      </p>
      <ul className="mt-4 space-y-4">
        <Promise
          title="A version that does not move under you"
          body="A dated version in the path, a stated deprecation window, and a changelog that records breaks rather than features."
        />
        <Promise
          title="Identity that does not collide"
          body="Two clinics will both send us a patient called P123. Accepting a foreign id as though it were ours is the shortest path to one person's note landing in another person's chart, so the mapping has to exist before the endpoint does."
        />
        <Promise
          title="Consent that survives the boundary"
          body="A note leaving this platform is a patient's clinical record leaving it. Whatever grants access here has to mean something on the other side, or we have built a hole and called it an integration."
        />
        <Promise
          title="An audit trail on both sides"
          body="Every read and write of clinical data is already recorded here with an actor and a timestamp. An API that lets a partner read a chart without appearing in that log breaks the one guarantee this product makes about itself."
        />
      </ul>

      <h2 className="mt-10 text-lg font-bold tracking-tight text-slate-900">
        If you are building something now
      </h2>
      <p className="mt-2 leading-relaxed text-slate-600">
        Write to us and say what you are trying to do. We would rather hear the problem before
        there is an API than fit one to an endpoint somebody guessed at. There is no list to join
        and nobody gets told first.
      </p>
    </main>
  );
}

function Promise({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-s-2 border-slate-200 ps-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
    </li>
  );
}
