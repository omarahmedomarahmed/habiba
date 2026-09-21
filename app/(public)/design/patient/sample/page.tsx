import type { Metadata } from "next";
import Link from "next/link";

import { OptionA, OptionB, OptionC, SampleRow } from "./samples";

export const metadata: Metadata = {
  title: "The patient app, three ways",
  /*
   * Not indexed, like every other page under /design. These are three
   * proposals, two of which will never be built, and a search result for one
   * of them is a promise about a product that does not exist.
   */
  robots: { index: false, follow: false },
};

export default function PatientSamplePage() {
  return (
    <main className="bg-white">
      <section className="border-b border-slate-200 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Design review
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            The patient app, drawn three ways
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-700">
            The same screen in each, because the three options disagree about where finding
            somebody lives and comparing three different screens would compare the screens.
            Real colours, real type, real people from the fixtures. Pick one and the other two
            stop existing.
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/design/patient" className="font-semibold text-brand-700 hover:text-brand-800">
              The wireframes, all twelve screens
            </Link>
            <Link href="/design/company" className="font-semibold text-brand-700 hover:text-brand-800">
              Company portal
            </Link>
            <Link href="/design/clinic" className="font-semibold text-brand-700 hover:text-brand-800">
              Clinic portal
            </Link>
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-3 lg:gap-10">
          <SampleRow
            option="A"
            name="Four tabs"
            bet="Therapists is a place you can browse when you are not in a hurry, so the app is useful on a Tuesday as well as at 3am."
            cost="Five targets on the bar, and Home has to carry a preview of the Therapists tab to justify it being a separate place."
          >
            <OptionA />
          </SampleRow>

          <SampleRow
            option="B"
            name="Three tabs, one button"
            bet="Finding somebody is not a destination, it is the thing you came for, so it is a control on every screen rather than a tab you have to be on."
            cost="The button takes the bottom of every screen whether or not anybody is free, and a quiet radar makes it a lie in the other direction."
          >
            <OptionB />
          </SampleRow>

          <SampleRow
            option="C"
            name="Now, and You"
            bet="The map is the app. Everything a patient opens this for at the worst hour of their week is on the first screen, with nothing above it."
            cost="Everything that is not urgent has to fit behind one word, and a patient with a session tomorrow sees it as a single row."
          >
            <OptionC />
          </SampleRow>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-navy-500">
            What is the same in all three
          </h2>
          <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-slate-700">
            {[
              "The SOS control is on every screen and is never behind a tab.",
              "The next session is above anything that can be scrolled past.",
              "Who can read your record is one tap from the first screen, in all three.",
              "Teal means a thing you press, and it carries navy ink, never white.",
              "Nothing on any of these screens types to a model.",
            ].map((one) => (
              <li key={one} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>{one}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
