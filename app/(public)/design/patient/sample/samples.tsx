"use client";

import {
  Bell,
  CalendarDays,
  CircleUser,
  Clock,
  Globe2,
  Home,
  ListChecks,
  Lock,
  Search,
  Users,
  Video,
} from "lucide-react";

import { DeviceFrame } from "@/components/demo/device-frame";
import { WorldRadar } from "@/components/radar/world-radar";
import { RADAR_DEMO } from "@/lib/marketing/fixtures";
import { cn } from "@/lib/utils";

/**
 * 🔴 THE THREE OPTIONS AS SCREENS, NOT AS GREY BLOCKS.
 *
 * `/design/patient` compares the three shells as wireframes, which is the right
 * tool for "which arrangement" and the wrong one for "what would it look like".
 * The feedback on it was that it was very basic, and that is accurate rather
 * than unfair: a wireframe deliberately withholds everything except position,
 * and you cannot approve a design from a diagram of one.
 *
 * So this is one screen per option, drawn in the product's own visual language,
 * in the real device frame, with the real palette and the real fixture people.
 * The wireframes stay where they are. They answer a different question and they
 * answer it faster; this page is for the decision that comes after.
 *
 * ## The screen chosen, and why it is always the same one
 *
 * Home, in all three. It is the screen every patient sees most, it is the one
 * the three options actually disagree about, and comparing three different
 * screens would compare the screens rather than the shells.
 *
 * ## Why the text is in this file and not in the dictionary
 *
 * `app/(public)/` is exempt from the i18n ratchet, and this page is the reason
 * that exemption needs watching: it is a hand-written page rather than a CMS
 * row, so "the rows are already published in both languages" does not apply to
 * it. It is here anyway because a design review page is read by the four people
 * choosing between these and is never shipped to a patient. If one of these
 * options is built, its strings go through the dictionary like everything else.
 */

/* ────────────────────────────────────────────────────── shared pieces ── */

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[30rem] flex-col bg-slate-50">{children}</div>;
}

/** The app bar, as the real patient app draws it. */
function Bar({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 pt-3 pb-2.5 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold tracking-tight text-navy-500">{title}</p>
          {sub ? <p className="mt-0.5 truncate text-[12px] text-slate-600">{sub}</p> : null}
        </div>
        <Bell className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </div>
    </div>
  );
}

/**
 * The next session, which is the one card that is never not on this screen.
 *
 * Teal ground with navy ink, which is the primary pairing everywhere else in
 * the product: white on teal is 2.17:1 and navy on teal is 7.27:1.
 */
function NextSession({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-brand-500 p-3.5 text-navy-600 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">
          Tomorrow, 18:00
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold">
          <Video className="h-3 w-3" aria-hidden />
          Video
        </span>
      </div>
      <p className="mt-1.5 text-[15px] font-bold">Dr Nour Demo</p>
      {compact ? null : (
        <p className="mt-0.5 text-[12px] leading-relaxed opacity-80">
          50 minutes. The room opens ten minutes before.
        </p>
      )}
      <span className="mt-3 block rounded-xl bg-navy-500 px-3 py-2 text-center text-[13px] font-semibold text-white">
        Open the room
      </span>
    </div>
  );
}

function SectionLabel({ children, action }: { children: string; action?: string }) {
  return (
    <div className="mt-5 mb-2 flex items-baseline justify-between gap-2 px-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{children}</p>
      {action ? <span className="text-[11px] font-semibold text-brand-700">{action}</span> : null}
    </div>
  );
}

function StepRow({ text, when }: { text: string; when: string }) {
  return (
    <div className="mx-4 mb-1.5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-md border-2 border-slate-300" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug font-medium text-slate-900">{text}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500">{when}</span>
      </span>
    </div>
  );
}

function RecordRow() {
  return (
    <div className="mx-4 mt-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <Lock className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
      <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-900">
        Who can read your record
      </span>
      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
        1
      </span>
    </div>
  );
}

/** A clinician on the free-now shelf. */
function FreeChip({ name, languages, price }: { name: string; languages: string; price: string }) {
  return (
    <div className="w-[8.5rem] shrink-0 rounded-2xl border border-slate-200 bg-white p-2.5">
      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-brand-700">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-500" />
        Free now
      </span>
      <p className="mt-1.5 truncate text-[12px] font-bold text-slate-900">{name}</p>
      <p className="truncate text-[11px] text-slate-600">{languages}</p>
      <p className="mt-1 text-[12px] font-semibold tabular-nums text-slate-900">{price}</p>
    </div>
  );
}

const DOTS = RADAR_DEMO.map((who) => ({
  id: who.name,
  country: who.country,
  status: "online" as const,
  label: who.name,
}));

/* ──────────────────────────────────────────────────────── the options ── */

/**
 * A · Four tabs. Therapists is a place, with a shelf you can browse.
 *
 * The cost is on the screen: four tabs plus a lifted radar is five targets on a
 * bar, and Home has to carry a preview of the Therapists tab to justify it
 * being a separate place at all.
 */
export function OptionA() {
  return (
    <DeviceFrame
      as="phone"
      nav
      tabs={[
        { key: "home", label: "Home", icon: Home },
        { key: "sessions", label: "Sessions", icon: CalendarDays },
        { key: "radar", label: "Now", icon: Globe2, lifted: true },
        { key: "therapists", label: "Therapists", icon: Users },
        { key: "you", label: "You", icon: CircleUser },
      ]}
      activeTab="home"
    >
      <Screen>
        <Bar title="Good evening, Mariam" sub="One therapist can read your record" />
        <NextSession />

        <SectionLabel action="See all">Free right now</SectionLabel>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
          <FreeChip name="Dr Nour Demo" languages="Arabic, English" price="$60" />
          <FreeChip name="Dr Karim Example" languages="Arabic" price="$75" />
          <FreeChip name="Dr Salma Demo" languages="Arabic, French" price="$50" />
        </div>

        <SectionLabel>Your steps</SectionLabel>
        <StepRow text="Wind down for twenty minutes before bed" when="Agreed last Tuesday" />
        <StepRow text="Write down what the evening was like" when="Agreed last Tuesday" />

        <SectionLabel>Your record</SectionLabel>
        <RecordRow />
        <div className="h-4" />
      </Screen>
    </DeviceFrame>
  );
}

/**
 * B · Three tabs, and finding somebody is a button rather than a place.
 *
 * The bar drops to three, and the thing this product exists for gets a control
 * that is on every screen instead of a tab you have to be on. The cost is that
 * the button is always taking up the bottom of the screen.
 */
export function OptionB() {
  return (
    <DeviceFrame
      as="phone"
      nav
      tabs={[
        { key: "home", label: "Home", icon: Home },
        { key: "sessions", label: "Sessions", icon: CalendarDays },
        { key: "you", label: "You", icon: CircleUser },
      ]}
      activeTab="home"
    >
      <Screen>
        <Bar title="Good evening, Mariam" sub="One therapist can read your record" />
        <NextSession />

        <SectionLabel>Your steps</SectionLabel>
        <StepRow text="Wind down for twenty minutes before bed" when="Agreed last Tuesday" />
        <StepRow text="Write down what the evening was like" when="Agreed last Tuesday" />

        <SectionLabel>Between sessions</SectionLabel>
        <div className="mx-4 grid grid-cols-2 gap-2">
          {["Your journal", "Your summary"].map((one) => (
            <div
              key={one}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-medium text-slate-900"
            >
              {one}
            </div>
          ))}
        </div>

        <SectionLabel>Your record</SectionLabel>
        <RecordRow />

        <div className="flex-1" />
        {/*
          🔴 The whole option, in one element. It is above the tab bar rather
          than in it, so it is present on Sessions and You as well, and it is
          the only teal on the screen.
        */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
          <span className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-[14px] font-bold text-navy-600 shadow-sm">
            <Search className="h-4 w-4" aria-hidden />
            Find someone now
          </span>
          <p className="mt-1.5 text-center text-[10px] text-slate-500">
            3 clinicians free this minute
          </p>
        </div>
      </Screen>
    </DeviceFrame>
  );
}

/**
 * C · Two surfaces. Now, and You.
 *
 * The map is the screen rather than a tab on it, which is the most honest
 * reading of what this product is for and the least conventional of the three.
 * The cost is that everything that is not urgent has to fit behind one word.
 */
export function OptionC() {
  return (
    <DeviceFrame
      as="phone"
      nav
      tabs={[
        { key: "now", label: "Now", icon: Globe2 },
        { key: "you", label: "You", icon: CircleUser },
      ]}
      activeTab="now"
    >
      <div className="flex min-h-[30rem] flex-col bg-[#04101f]">
        <div className="px-4 pt-3 pb-2">
          <p className="text-[17px] font-bold tracking-tight text-white">Who is free now</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/80">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-400" />3 clinicians, verified
          </p>
        </div>

        <div className="overflow-hidden rounded-xl mx-4">
          <WorldRadar dots={DOTS} selectedId={null} scale={2.8} className="aspect-[2/1] w-full" />
        </div>

        <div className="mt-3 flex-1 rounded-t-3xl bg-slate-50 pt-3">
          {RADAR_DEMO.map((who) => (
            <div
              key={who.name}
              className="mx-4 mb-1.5 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                {who.name
                  .replace("Dr ", "")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-slate-900">
                  {who.name}
                </span>
                <span className="block truncate text-[11px] text-slate-600">{who.languages}</span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-[13px] font-bold tabular-nums text-slate-900">
                  ${String(Math.round(who.priceCents / 100))}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  {who.minutes} min
                </span>
              </span>
            </div>
          ))}

          {/*
            Everything that is not "now" gets one row, which is the option's
            whole bet: that a patient with a session tomorrow does not open the
            app to admire it.
          */}
          <div className="mx-4 mt-3 mb-4 flex items-center gap-2.5 rounded-xl bg-navy-500 px-3 py-2.5 text-white">
            <CalendarDays className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
            <span className="min-w-0 flex-1 text-[12px] font-medium">
              Dr Nour Demo, tomorrow 18:00
            </span>
            <ListChecks className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}

/* ──────────────────────────────────────────────────────── the layout ── */

export function SampleRow({
  option,
  name,
  bet,
  cost,
  children,
}: {
  option: "A" | "B" | "C";
  name: string;
  /** What this arrangement is wagering on, in one sentence. */
  bet: string;
  /** What it costs, because an option with no cost written down is a pitch. */
  cost: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0")}>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
        Option {option}
      </p>
      <h3 className="mt-1 text-xl font-bold tracking-tight text-navy-500">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{bet}</p>
      <p className="mt-2 border-s-2 border-slate-200 ps-3 text-sm leading-relaxed text-slate-600">
        {cost}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
