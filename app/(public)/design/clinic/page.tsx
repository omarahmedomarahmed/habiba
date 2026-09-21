import type { Metadata } from "next";
import Link from "next/link";

import { Block, Compare, Fill, Head, PickWide } from "@/components/design/wire";

/**
 * The clinic portal, as three arrangements. Task 139.
 *
 * ## What a practice manager is actually accountable for
 *
 * Seats and who fills them, the week across their clinicians, the money in and
 * the money out, and verification. Not clinical work. `components/clinic/
 * people-list.tsx:32` states the rule a row obeys: no caseload size, no session
 * count, no patient, no rating, no earnings on the row, because a practice that
 * can see one clinician's volume beside another's has a performance-management
 * surface built out of clinical work.
 *
 * Every option below keeps that. The marketing console was breaking it until
 * this sprint, printing "46 sessions this month" under each name.
 *
 * ## 🔴 The structural hole none of these layouts can close
 *
 * Seat billing lives in the THERAPIST portal. `organizations.seats`, the only
 * number `seatMonthlyCents` bills on, is written at `lib/billing/seats.ts:114`,
 * reachable only from `app/(app)/billing/actions.ts:295`. So `takeSeat` and
 * `releaseSeat` in this portal move the practice's bill by zero, and
 * `billableFrom` is read only to print a date label. `seats.manage` is
 * declared, labelled and marked never-delegable, and gates no page and no
 * action anywhere in the codebase.
 *
 * "Seats you buy" is the headline on `/for-clinics`. Every wireframe here draws
 * a seat control; none of them can be built until that is wired.
 */
export const metadata: Metadata = {
  title: "Clinic portal, three ways",
  robots: { index: false, follow: false },
};

export default function ClinicDesignPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Design review · clinic
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            The clinic portal, drawn three ways
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-700">
            A practice manager is accountable for seats, the week, and the books. Never for
            clinical work. The three options disagree about which of those three is the
            screen you land on.
          </p>

          {/*
            🔴 THE SAMPLES, LINKED FROM THE TOP RATHER THAN THE BOTTOM.
            A wireframe withholds everything except position, which is what
            makes it fast and what makes it impossible to approve a design
            from. The finished version of each option is one click away.
          */}
          <a
            href="/design/clinic/sample"
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
              alternatives. It is wired in <code className="font-mono text-[12px]">components/clinic/chrome.tsx</code>.
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
                    Six sections in a rail, as today: This week, Clinicians, Bills, Earnings,
                    Team, Records.
                  </td>
                  <td className="py-3 align-top">
                    Bills and Earnings are the same subject from two ends and sit apart.
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pe-4 align-top font-semibold">B · The week first</td>
                  <td className="py-3 pe-4 align-top">
                    The rota is home. Week, People, Money. What is happening today is what a
                    manager opens this for on most days.
                  </td>
                  <td className="py-3 align-top">
                    A manager who came to pay a bill lands on a rota they did not ask for.
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pe-4 align-top font-semibold">C · Two ledgers</td>
                  <td className="py-3 pe-4 align-top">
                    People and Money, with the week as a strip above People. Seats, verification
                    and payouts each belong to one of the two.
                  </td>
                  <td className="py-3 align-top">
                    The week as a strip is smaller than a busy practice wants it.
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
          question="The screen after sign in, and the one thing this portal is for on an ordinary Tuesday."
        >
          <PickWide
            option="A"
            path="/clinic"
            nav={["This week", "Clinicians", "Bills", "Earnings", "Team", "Records"]}
            note="Six sections. The week summarises and everything else is a click."
          >
            <Head action="Export">Week of 9 March</Head>
            <Block label="34 appointments · 4 clinicians · $792 billed" h={40} tone="line" />
            <Block label="Mon 30 · Dr Nour · in person" h={26} tone="grey" />
            <Block label="Mon 30 · Dr Karim · video" h={26} tone="grey" />
            <Block label="Tue 31 · Dr Salma · video" h={26} tone="grey" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/clinic"
            nav={["Week", "People", "Money"]}
            note="Three sections. The rota is the product, drawn as a grid rather than a list."
          >
            <Head action="Export">This week</Head>
            <Block label="▓ Mon  Tue  Wed  Thu  Fri  ·  4 clinicians" h={84} tone="navy" />
            <Block label="34 booked · 2 hours unfilled on Thursday" h={36} tone="teal" />
            <Block label="No patient names on this screen" h={28} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/clinic"
            nav={["People", "Money"]}
            note="Two ledgers. The week is a strip, and People is the screen under it."
          >
            <Head>Nile Practice</Head>
            <Block label="▓ this week · 34 booked, Thu has 2 free hours" h={44} tone="navy" />
            <Block label="Dr Nour Demo · verified · seat since 1 Jan" h={30} tone="line" />
            <Block label="Dr Karim Example · verified · seat since 1 Jan" h={30} tone="line" />
            <Block label="Dr Youssef · verification in progress" h={30} tone="grey" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={2}
          title="Your clinicians, and what a row may say"
          question="The rule is that a row shows verification and a seat, never a caseload. The question is what fills the space that leaves."
        >
          <PickWide
            option="A"
            path="/clinic/people"
            nav={["This week", "Clinicians", "Bills", "Earnings", "Team", "Records"]}
            note="Name, verification, seat date. The rule stated at the foot."
          >
            <Head action="Invite a clinician">Your clinicians</Head>
            <Block label="Dr Nour Demo · verified · on a seat" h={30} tone="line" />
            <Block label="Dr Karim Example · verified · on a seat" h={30} tone="line" />
            <Block label="Dr Youssef Example · verification in progress" h={30} tone="grey" />
            <Block label="Hana Demo · has not started verification" h={30} tone="grey" />
            <Block label="No caseload, no session count, no patient. Ever." h={32} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/clinic/people"
            nav={["Week", "People", "Money"]}
            note="Availability instead of volume: the one number a practice may see."
          >
            <Head action="Invite">People</Head>
            <Block label="Dr Nour · verified · 12 hours published this week" h={34} tone="line" />
            <Block label="Dr Karim · verified · 9 hours published" h={34} tone="line" />
            <Block label="Dr Youssef · verifying · no hours yet" h={34} tone="grey" />
            <Block label="Hours offered, never sessions held" h={30} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/clinic"
            nav={["People", "Money"]}
            note="Grouped by seat state, because that is what a manager acts on."
          >
            <Head action="Invite">People</Head>
            <Block label="ON A SEAT · 3 · $216 a month" h={30} tone="navy" />
            <Block label="Dr Nour · verified" h={26} tone="line" />
            <Block label="Dr Karim · verified" h={26} tone="line" />
            <Block label="NOT ON A SEAT · 2" h={30} tone="grey" />
            <Block label="Dr Youssef · verifying · give a seat" h={26} tone="line" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={3}
          title="Seats, and the bill they move"
          question="A seat per clinician, prorated the day they join or leave, one bill for the practice. This is the headline on the marketing page and the thing that is not wired."
        >
          <PickWide
            option="A"
            path="/clinic/bills"
            nav={["This week", "Clinicians", "Bills", "Earnings", "Team", "Records"]}
            note="Bills as a list. The seat count is a number on an invoice."
          >
            <Head>Bills</Head>
            <Block label="March · 3 seats · $216 · due" h={34} tone="line" />
            <Block label="February · 3 seats · $216 · paid" h={30} tone="grey" />
            <Block label="January · 2 seats · $144 · paid" h={30} tone="grey" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/clinic/money"
            nav={["Week", "People", "Money"]}
            note="A slider, so the price is a thing you move rather than a thing you read."
          >
            <Head>Money</Head>
            <Block label="Seats ──●────── 3 · $216 a month" h={44} tone="navy" />
            <Block label="A 4th seat from today: +$52 this month, prorated" h={36} tone="teal" />
            <Block label="March · $216 · due 31 March" h={30} tone="line" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/clinic"
            nav={["People", "Money"]}
            note="Both directions on one screen: what you pay us, what you owe them."
          >
            <Head>Money</Head>
            <Block label="OUT · 3 seats · $216 a month · due 31 March" h={40} tone="navy" />
            <Block label="IN · patients paid $4,180 this month" h={34} tone="line" />
            <Block label="TO CLINICIANS · $3,344 · 2 payouts waiting" h={40} tone="teal" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={4}
          title="What the clinicians earned"
          question="A practice pays its clinicians, so earnings are its business. The line it must not cross is dividing that by a session count."
        >
          <PickWide
            option="A"
            path="/clinic/earnings"
            nav={["This week", "Clinicians", "Bills", "Earnings", "Team", "Records"]}
            note="A table of amounts, with payout state per clinician."
          >
            <Head>Earnings</Head>
            <Block label="Dr Nour Demo · $2,140 · payout requested" h={30} tone="line" />
            <Block label="Dr Karim Example · $1,760 · paid" h={30} tone="line" />
            <Block label="Dr Salma Demo · $1,430 · not requested" h={30} tone="grey" />
            <Block label="Amounts only. No session counts." h={30} tone="dashed" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/clinic/money"
            nav={["Week", "People", "Money"]}
            note="Under the seat slider, because it is the other half of the same subject."
          >
            <Head>Money</Head>
            <Block label="…seats above…" h={26} tone="dashed" />
            <Block label="Owed to clinicians · $5,330" h={36} tone="teal" />
            <Block label="Dr Nour · $2,140 · requested" h={26} tone="line" />
            <Block label="Dr Karim · $1,760 · paid" h={26} tone="line" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/clinic"
            nav={["People", "Money"]}
            note="The third band of Money: out, in, and to them."
          >
            <Head>Money</Head>
            <Block label="…out and in above…" h={26} tone="dashed" />
            <Block label="TO CLINICIANS" h={26} tone="navy" />
            <Block label="Dr Nour · $2,140 · requested · approve" h={30} tone="line" />
            <Block label="Dr Karim · $1,760 · paid" h={26} tone="grey" />
            <Fill />
          </PickWide>
        </Compare>

        <Compare
          n={5}
          title="Your staff, and who can do what"
          question="A practice manager, a receptionist and an owner need different things. Today a staff member is created with an admin-typed password and can never be removed or have their role changed."
        >
          <PickWide
            option="A"
            path="/clinic/team"
            nav={["This week", "Clinicians", "Bills", "Earnings", "Team", "Records"]}
            note="Its own section, with a capability matrix."
          >
            <Head action="Add staff">Team</Head>
            <Block label="Omar · owner · everything" h={30} tone="line" />
            <Block label="Dalia · manager · schedule, people, bills" h={30} tone="line" />
            <Block label="Reem · reception · schedule only" h={30} tone="line" />
            <Block label="Remove · change role" h={28} tone="teal" />
            <Fill />
          </PickWide>

          <PickWide
            option="B"
            path="/clinic/people"
            nav={["Week", "People", "Money"]}
            note="Staff and clinicians on one screen, because both are people here."
          >
            <Head action="Invite">People</Head>
            <Block label="CLINICIANS · 4" h={26} tone="navy" />
            <Block label="Dr Nour · verified · 12 hours" h={26} tone="line" />
            <Block label="STAFF · 3" h={26} tone="navy" />
            <Block label="Dalia · manager · change role · remove" h={30} tone="line" />
            <Fill />
          </PickWide>

          <PickWide
            option="C"
            path="/clinic"
            nav={["People", "Money"]}
            note="A third group under People, after seated and unseated."
          >
            <Head>People</Head>
            <Block label="…clinicians above…" h={26} tone="dashed" />
            <Block label="STAFF · 3 · nobody here sees a note" h={34} tone="navy" />
            <Block label="Dalia · manager · edit · remove" h={28} tone="line" />
            <Block label="Reem · reception · edit · remove" h={28} tone="line" />
            <Fill />
          </PickWide>
        </Compare>

        <section className="border-t border-slate-200 py-12">
          <h2 className="text-xl font-bold tracking-tight text-navy-500">
            What has to be built underneath, whichever is chosen
          </h2>
          <ul className="mt-5 grid max-w-3xl gap-3 text-sm leading-relaxed text-slate-700">
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">Seats do not bill.</strong> The number a
              practice is billed on is written only from the therapist portal, so taking or
              releasing a seat here moves the bill by zero. Every wireframe above draws a seat
              control and none of them can be built until that is wired. It is the headline on
              the clinics page.
            </li>
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">A staff member cannot be removed.</strong>{" "}
              There is no remove action in the codebase, and no way to change a role. Three of
              the wireframes above draw both.
            </li>
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">No password reset.</strong> Same as the company
              portal: no route, no link, no support contact in the chrome.
            </li>
            <li className="border-t border-slate-200 pt-3">
              <strong className="text-navy-500">The mockups follow.</strong> The console on{" "}
              <Link href="/for-clinics" className="font-medium text-brand-700 hover:underline">
                /for-clinics
              </Link>{" "}
              and the two clinic tiles on the homepage render the same component this portal
              does, so whichever is chosen reaches the marketing site with it rather than in a
              later sprint.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
