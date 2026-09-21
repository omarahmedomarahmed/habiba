import type { Metadata } from "next";

import {
  Console,
  ConsoleHead,
  PortalOption,
  SampleIntro,
  Stat,
  Table,
  Verified,
} from "../../portal-kit";
import { CLINIC_TEAM, CLINIC_WEEK } from "@/lib/marketing/fixtures";

export const metadata: Metadata = {
  title: "The clinic portal, three ways",
  robots: { index: false, follow: false },
};

const money = (cents: number) =>
  `$${String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

/**
 * 🔴 A ROW CARRIES VERIFICATION AND EARNINGS. IT DOES NOT CARRY A CASELOAD.
 *
 * `components/clinic/people-list.tsx` is explicit that a real row shows no
 * caseload size and no session count, because a practice that can see
 * "Dr Salma: 46" beside "Dr Youssef: 12" has built a performance-management
 * surface out of clinical volume. Earnings stay, because a practice pays its
 * clinicians and the earnings screen is a real screen. What it must never do
 * is divide that by a number of sessions.
 */
const PEOPLE = CLINIC_TEAM.map(
  (one) =>
    [
      one.name,
      <Verified key={one.name} state={one.verify} />,
      one.earnedCents === 0 ? "-" : money(one.earnedCents),
    ] as const,
);

const NO_CASELOAD =
  "No column here is a caseload or a session count. Earnings are the practice's business; dividing them by sessions is not.";

const WEEK = CLINIC_WEEK.map(
  (one) => [`${one.day} ${one.time}`, one.clinician, one.patient] as const,
);

/** The week as a strip: five days, with how many hours are in each. */
function WeekStrip() {
  const days = [
    { day: "Mon", n: 2 },
    { day: "Tue", n: 2 },
    { day: "Wed", n: 1 },
    { day: "Thu", n: 1 },
    { day: "Fri", n: 0 },
  ];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {days.map((one) => (
        <div
          key={one.day}
          className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-center"
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{one.day}</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-navy-500">{one.n}</p>
          <div className="mt-1 flex justify-center gap-0.5">
            {Array.from({ length: Math.max(one.n, 1) }).map((_, i) => (
              <span
                key={i}
                className={`h-1 w-1 rounded-full ${one.n === 0 ? "bg-slate-200" : "bg-brand-500"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClinicSamplePage() {
  return (
    <main className="bg-white">
      <SampleIntro
        eyebrow="Design review"
        title="The clinic portal, drawn three ways"
        body="A practice manager is accountable for seats, the week and the books, and never for clinical work. The three options disagree about which of those three is the screen you land on. Real colours, real type, real figures from the fixtures."
        links={[
          { href: "/design/clinic", label: "The wireframes, all five screens" },
          { href: "/design/patient/sample", label: "Patient app" },
          { href: "/design/company/sample", label: "Company portal" },
        ]}
      />

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-3 lg:gap-8">
          <PortalOption
            option="A"
            name="The desk"
            bet="Six sections in a rail, as today. Every screen has a name and a place, and nothing is hiding behind a gear."
            cost="Bills and Earnings are the same subject from two ends and sit apart, so the money question takes two clicks and a mental join."
          >
            <Console
              path="app.24therapy.com/clinic"
              rail={["This week", "Clinicians", "Bills", "Earnings", "Team", "Records"]}
              active="This week"
            >
              <ConsoleHead title="This week" sub="Nile Practice" action="Add a clinician" />
              <div className="mb-2.5 grid grid-cols-3 gap-2">
                <Stat label="Seats" value="3" note="$216 a month" />
                <Stat label="Hours" value="6" note="booked this week" />
                <Stat label="Next bill" value="1 Apr" note="one bill, whole practice" />
              </div>
              <Table head={["When", "Clinician", "Patient"]} rows={WEEK.slice(0, 5)} />
            </Console>
          </PortalOption>

          <PortalOption
            option="B"
            name="The week first"
            bet="The rota is home. What is happening today is what a manager opens this for on most days, so it is the thing that is already on screen."
            cost="A manager who came to pay a bill lands on a rota they did not ask for, and the money is one click away in the wrong direction."
          >
            <Console
              path="app.24therapy.com/clinic"
              rail={["Week", "People", "Money"]}
              active="Week"
            >
              <ConsoleHead title="Week of 16 March" sub="Nile Practice" action="Add an hour" />
              <WeekStrip />
              <div className="mt-2.5">
                <Table head={["When", "Clinician", "Patient"]} rows={WEEK} />
              </div>
            </Console>
          </PortalOption>

          <PortalOption
            option="C"
            name="Two ledgers"
            bet="People and Money, with the week as a strip above People. Seats, verification and payouts each belong to one of the two and nothing sits between them."
            cost="The week as a strip is smaller than a busy practice wants it, and a six-clinician rota will not fit in five tiles."
          >
            <Console
              path="app.24therapy.com/clinic"
              rail={["People", "Money"]}
              active="People"
            >
              <ConsoleHead title="People" sub="Nile Practice · 3 seats" action="Add a clinician" />
              <WeekStrip />
              <div className="mt-2.5">
                <Table head={["Clinician", "Licence", "Earned"]} rows={PEOPLE} note={NO_CASELOAD} />
              </div>
            </Console>
          </PortalOption>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-navy-500">
            What is the same in all three
          </h2>
          <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-slate-700">
            {[
              "A clinician row carries a licence state and what they earned. It never carries a caseload or a session count.",
              "The rota shows a name and a time, because that is what the practice pays for. There is no column for a reason.",
              "One bill for the practice, prorated the day somebody joins or leaves, with earnings kept per clinician.",
              "Nobody in this portal can open a note, a transcript or a summary, in any of the three.",
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
