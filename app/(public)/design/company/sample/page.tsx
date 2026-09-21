import type { Metadata } from "next";

import {
  Console,
  ConsoleHead,
  PortalOption,
  Pot,
  SampleIntro,
  Stat,
  Table,
  Verified,
} from "../../portal-kit";
import { COMPANY_PAID } from "@/lib/marketing/fixtures";

export const metadata: Metadata = {
  title: "The company portal, three ways",
  robots: { index: false, follow: false },
};

const money = (cents: number) => `$${String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

const PAID = COMPANY_PAID.map((row) => [row.therapist, money(row.cents)] as const);

/**
 * 🔴 THE ROSTER SHOWS A NAME AND A VERIFICATION STATE. THAT IS THE WHOLE LIST.
 *
 * It is the one screen the wall is actually about: a company that can see
 * "Mariam: 6 sessions" beside "Omar: 1" has built a surveillance tool out of
 * its benefit. `lib/data/sponsors.ts` calls it THE WALL and there is no query
 * that could add a session count to this table. All three options say so on
 * the screen rather than in a footnote, because an employee who does not know
 * the rule is not protected by it.
 */
const ROSTER = [
  ["Mariam Demo", <Verified key="a" state="verified" />, "12 Jan"],
  ["Omar Example", <Verified key="b" state="verified" />, "3 Feb"],
  ["Laila Demo", <Verified key="c" state="pending" />, "28 Feb"],
  ["Youssef Example", <Verified key="d" state="none" />, "-"],
] as const;

const WALL = "No column here is a session count, and no query exists that could add one.";

export default function CompanySamplePage() {
  return (
    <main className="bg-white">
      <SampleIntro
        eyebrow="Design review"
        title="The company portal, drawn three ways"
        body="The screen after sign in, in each. All three lead with the pot, because the money is the reason this account exists, and they disagree about what is beside it. Real colours, real type, real figures from the fixtures."
        links={[
          { href: "/design/company", label: "The wireframes, all five screens" },
          { href: "/design/patient/sample", label: "Patient app" },
          { href: "/design/clinic/sample", label: "Clinic portal" },
        ]}
      />

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-3 lg:gap-8">
          <PortalOption
            option="A"
            name="The desk"
            bet="A left rail with every section in it, tidied. Anybody who has used an admin console knows where they are within a second."
            cost="Seven sections for two questions, and the answer is never on the screen you land on."
          >
            <Console
              path="app.24therapy.com/sponsor"
              rail={["Overview", "Pot", "People", "Domains", "Integrations", "Settings", "Billing"]}
              active="Overview"
            >
              <ConsoleHead title="Overview" sub="Habiba Holdings" action="Top up" />
              <Pot />
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <Stat label="Joined" value="63" note="of 240 employees" />
                <Stat label="Used it" value="40" note="this month" />
                <Stat label="Code" value="NILE" note="example.com" />
              </div>
              <div className="mt-2.5">
                <Table head={["Clinician", "Paid"]} rows={PAID} note={WALL} />
              </div>
            </Console>
          </PortalOption>

          <PortalOption
            option="B"
            name="Two questions"
            bet="Money and People. Domains and the HR connection are done once, so they live behind a gear rather than taking permanent navigation."
            cost="Setup being hidden makes a first week harder, so this one needs a checklist on first sign in or it is worse than A."
          >
            <Console
              path="app.24therapy.com/sponsor"
              rail={["Money", "People"]}
              active="Money"
            >
              <ConsoleHead title="Money" sub="Habiba Holdings" action="Top up" />
              <Pot loud />
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Stat label="This month" value="$1,880" note="40 sessions" />
                <Stat label="Last month" value="$1,640" note="36 sessions" />
              </div>
              <div className="mt-2.5">
                <Table head={["Clinician", "Paid"]} rows={PAID.slice(0, 3)} note={WALL} />
              </div>
              <p className="mt-2.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[10px] text-slate-600">
                Your code, your domain and the HR connection are set up and live. Behind the gear.
              </p>
            </Console>
          </PortalOption>

          <PortalOption
            option="C"
            name="One board"
            bet="A single scrolling board. The pot as a vessel with a date it runs out, take-up under it, the roster under that. Nothing to navigate."
            cost="One long page, and anything that needs a table of fifty rows has to open somewhere else anyway."
          >
            <Console path="app.24therapy.com/sponsor">
              <ConsoleHead title="Habiba Holdings" sub="Everything, on one page" action="Top up" />
              <Pot loud />
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <Stat label="Joined" value="63" note="of 240" />
                <Stat label="Used it" value="40" note="this month" />
                <Stat label="Per person" value="$47" note="average" />
              </div>
              <p className="mt-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                Your people
              </p>
              <Table head={["Name", "Cover", "Since"]} rows={ROSTER} note={WALL} />
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
              "The pot carries a date it runs out, not just a balance. A balance is a noun; a date is a decision.",
              "The roster shows a name and a verification state. There is no session count on it and no query that could add one.",
              "The sentence about what a company can never see is on the screen, not in a footnote at the bottom of a page.",
              "Nobody in this portal can reach a note, a transcript or a diagnosis, in any of the three.",
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
