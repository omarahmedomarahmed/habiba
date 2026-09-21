import type { Metadata } from "next";
import Link from "next/link";

import {
  Block,
  Chips,
  Cols,
  Compare,
  Empty,
  Fill,
  Head,
  Option,
  Orb,
  Phone,
  Pick,
  Tabs,
} from "@/components/design/wire";

/**
 * The patient app, as three arrangements to choose between. Task 134.
 *
 * ## Why this page exists before any code
 *
 * The patient app is twenty-four screens and it is the surface the product is
 * judged on, because it is the one a person in distress opens at two in the
 * morning. Rebuilding it from a brief and showing the result is the expensive
 * way to find out the brief meant something else.
 *
 * So: every screen a patient touches, drawn three ways, with the decision each
 * row is asking about written above it. Approve a column, or approve row by row
 * and take A's home with C's record.
 *
 * ## What the three options actually disagree about
 *
 * All three keep what is not up for debate: the SOS orb on every screen, the
 * radar reachable in one press from anywhere, and no clinical text in a place a
 * patient did not ask for it.
 *
 * They disagree about one thing, and everything else follows from it: **is
 * finding a therapist a place you go, or a thing you do.** A makes it a tab, B
 * makes it an action, C makes it the top of the only screen that matters.
 *
 * ## Why the empty states are drawn at full size
 *
 * Eleven patient screens currently put a ~100px card at the top of a full
 * height column with seventy per cent white under it, so the app looks broken
 * on the day somebody joins. Every option below draws its empty state at the
 * size it would really be, because that is the difference the rebuild is
 * mostly about and a wireframe that tidies it away is a wireframe that lies.
 */
export const metadata: Metadata = {
  title: "Patient app, three ways",
  robots: { index: false, follow: false },
};

export default function PatientDesignPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            Design review · patient
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            The patient app, drawn three ways, before anybody builds one
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-700">
            Every screen a patient touches, in three arrangements. Approve a whole column, or
            go row by row and take one option&rsquo;s home screen with another&rsquo;s record.
            Nothing here is built yet.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-start">
                  <th className="py-2 pe-4 text-start font-semibold text-navy-500">Option</th>
                  <th className="py-2 pe-4 text-start font-semibold text-navy-500">The idea</th>
                  <th className="py-2 text-start font-semibold text-navy-500">
                    What it costs you
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-slate-200">
                  <td className="py-3 pe-4 align-top font-semibold">A · Four tabs</td>
                  <td className="py-3 pe-4 align-top">
                    Home, Sessions, Therapists, Profile. Finding somebody is a place you go.
                    Journal, record, consent and billing live under Profile.
                  </td>
                  <td className="py-3 align-top">
                    Four tabs is one more thing to read. Profile becomes a drawer of six
                    unrelated things.
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pe-4 align-top font-semibold">B · Three tabs</td>
                  <td className="py-3 pe-4 align-top">
                    Home, Sessions, You. Finding somebody is an action, on every screen, not a
                    destination. You do not visit therapists, you look for one.
                  </td>
                  <td className="py-3 align-top">
                    A patient browsing rather than in a hurry has no shelf to browse. The
                    action has to be obvious or it is worse than a tab.
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pe-4 align-top font-semibold">C · Two surfaces</td>
                  <td className="py-3 pe-4 align-top">
                    Now, and You. Everything about the present on one screen; everything that
                    is a record on the other. Fewest places to look.
                  </td>
                  <td className="py-3 align-top">
                    Now has to carry a lot. It works when there is one next thing and gets
                    crowded when there are four.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Company and clinic get the same treatment next. The marketing mockups on{" "}
            <Link href="/for-patients" className="font-medium text-brand-600 hover:underline">
              /for-patients
            </Link>{" "}
            and the homepage render these same components, so whichever is chosen updates
            there by itself.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* ─────────────────────────────────────────────────────── the shell ── */}
        <Compare
          n={1}
          title="The shell"
          question="The one decision everything else follows from: is finding a therapist a place, an action, or the top of the only screen there is."
        >
          <Option name="A · Four tabs" tagline="Therapists is a tab, with a shelf you can browse.">
            <Phone path="/patient" note="Four tabs. Profile holds six unrelated things.">
              <Head>Home</Head>
              <Block label="Next session · Dr Sara, Thursday 6pm" h={56} tone="line" />
              <Block label="3 therapists online now →" h={40} tone="navy" />
              <Block label="A step you agreed to try" h={40} tone="grey" />
              <Fill />
              <Orb />
              <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={0} />
            </Phone>
          </Option>

          <Option name="B · Three tabs" tagline="Finding somebody is a button, on every screen.">
            <Phone path="/patient" note="Three tabs. The radar is the lifted action, as it is today.">
              <Head>Home</Head>
              <Block label="Next session · Dr Sara, Thursday 6pm" h={56} tone="line" />
              <Block label="A step you agreed to try" h={40} tone="grey" />
              <Block label="Your last summary" h={40} tone="grey" />
              <Fill />
              <Orb />
              <Tabs items={["Home", "Sessions", "Find", "You"]} active={0} lifted={2} />
            </Phone>
          </Option>

          <Option name="C · Two surfaces" tagline="Now, and You. Nothing else is a place.">
            <Phone path="/patient" note="Two tabs. Now carries the present; You carries the record.">
              <Head>Now</Head>
              <Block label="3 therapists online · talk in under a minute" h={64} tone="navy" />
              <Block label="Next session · Dr Sara, Thursday 6pm" h={48} tone="line" />
              <Block label="A step you agreed to try" h={36} tone="grey" />
              <Fill />
              <Orb />
              <Tabs items={["Now", "You"]} active={0} />
            </Phone>
          </Option>
        </Compare>

        {/* ──────────────────────────────────────────────────── the first day ── */}
        <Compare
          n={2}
          title="The first day, with nothing in it"
          question="The app on the day somebody joins. Eleven screens today put a 100px card at the top of an empty page, which is why it looks broken on day one. What should be there instead."
        >
          <Pick option="A" path="/patient" note="A named empty state per section, each one a line.">
            <Head>Home</Head>
            <Empty label="No sessions yet" action="Find someone" size="line" />
            <Empty label="No steps yet" action="Find someone" size="line" />
            <Block label="3 therapists online now →" h={40} tone="navy" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={0} />
          </Pick>

          <Pick
            option="B"
            path="/patient"
            note="No empty sections at all. The one thing you can do fills the screen."
          >
            <Head>Home</Head>
            <Block label="Find someone to talk to" h={72} tone="navy" />
            <Block label="3 online now · Arabic, English" h={32} tone="line" />
            <Block label="Or book an hour that suits you" h={32} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={0} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="Now is the radar until there is something else to put on it."
          >
            <Head>Now</Head>
            <Block label="Dr Nour · Arabic, English · free now" h={44} tone="line" />
            <Block label="Dr Karim · Arabic · free now" h={44} tone="line" />
            <Block label="Dr Salma · English, French · free now" h={44} tone="line" />
            <Block label="Book a time instead" h={30} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={0} />
          </Pick>
        </Compare>

        {/* ───────────────────────────────────────────────────── the sessions ── */}
        <Compare
          n={3}
          title="Your sessions"
          question="Past and future in one list, or split. And whether the note written to you after a session is on this screen or one tap in."
        >
          <Pick option="A" path="/patient/sessions" note="Split by time. The note is one tap in.">
            <Head>Sessions</Head>
            <Chips items={["Upcoming", "Past"]} active={0} />
            <Block label="Thursday 6pm · Dr Sara · paid" h={48} tone="line" />
            <Block label="Next Tuesday 7pm · Dr Nour" h={48} tone="line" />
            <Block label="past" h={20} tone="dashed" />
            <Block label="2 March · Dr Sara · summary ready" h={48} tone="grey" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={1} />
          </Pick>

          <Pick
            option="B"
            path="/patient/sessions"
            note="One list, newest first, with the summary on the row itself."
          >
            <Head>Sessions</Head>
            <Block label="Thursday 6pm · Dr Sara · paid · Join" h={52} tone="navy" />
            <Block
              label="2 March · Dr Sara · “You named the pattern you keep…”"
              h={64}
              tone="line"
            />
            <Block
              label="23 Feb · Dr Sara · “We looked at what happens between…”"
              h={64}
              tone="line"
            />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={1} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="Sessions is a section of You, not a tab. Upcoming stays on Now."
          >
            <Head>You</Head>
            <Chips items={["Sessions", "Record", "Money"]} active={0} />
            <Block
              label="2 March · Dr Sara · “You named the pattern…”"
              h={60}
              tone="line"
            />
            <Block label="23 Feb · Dr Sara · summary" h={48} tone="line" />
            <Block label="14 Feb · Dr Nour · summary" h={48} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={1} />
          </Pick>
        </Compare>

        {/* ────────────────────────────────────────────── finding a therapist ── */}
        <Compare
          n={4}
          title="Finding somebody"
          question="The signature screen. Map first or list first, and where the filters sit. Today the in-app version is a list and the public one is a map, which is the wrong way round."
        >
          <Pick
            option="A"
            path="/patient/radar"
            note="Map first, filters over it, the list a sheet you pull up."
          >
            <Head>Therapists</Head>
            <Chips items={["Any language", "Anything", "Now"]} active={2} />
            <Block label="▓ map · 3 online, 5 off shift" h={140} tone="navy" />
            <Block label="▲ pull up · 8 therapists" h={30} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={2} />
          </Pick>

          <Pick
            option="B"
            path="/patient/radar"
            note="Opened as an action, so it opens on the answer: who, right now."
          >
            <Head action="Map">Free now</Head>
            <Chips items={["Arabic", "English", "+ filter"]} active={0} />
            <Block label="Dr Nour · Arabic, English · $50 · FREE NOW" h={52} tone="line" />
            <Block label="Dr Karim · Arabic · $75 · FREE NOW" h={52} tone="line" />
            <Block label="Dr Salma · English · $50 · off shift" h={52} tone="grey" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={2} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="It is not a screen. It is the top of Now, always."
          >
            <Head>Now</Head>
            <Block label="▓ map · 3 online" h={96} tone="navy" />
            <Chips items={["Arabic", "English", "Sleep", "Anxiety"]} active={0} />
            <Block label="Dr Nour · free now · $50" h={44} tone="line" />
            <Block label="Dr Karim · free now · $75" h={44} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={0} />
          </Pick>
        </Compare>

        {/* ────────────────────────────────────────────────────── the booking ── */}
        <Compare
          n={5}
          title="Booking one of them"
          question="What a patient sees between choosing a person and being in a session. All three show the price with tax before anything is asked for."
        >
          <Pick option="A" path="/patient/t/[id]" note="A profile page, then a choice of two ways in.">
            <Head>Dr Nour Demo</Head>
            <Block label="Verified · Arabic, English · Anxiety, Sleep" h={44} tone="line" />
            <Block label="$50 + VAT · 50 minutes" h={36} tone="grey" />
            <Block label="Talk now" h={40} tone="teal" />
            <Block label="Book a time instead" h={36} tone="line" />
            <Block label="What they work on" h={56} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={2} />
          </Pick>

          <Pick
            option="B"
            path="/patient/t/[id]"
            note="A sheet over the list, so the list is never lost."
          >
            <Head>Free now</Head>
            <Block label="Dr Nour · Arabic, English" h={30} tone="grey" />
            <Block label="▁▁▁ sheet ▁▁▁" h={18} tone="dashed" />
            <Block label="Dr Nour Demo · verified" h={40} tone="line" />
            <Block label="$50 + VAT · 50 minutes" h={34} tone="grey" />
            <Block label="Go in now" h={42} tone="teal" />
            <Block label="Book a time instead" h={32} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={2} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="Expands in place on Now. No navigation at all before the session."
          >
            <Head>Now</Head>
            <Block label="▓ map" h={60} tone="navy" />
            <Block label="Dr Nour Demo · verified · Arabic, English" h={40} tone="line" />
            <Block label="$50 + VAT · 50 min · Go in now" h={46} tone="teal" />
            <Block label="Book a time instead" h={30} tone="dashed" />
            <Block label="Dr Karim · free now" h={34} tone="grey" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={0} />
          </Pick>
        </Compare>

        {/* ────────────────────────────────────────────────────── joining in ── */}
        <Compare
          n={6}
          title="Joining a session with no account"
          question="The flagship, and the only screen here a stranger sees. It is outside the app, so all three are the same route. The question is how much is asked before somebody is in the room."
        >
          <Pick option="A" path="/join/[token]" note="Three steps, named, so nothing is a surprise.">
            <Head>Join your session</Head>
            <Block label="Step 1 of 3 · What should we call you?" h={30} tone="grey" />
            <Block label="[ first name ]" h={40} tone="line" />
            <Block label="Continue" h={38} tone="navy" />
            <Block label="Next: recording, then the room" h={28} tone="dashed" />
            <Fill />
            <Orb />
          </Pick>

          <Pick
            option="B"
            path="/join/[token]"
            note="One screen. Name and consent together, one button into the room."
          >
            <Head>Join your session</Head>
            <Block label="What should we call you?" h={26} tone="grey" />
            <Block label="[ first name ]" h={40} tone="line" />
            <Block label="May this session be recorded?  ○ Yes  ○ No" h={44} tone="line" />
            <Block label="Go in" h={40} tone="teal" />
            <Block label="You can stop the recording at any point" h={26} tone="dashed" />
            <Fill />
            <Orb />
          </Pick>

          <Pick
            option="C"
            path="/join/[token]"
            note="In the room first, consent asked inside it before anything is kept."
          >
            <Head>Dr Sara is waiting</Head>
            <Block label="▓ video" h={96} tone="navy" />
            <Block label="May this be recorded?  Yes / No" h={44} tone="line" />
            <Block label="Nothing is kept until you answer" h={26} tone="dashed" />
            <Fill />
            <Orb />
          </Pick>
        </Compare>

        {/* ──────────────────────────────────────────── the record and consent ── */}
        <Compare
          n={7}
          title="Your record, and who can read it"
          question="The densest screen in the app. It is the product's whole argument to a patient, and today it is a wall of controls. Where does it live and how much of it is on one screen."
        >
          <Pick
            option="A"
            path="/patient/consent"
            note="Its own screen under Profile. Room for the full list and every grant."
          >
            <Head>Who can read you</Head>
            <Block label="Dr Sara · can read · until you change it" h={48} tone="line" />
            <Block label="Dr Nour · cannot read" h={44} tone="grey" />
            <Block label="Nobody else, ever" h={30} tone="dashed" />
            <Block label="Take a copy of everything" h={36} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={3} />
          </Pick>

          <Pick
            option="B"
            path="/patient/account"
            note="Two rows on You, opening to the full list. Fewer screens to find."
          >
            <Head>You</Head>
            <Block label="Who can read you · 1 therapist ›" h={44} tone="line" />
            <Block label="Your record · take a copy ›" h={44} tone="line" />
            <Block label="Sessions and money ›" h={44} tone="line" />
            <Block label="Your details ›" h={44} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={3} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="A section of You, above everything else on it, because it is the promise."
          >
            <Head>You</Head>
            <Chips items={["Sessions", "Record", "Money"]} active={1} />
            <Block label="Dr Sara · can read · stop ›" h={44} tone="line" />
            <Block label="Nobody else can read anything" h={30} tone="dashed" />
            <Block label="Your summary, both therapists on it" h={44} tone="grey" />
            <Block label="Take a copy" h={34} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={1} />
          </Pick>
        </Compare>

        {/* ──────────────────────────────────────────────────────── the money ── */}
        <Compare
          n={8}
          title="What you have paid"
          question="A patient pays the therapist, never us. The question is whether that deserves a tab, a row, or a line."
        >
          <Pick option="A" path="/patient/billing" note="Under Profile. A list of what was paid and to whom.">
            <Head>Money</Head>
            <Block label="2 March · Dr Sara · $50 · paid" h={44} tone="line" />
            <Block label="23 Feb · Dr Sara · $50 · paid" h={44} tone="line" />
            <Block label="You pay the therapist, never us" h={30} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={3} />
          </Pick>

          <Pick
            option="B"
            path="/patient/billing"
            note="Reached from You. Covered patients see their employer's share here."
          >
            <Head>Sessions and money</Head>
            <Block label="Covered by Nile Holdings · $0 to you" h={44} tone="teal" />
            <Block label="2 March · Dr Sara · covered" h={40} tone="line" />
            <Block label="23 Feb · Dr Sara · $50 paid" h={40} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={3} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="A third chip on You. Never a tab, because most patients look once."
          >
            <Head>You</Head>
            <Chips items={["Sessions", "Record", "Money"]} active={2} />
            <Block label="Covered by Nile Holdings" h={40} tone="teal" />
            <Block label="2 March · Dr Sara · covered" h={40} tone="line" />
            <Block label="23 Feb · Dr Sara · $50" h={40} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={1} />
          </Pick>
        </Compare>

        {/* ───────────────────────────────────────────────────── your details ── */}
        <Compare
          n={9}
          title="Your details, and the Edit gate"
          question="Today these fields are always editable and the app offers to change your number unprompted. All three read only until Edit is pressed. The question is what else sits on this screen."
        >
          <Pick option="A" path="/patient/profile" note="Details only. Everything else is its own row under Profile.">
            <Head action="Edit">Your details</Head>
            <Block label="Name · Mariam Demo" h={36} tone="grey" />
            <Block label="Phone · +20 10 •• •• 41" h={36} tone="grey" />
            <Block label="Language · Arabic" h={36} tone="grey" />
            <Block label="Country · Egypt" h={36} tone="grey" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={3} />
          </Pick>

          <Pick
            option="B"
            path="/patient/account"
            note="Details at the top of You, with the rest of the drawer under it."
          >
            <Head action="Edit">You</Head>
            <Block label="Mariam Demo · +20 10 •• •• 41" h={44} tone="grey" />
            <Block label="Who can read you ›" h={40} tone="line" />
            <Block label="Your record ›" h={40} tone="line" />
            <Block label="Sessions and money ›" h={40} tone="line" />
            <Block label="Sign out" h={34} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={3} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="At the foot of You, because it is the thing looked at least."
          >
            <Head>You</Head>
            <Chips items={["Sessions", "Record", "Money"]} active={1} />
            <Block label="…record above…" h={60} tone="dashed" />
            <Block label="Mariam Demo · +20 10 •• •• 41 · Edit" h={44} tone="grey" />
            <Block label="Sign out" h={32} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={1} />
          </Pick>
        </Compare>

        {/* ──────────────────────────────────────────── steps and the journal ── */}
        <Compare
          n={10}
          title="Steps and the journal"
          question="What a patient agreed to try, and what they wrote between sessions. Nobody scores either. The question is whether they are one thing or two."
        >
          <Pick option="A" path="/patient/homework" note="Two places. Steps is a tab-level idea under Home.">
            <Head>Steps</Head>
            <Block label="☐ Ten minutes outside before noon" h={44} tone="line" />
            <Block label="☑ Write down what woke you" h={44} tone="grey" />
            <Block label="Agreed with Dr Sara, 2 March" h={28} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Therapists", "Profile"]} active={0} />
          </Pick>

          <Pick
            option="B"
            path="/patient/homework"
            note="One screen. What you agreed and what you wrote, in one timeline."
          >
            <Head action="Write">Between sessions</Head>
            <Block label="☐ Ten minutes outside before noon" h={40} tone="line" />
            <Block label="Tue · “Slept badly again, but got up”" h={44} tone="grey" />
            <Block label="☑ Write down what woke you" h={40} tone="line" />
            <Block label="Mon · “The rehearsing starts once…”" h={44} tone="grey" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={0} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="On Now, because a step is a thing to do today, not a record."
          >
            <Head>Now</Head>
            <Block label="▓ map · 3 online" h={70} tone="navy" />
            <Block label="☐ Ten minutes outside before noon" h={40} tone="line" />
            <Block label="Write something down" h={34} tone="dashed" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={0} />
          </Pick>
        </Compare>

        {/* ────────────────────────────────────────────────── claiming a record ── */}
        <Compare
          n={11}
          title="Claiming a record a therapist already keeps"
          question="A number is not a person, so this asks two questions first. It is also the path most people take, and today it loops without ever completing. Where does it start."
        >
          <Pick option="A" path="/patient/claim" note="Its own screen, reached from a link the therapist sends.">
            <Head>Is this you?</Head>
            <Block label="A record exists for M. K." h={44} tone="line" />
            <Block label="Only the initials are shown" h={26} tone="dashed" />
            <Block label="Yes, send me a code" h={40} tone="navy" />
            <Block label="Not me" h={34} tone="line" />
            <Fill />
            <Orb />
          </Pick>

          <Pick
            option="B"
            path="/patient/claim"
            note="A banner on Home until it is finished, so it cannot be lost."
          >
            <Head>Home</Head>
            <Block label="⚠ A therapist keeps notes about you · claim ›" h={48} tone="teal" />
            <Block label="Next session · Dr Sara, Thursday" h={44} tone="line" />
            <Block label="A step you agreed to try" h={36} tone="grey" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Find", "You"]} active={0} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="A row on You under Record, because it is a fact about your record."
          >
            <Head>You</Head>
            <Chips items={["Sessions", "Record", "Money"]} active={1} />
            <Block label="⚠ Dr Sara keeps notes about you · claim ›" h={48} tone="teal" />
            <Block label="Dr Sara · can read · stop ›" h={40} tone="line" />
            <Block label="Take a copy" h={34} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={1} />
          </Pick>
        </Compare>

        {/* ──────────────────────────────────────────────── the live session ── */}
        <Compare
          n={12}
          title="While a session is running"
          question="Every other tap raises a sheet asking whether to leave. All three keep that. The question is what the app looks like around a live session."
        >
          <Pick option="A" path="/patient/sessions/live" note="A sixth tab appears, red, and stays until the session ends.">
            <Head>In session · 12:04</Head>
            <Block label="▓ video" h={120} tone="navy" />
            <Block label="Recording · you can stop it" h={30} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Session", "Home", "Sessions", "Therapists"]} active={0} />
          </Pick>

          <Pick
            option="B"
            path="/patient/sessions/live"
            note="The Find tab becomes the session, so the count of tabs never changes."
          >
            <Head>In session · 12:04</Head>
            <Block label="▓ video" h={120} tone="navy" />
            <Block label="Recording · you can stop it" h={30} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Home", "Sessions", "Live", "You"]} active={2} lifted={2} />
          </Pick>

          <Pick
            option="C"
            path="/patient"
            note="The session IS Now while it runs. Nothing else is on that screen."
          >
            <Head>In session · 12:04</Head>
            <Block label="▓ video" h={140} tone="navy" />
            <Block label="Recording · you can stop it" h={30} tone="line" />
            <Fill />
            <Orb />
            <Tabs items={["Now", "You"]} active={0} />
          </Pick>
        </Compare>

        <section className="border-t border-slate-200 py-12">
          <h2 className="text-xl font-bold tracking-tight text-navy-500">
            What is the same in all three
          </h2>
          <ul className="mt-4 grid max-w-3xl gap-2 text-sm leading-relaxed text-slate-700 sm:grid-cols-2">
            <li className="border-t border-slate-200 pt-2">
              The SOS orb, on every screen, dimmed during a session and never removed.
            </li>
            <li className="border-t border-slate-200 pt-2">
              The radar reachable in one press from anywhere, whatever it is called.
            </li>
            <li className="border-t border-slate-200 pt-2">
              Details read only until Edit is pressed, and no unprompted offer to change your
              number.
            </li>
            <li className="border-t border-slate-200 pt-2">
              Every price shown with tax on it before anything is asked for.
            </li>
            <li className="border-t border-slate-200 pt-2">
              No empty state that takes more than a row. This is the difference the rebuild is
              mostly about.
            </li>
            <li className="border-t border-slate-200 pt-2">
              No screen that types to a model. The patient app cannot reach one, and the import
              graph is what stops it.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
