import type { Metadata } from "next";
import Link from "next/link";

import { Block, Chips, Compare, Fill, Head, Option, Browser, PickWide } from "@/components/design/wire";

/**
 * The company portal, as three arrangements. Task 138.
 *
 * ## The problem this is trying to solve, which is not a layout problem
 *
 * Coverage and spend are dull because they are nouns. An HR lead opens this
 * portal maybe twice a month, with two questions: is the money alright, and are
 * my people actually using it. Eleven screens of nouns answer neither on the
 * screen they land on.
 *
 * ## What is not up for debate, on any option
 *
 * The wall. `app/(sponsor)/sponsor/page.tsx:26` states it as SPEND, NEVER
 * SESSION COUNTS, NEVER PEOPLE, and `lib/data/sponsors.ts:96` calls the roster
 * select list "THE WALL". Below a headcount floor the company sees the balance
 * and nothing else, cohorts included, because a filtered series with one row
 * left in it is the leak wearing a suppression label.
 *
 * Every option below shows what the company will never see, on the screen, as a
 * feature rather than a footnote. The marketing console was showing per
 * therapist session counts until this sprint, which is a thing the product is
 * built to refuse.
 */
export const metadata: Metadata = {
  title: "Company portal, three ways",
  robots: { index: false, follow: false },
};

export default function CompanyDesignPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Design review · company
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            The company portal, drawn three ways
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-700">
            Eleven screens today. An HR lead opens this twice a month with two questions: is
            the money alright, and are my people using it. The three options disagree about
            how many screens it should take to answer them.
          </p>

          {/*
            🔴 THE SAMPLES, LINKED FROM THE TOP RATHER THAN THE BOTTOM.
            A wireframe withholds everything except position, which is what
            makes it fast and what makes it impossible to approve a design
            from. The finished version of each option is one click away.
          */}
          <a
            href="/design/company/sample"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-navy-600 shadow-sm hover:bg-brand-400"
          >
            See each option drawn properly
            <span aria-hidden>&rarr;</span>
          </a>
          {/*
            🔴 DECIDED. Leaving a comparison page up with no answer on it is
            how two people build the same screen twice from different columns.
          */}
          <p className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-navy-500">
            <span className="rounded-md bg-brand-500 px-2 py-0.5 text-[11px] font-bold tracking-wide text-navy-600 uppercase">
              Chosen
            </span>
            <span className="font-semibold">Option A &middot; The desk</span>
            <span className="text-slate-600">
              is what is being built. The other two stay here for the argument, not as
              alternatives. It is wired in <code className="font-mono text-[12px]">components/sponsor/chrome.tsx</code>.
            </span>
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-2 pe-4 text-start font-semibold text-navy-500">Option</th>
                  <th className="py-2 pe-4 text-start font-semibold text-navy-500">The idea</th>
                  <th className="py-2 text-start font-semibold text-navy-500">What it costs</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-slate-200">
                  <td className="py-3 pe-4 align-top font-semibold">A · The desk</td>
                  <td className="py-3 pe-4 align-top">
                    A left rail with seven sections, as today, tidied. Familiar to anybody who
                    has used an admin console.
                  </td>
                  <td className="py-3 align-top">
                    Seven sections for two questions. The answer is never on the screen you
                    land on.
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pe-4 align-top font-semibold">B · Two questions</td>
                  <td className="py-3 pe-4 align-top">
                    Money and People. Everything else is setup and lives behind a gear, because
                    domains and integrations are done once.
                  </td>
                  <td className="py-3 align-top">
                    Setup being hidden makes a first week harder. Needs a checklist on first
                    sign in.
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pe-4 align-top font-semibold">C · One board</td>
                  <td className="py-3 pe-4 align-top">
                    A single scrolling board. The pot as a vessel with a date it runs out,
                    take-up under it, the roster under that. Nothing to navigate.
                  </td>
                  <td className="py-3 align-top">
                    One long page. Anything that needs a table of fifty rows has to open
                    somewhere.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Compare
          n={1}
          title="What you land on"
          question="The screen after sign in. All three lead with the pot, because the money is the reason this account exists. They disagree about what is beside it."
        >
          <PickWide
            option="A"
            path="/sponsor"
            nav={["Overview", "People", "Pot", "Code", "Domains", "Connect", "Settings"]}
            note="Seven sections. The overview summarises, and every number links elsewhere."
          >
            <Head>Overview</Head>
            <Block label="Balance $4,120 · spent $5,880 · 63 sessions" h={44} tone="line" />
            <Block label="▓ spend by week · one week hatched, suppressed" h={70} tone="navy" />
            <Block label="Joining code · 41 joined, 22 used it" h={36} tone="grey" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/sponsor"
            nav={["Money", "People", "⚙"]}
            note="Two sections and a gear. The question you came with is the section name."
          >
            <Head action="Add to pot">Money</Head>
            <Block label="$4,120 left · runs out 31 March at this rate" h={56} tone="navy" />
            <Block label="▓ spend by week · one hatched" h={64} tone="line" />
            <Block label="What you will never see: who went, and when" h={34} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/sponsor"
            note="One board. Everything visible, nothing to open first."
          >
            <Head>Nile Holdings</Head>
            <Block label="▓ THE POT · $4,120 of $10,000 · empties 31 March" h={72} tone="navy" />
            <Block label="63 sessions · 22 of 41 people have used it" h={40} tone="line" />
            <Block label="▓ spend by week" h={52} tone="grey" />
            <Block label="Roster · 41 people ▾" h={34} tone="line" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={2}
          title="The pot, and when it runs out"
          question="Today it is four tiles of numbers. A balance is a noun; a date it runs out is a decision. All three add the date, and disagree about how loudly."
        >
          <PickWide
            option="A"
            path="/sponsor/pot"
            nav={["Overview", "People", "Pot", "Code", "Domains", "Connect", "Settings"]}
            note="Its own screen. Tiles, then the ledger of every deduction."
          >
            <Head action="Add to pot">Your pot</Head>
            <Block label="$4,120 left · $10,000 added · expires 31 Mar 2027" h={46} tone="line" />
            <Block label="Top up · 1 March · +$10,000" h={32} tone="grey" />
            <Block label="Sessions · week of 2 March · −$630" h={32} tone="grey" />
            <Block label="Sessions · week of 23 Feb · −$490" h={32} tone="grey" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/sponsor"
            nav={["Money", "People", "⚙"]}
            note="A vessel that empties, with the date as the headline, not a field."
          >
            <Head action="Add to pot">Money</Head>
            <Block label="▓▓▓▓▓░░░░░  $4,120 left" h={40} tone="navy" />
            <Block label="At this rate it empties on 31 March" h={34} tone="teal" />
            <Block label="Every deduction, dated ▾" h={32} tone="line" />
            <Block label="Invoices ▾" h={32} tone="line" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/sponsor"
            note="The vessel is the top of the board and never leaves the screen."
          >
            <Head>Nile Holdings</Head>
            <Block label="▓▓▓▓▓░░░░░ $4,120 · empties 31 March · Add" h={76} tone="navy" />
            <Block label="Where it went ▾ · 63 sessions, 12 clinicians" h={36} tone="line" />
            <Block label="…take-up below…" h={30} tone="dashed" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={3}
          title="Your people"
          question="The roster is the screen the wall is about. It carries a name, a verification date and nothing else, and no query exists that could add a session to it. All three say so on the screen."
        >
          <PickWide
            option="A"
            path="/sponsor/people"
            nav={["Overview", "People", "Pot", "Code", "Domains", "Connect", "Settings"]}
            note="A table, with the wall stated under it."
          >
            <Head action="Add someone">People</Head>
            <Block label="Mariam Demo · verified 2 March" h={30} tone="line" />
            <Block label="Tarek Example · verified 28 Feb" h={30} tone="line" />
            <Block label="Hana Demo · paused" h={30} tone="grey" />
            <Block label="No sessions, no dates, no therapists. Ever." h={32} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/sponsor/people"
            nav={["Money", "People", "⚙"]}
            note="Take-up first, because that is the question. Names under it."
          >
            <Head action="Add someone">People</Head>
            <Block label="22 of 41 have used it at least once" h={44} tone="navy" />
            <Block label="Nobody here can tell you which 22" h={32} tone="dashed" />
            <Block label="Mariam Demo · verified 2 March" h={28} tone="line" />
            <Block label="Tarek Example · verified 28 Feb" h={28} tone="line" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/sponsor"
            note="A section of the board, opening to the full table."
          >
            <Head>Nile Holdings</Head>
            <Block label="…pot above…" h={26} tone="dashed" />
            <Block label="22 of 41 have used it · which 22 is not knowable" h={44} tone="navy" />
            <Block label="Mariam Demo · verified 2 March" h={26} tone="line" />
            <Block label="Tarek Example · verified 28 Feb" h={26} tone="line" />
            <Block label="Show all 41 ▾" h={26} tone="line" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={4}
          title="What you will never see"
          question="The strongest thing this portal has to say, and today it is a lock icon and one sentence at the bottom of a page. It is the reason an employee trusts a company scheme at all."
        >
          <PickWide
            option="A"
            path="/sponsor"
            nav={["Overview", "People", "Pot", "Code", "Domains", "Connect", "Settings"]}
            note="A panel on the overview, beside what you can see."
          >
            <Head>Overview</Head>
            <Block label="…numbers above…" h={26} tone="dashed" />
            <Block label="You see: spend, totals, take-up" h={40} tone="line" />
            <Block label="You never see: who, when, with whom, any note" h={48} tone="navy" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/sponsor"
            nav={["Money", "People", "⚙"]}
            note="Two columns at the top of Money, wider on the cannot side."
          >
            <Head>What this portal can show</Head>
            <Block label="CAN · spend · totals · take-up" h={44} tone="line" />
            <Block
              label="CANNOT · a name beside a session · a date · a therapist · a note · attendance"
              h={64}
              tone="navy"
            />
            <Block label="Not a policy. There is no query that returns it." h={32} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/sponsor"
            note="Under the pot, above the roster, so it is read on the way past."
          >
            <Head>Nile Holdings</Head>
            <Block label="…pot above…" h={26} tone="dashed" />
            <Block
              label="This portal cannot show who went, when, or to whom"
              h={52}
              tone="navy"
            />
            <Block label="…roster below…" h={26} tone="dashed" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={5}
          title="Setting it up: the code, the domain, the HR connection"
          question="Three screens that are used once and then never again. The question is whether they deserve permanent navigation."
        >
          <PickWide
            option="A"
            path="/sponsor/code"
            nav={["Overview", "People", "Pot", "Code", "Domains", "Connect", "Settings"]}
            note="Three permanent sections. Easy to find, and three-sevenths of the rail."
          >
            <Head>Joining code</Head>
            <Block label="NILE-4120 · 41 joined" h={40} tone="line" />
            <Block label="Download the poster" h={32} tone="grey" />
            <Block label="Domain · nileholdings.example · proved" h={32} tone="grey" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/sponsor/settings"
            nav={["Money", "People", "⚙"]}
            note="Behind the gear, with a checklist that empties as it is done."
          >
            <Head>Setting up</Head>
            <Block label="✓ Joining code · NILE-4120" h={30} tone="grey" />
            <Block label="✓ Domain proved · nileholdings.example" h={30} tone="grey" />
            <Block label="☐ Connect your HR system" h={36} tone="line" />
            <Block label="☐ Decide who may join without a code" h={36} tone="line" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/sponsor"
            note="A strip at the foot of the board, gone once every box is ticked."
          >
            <Head>Nile Holdings</Head>
            <Block label="…board above…" h={40} tone="dashed" />
            <Block label="Setting up · 2 of 4 done ▾" h={36} tone="line" />
            <Block label="☐ Connect your HR system" h={30} tone="grey" />
            <Fill />
          </PickWide>
        </Compare>

        <section className="border-t border-slate-200 py-12">
          <h2 className="text-xl font-bold tracking-tight text-navy-500">
            Three things that are broken underneath, whichever is chosen
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
            A layout cannot fix these, and drawing a screen that implies they work would be the
            marketing console&rsquo;s mistake made twice.
          </p>
          <ul className="mt-5 grid max-w-3xl gap-3 text-sm leading-relaxed text-slate-700">
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">An expired pot still pays.</strong> The expiry
              date is on four screens and gates top-up, but the row that funds a session never
              checks it and no sweep exists. Every option above prints a date that is currently
              decorative.
            </li>
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">
                A locked-out admin has nowhere to go.
              </strong>{" "}
              There is no password reset on this portal, no route and no link, and no support
              contact in the chrome.
            </li>
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">Every button in the demo console is a span.</strong>{" "}
              The marketing page renders a console whose controls do nothing. Whichever option
              is chosen, the same components carry it, so the mockups on{" "}
              <Link href="/for-companies" className="font-medium text-brand-700 hover:underline">
                /for-companies
              </Link>{" "}
              and the homepage update with the portal rather than after it.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
