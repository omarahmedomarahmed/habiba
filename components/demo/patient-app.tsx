"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUser,
  Clock,
  Download,
  FileText,
  Globe2,
  Home,
  Lock,
  NotebookPen,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";

import { MotionRoot, soft } from "./motion";
import { Face, Glow } from "@/components/patient/kit";
import { iconFor } from "@/components/patient/category-grid";
import type { DemoContent } from "@/lib/content/demo";
import { formatDay, formatTime, formatWhen } from "@/lib/scheduling/tz";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { WorldRadar } from "@/components/radar/world-radar";
import {
  DEMO_AREAS,
  DEMO_PATIENT,
  DEMO_THERAPISTS,
  DEMO_ZONE,
  demoLanguages,
  demoName,
  demoSpecialty,
  MARIAM_JOURNAL,
  MARIAM_NEXT,
  MARIAM_STEPS,
  MARIAM_SUMMARY,
  MARIAM_VISITS,
  type DemoTherapist,
} from "@/lib/marketing/fixtures";
import { egp } from "@/lib/marketing/prices";
import { cn } from "@/lib/utils";

import { DeviceFrame } from "./device-frame";

/**
 * 🔴 THE PATIENT'S APP AS MARIAM HASSAN SEES IT WHEN SHE SIGNS IN (founder, 26 Sep).
 *
 * *"Make sure the mockups use the current updated layout of the app, make the whole
 * mockup clickable and look exactly the same as the actual app, with the seeded data
 * from the video."*
 *
 * So this is `app/(patient)/patient/*` redrawn at phone size with the same Tailwind
 * classes, scaled down by about a fifth because the phone is 300px wide: the navy hero
 * card on Home, the white cards on the navy-50 ground, the dark floating dock with the
 * raised teal globe (`components/patient/bottom-nav.tsx`), and the SOS orb. The real
 * pure pieces are imported rather than copied: `Face` and `Glow` from the patient kit,
 * the category icons, and the radar's own `WorldRadar`.
 *
 * ## Every tab works, and so does every row that opens something
 *
 * Home, Sessions, the globe, Therapists and You are buttons. On Home, the step card
 * opens her steps, a therapist opens their page, and the rows at the foot open her
 * journal, her summary, who can read her history and her copy. On Therapists the areas
 * filter the list. On a therapist's page an hour can be picked and booked, and the
 * booking appears on Sessions, covered by her employer as hers are.
 *
 * ## 🔴 It books nothing, and cannot
 *
 * Fixtures and local state. No action, no route, no fetch (`verify:sprint77` reads the
 * imports). Nobody on it is shown as online: the radar says nobody is free this
 * minute, which is what the seeded database says ninety seconds after the seed.
 */

type Tab = "home" | "sessions" | "radar" | "therapists" | "you";

/** The screens that are not tabs: rows on Home and You in the real app. */
type Screen = "steps" | "journal" | "summary" | "access" | "record" | "therapist";

const TABS: { key: Tab; label: MessageKey; icon: typeof Globe2; lifted?: boolean }[] = [
  { key: "home", label: "tab.home", icon: Home },
  { key: "sessions", label: "tab.sessions", icon: CalendarDays },
  { key: "radar", label: "tab.radar", icon: Globe2, lifted: true },
  { key: "therapists", label: "tab.therapists", icon: Users },
  { key: "you", label: "tab.you", icon: CircleUser },
];

/** The heading each screen carries, as the real page titles it. */
const SCREEN_TITLE: Record<Exclude<Screen, "therapist">, MessageKey> = {
  steps: "homework.title",
  journal: "home.journal",
  summary: "home.summary",
  access: "home.whoCanRead",
  record: "precord.title",
};

const TAB_TITLE: Partial<Record<Tab, MessageKey>> = {
  sessions: "psessions.title",
  therapists: "browse.title",
};

/** A booking made on this phone: which therapist, which hour. */
type Booked = { therapist: string; at: string } | null;

function useMoney() {
  const locale = useLocale();
  return (pounds: number) => egp(pounds * 100, locale);
}

/** `Sunday 27 September, 16:00 (Cairo)`, as the session list writes it. */
function useWhen() {
  const locale = useLocale();
  return (iso: string) => formatWhen(new Date(iso), { name: DEMO_ZONE, source: "reader" }, locale);
}

export function PatientApp({
  initial = "home",
  open = null,
  className,
}: {
  /** Kept for the showcase's call shape; this phone carries its own story. */
  content?: DemoContent;
  initial?: Tab;
  /** Open on a screen that hangs off Home rather than on a tab. */
  open?: Screen | null;
  className?: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(open ? (open === "access" ? "you" : "home") : initial);
  const [screen, setScreen] = useState<Screen | null>(open);
  const [who, setWho] = useState<string>(DEMO_THERAPISTS[0]!.name);
  const [booked, setBooked] = useState<Booked>(null);
  /* Whether the reader has moved yet: the first screen does not animate in. */
  const [moved, setMoved] = useState(false);

  function go(next: Tab) {
    setMoved(true);
    setScreen(null);
    setTab(next);
  }

  function openTherapist(name: string) {
    setMoved(true);
    setWho(name);
    setScreen("therapist");
  }

  function openScreen(next: Screen | null) {
    setMoved(true);
    setScreen(next);
  }

  const view = screen ?? tab;
  const title =
    screen && screen !== "therapist" ? t(SCREEN_TITLE[screen]) : !screen && TAB_TITLE[tab] ? t(TAB_TITLE[tab]!) : null;

  return (
    <MotionRoot>
      <DeviceFrame
        as="phone"
        className={className}
        sos={t("crisis.orbLabel")}
        bodyClassName={view === "radar" ? "bg-[#04101f]" : undefined}
        tabs={TABS.map(({ key, label, icon, lifted }) => ({ key, label: t(label), icon, lifted }))}
        activeTab={tab}
        onTab={(key) => {
          go(key as Tab);
        }}
      >
        {/*
          🔴 The first screen is drawn by the server and shown as it is: an
          entry animation from opacity 0 would leave the phone blank until the
          page's script has run. Only a screen the reader opens slides in.
        */}
        <motion.div
          key={`${view}-${who}`}
          initial={moved ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={soft}
          className={cn("flex flex-col gap-3 px-3 pb-3", view === "radar" && "px-0")}
        >
          {/*
            The back link and the page's own heading, as `PatientBack` and the
            h1 draw them. Sessions and Therapists carry the back link too, as
            their pages do, and it shares its row with the SOS orb.
          */}
          {screen || TAB_TITLE[tab] ? (
            <button
              type="button"
              onClick={() => {
                if (screen) openScreen(null);
                else go("home");
              }}
              className="tap-target -ms-1 flex min-h-10 w-fit items-center gap-1 rounded-full pe-2 text-[12px] font-semibold text-navy-500 outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              {t("common.back")}
            </button>
          ) : null}
          {title ? <ScreenTitle>{title}</ScreenTitle> : null}

          {screen === "steps" ? <Steps /> : null}
          {screen === "journal" ? <Journal /> : null}
          {screen === "summary" ? <Summary /> : null}
          {screen === "access" ? <Access /> : null}
          {screen === "record" ? <RecordCopy /> : null}
          {screen === "therapist" ? (
            <TherapistPage
              name={who}
              booked={booked}
              onBook={(at) => {
                setBooked({ therapist: who, at });
              }}
              onSeeSessions={() => {
                go("sessions");
              }}
            />
          ) : null}

          {screen === null && tab === "home" ? (
            <HomeTab
              booked={booked}
              onScreen={openScreen}
              onTherapist={openTherapist}
              onTab={go}
            />
          ) : null}
          {screen === null && tab === "sessions" ? <SessionsTab booked={booked} onTherapist={openTherapist} /> : null}
          {screen === null && tab === "radar" ? <RadarTab onTherapist={openTherapist} /> : null}
          {screen === null && tab === "therapists" ? <TherapistsTab onTherapist={openTherapist} /> : null}
          {screen === null && tab === "you" ? <YouTab booked={booked} onScreen={openScreen} onTab={go} /> : null}
        </motion.div>
      </DeviceFrame>
    </MotionRoot>
  );
}

/* -------------------------------------------------------------- the parts -- */

/** The page heading: `text-[26px]` in the app, at phone scale. */
function ScreenTitle({ children }: { children: React.ReactNode }) {
  return <p className="truncate text-[20px] leading-tight font-bold tracking-tight text-navy-700">{children}</p>;
}

/** `Panel` from the patient kit, at phone scale. */
function Panel({
  children,
  className,
  tone = "plain",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "brand" | "dark";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl p-3.5",
        tone === "plain" &&
          "border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]",
        tone === "brand" && "border border-brand-200 bg-brand-50",
        tone === "dark" && "relative overflow-hidden bg-navy-900 text-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** `SectionHead`: a bold title and, when there is one, a link to all of it. */
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[14px] font-bold text-navy-700">{title}</p>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="shrink-0 text-[12px] font-semibold text-brand-700">
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** `RowLink`: an icon tile, a label, a chevron. */
function RowButton({ icon: Icon, label, onClick }: { icon: typeof NotebookPen; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target flex w-full items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-start ring-1 ring-navy-100 transition-colors outline-none hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-navy-700">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
    </button>
  );
}

const primary =
  "tap-target inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-brand-500 px-4 text-[12.5px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] outline-none hover:bg-brand-400 focus-visible:ring-2 focus-visible:ring-navy-700";
const ghost =
  "tap-target inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-navy-200 bg-white px-4 text-[12.5px] font-semibold text-navy-600 outline-none hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-brand-400";

function therapistNamed(name: string): DemoTherapist {
  return DEMO_THERAPISTS.find((x) => x.name === name) ?? DEMO_THERAPISTS[0]!;
}

/** `TherapistCard` from the patient app: face, name, headline, the score when there is one. */
function TherapistCard({ who, onClick }: { who: DemoTherapist; onClick: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target flex w-full items-start gap-2.5 rounded-3xl bg-white p-3 text-start ring-1 ring-navy-100 transition-transform outline-none active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <Face name={who.name} size={42} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-navy-700">{demoName(who.name, locale)}</span>
          <span className="shrink-0 rounded-full bg-navy-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-navy-500">
            {t("radar.demoAccount")}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-navy-400">
          {who.headline[locale]}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-navy-500">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
          {t("common.ratingFrom", { average: who.rating.average, count: who.rating.count })}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ home -- */

function HomeTab({
  booked,
  onScreen,
  onTherapist,
  onTab,
}: {
  booked: Booked;
  onScreen: (screen: Screen) => void;
  onTherapist: (name: string) => void;
  onTab: (tab: Tab) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const top = [...DEMO_THERAPISTS]
    .sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count)
    .slice(0, 3);

  return (
    <>
      {/* The hero: who you are, and the one thing to do, on the night-navy ground. */}
      <section className="relative overflow-hidden rounded-[26px] bg-navy-900 px-4 pt-12 pb-4 text-white">
        <Glow className="-end-24 -top-24 h-60 w-60" />
        <div className="relative flex items-center gap-2.5">
          <button type="button" onClick={() => onTab("you")} aria-label={t("home.yourAccount")} className="rounded-full">
            <Face name={DEMO_PATIENT.full} size={40} ring />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-tight">
              {t("home.greeting", { name: DEMO_PATIENT.first[locale] })}
            </p>
            <p className="truncate text-[11.5px] text-white/65">{t("home.recordYours")}</p>
          </div>
        </div>
        {/*
          Nobody is online in the seeded database a minute after the seed, so the
          card is the one the app draws at zero: book somebody instead.
        */}
        <button
          type="button"
          onClick={() => onTab("therapists")}
          className="tap-target relative mt-3.5 flex w-full items-center gap-2.5 rounded-3xl bg-white/[0.07] p-3 text-start ring-1 ring-white/12 transition-colors hover:bg-white/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Globe2 className="h-4 w-4 text-white/80" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">{t("home.liveNone")}</span>
            <span className="block text-[11.5px] text-white/70">{t("home.liveNoneBody")}</span>
          </span>
        </button>
      </section>

      <button
        type="button"
        onClick={() => onTab("therapists")}
        className="tap-target flex h-10 w-full items-center gap-2 rounded-2xl bg-white px-3 text-start text-[12px] text-navy-400 ring-1 ring-navy-100"
      >
        <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{t("home.searchPlaceholder")}</span>
      </button>

      {/* One step, on the dark card, with the way to the rest. */}
      <Panel tone="dark">
        <Glow className="-end-16 -top-16 h-40 w-40" />
        <div className="relative">
          <p className="text-[10.5px] font-semibold tracking-wide text-brand-300 uppercase rtl:tracking-normal">
            {t("home.beforeNext")}
          </p>
          <p className="mt-1 text-[14px] leading-snug font-bold">{MARIAM_STEPS[0]![locale]}</p>
          <button
            type="button"
            onClick={() => onScreen("steps")}
            className="tap-target mt-2.5 inline-flex h-8 items-center rounded-xl bg-white/10 px-3 text-[11.5px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
          >
            {t("home.openAndMore", { count: MARIAM_STEPS.length - 1 })}
          </button>
        </div>
      </Panel>

      <section className="space-y-2">
        <SectionHead title={t("home.exploreTitle")} action={t("home.exploreAll")} onAction={() => onTab("therapists")} />
        <ul className="no-scrollbar -mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-1">
          {DEMO_THERAPISTS.map((who) => (
            <li key={who.name} className="w-[132px] shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onTherapist(who.name)}
                className="tap-target flex h-full w-full flex-col gap-2 rounded-3xl bg-white p-3 text-start shadow-[0_10px_30px_-18px_rgba(10,35,66,0.35)] ring-1 ring-navy-100 transition-transform outline-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <Face name={who.name} size={38} />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] leading-snug font-bold text-navy-700">
                    {demoName(who.name, locale)}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-snug text-navy-400">
                    {demoSpecialty(who.specialties[0]!, locale)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionHead title={t("home.areas")} />
        <ul className="grid grid-cols-2 gap-2">
          {DEMO_AREAS.slice(0, 4).map((area) => (
            <li key={area.code}>
              <button
                type="button"
                onClick={() => onTab("therapists")}
                className="tap-target flex h-full w-full flex-col items-start gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-start transition-colors hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  {iconFor(area.code)}
                </span>
                <span className="text-[12px] font-medium text-slate-900">{demoSpecialty(area.code, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div>
          <p className="flex items-center gap-1.5 text-[14px] font-bold text-navy-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {t("home.ratedHighest")}
          </p>
          <p className="mt-0.5 text-[11px] text-navy-400">{t("home.ratedSome", { count: 5, bar: 5 })}</p>
        </div>
        {top.map((who) => (
          <TherapistCard key={who.name} who={who} onClick={() => onTherapist(who.name)} />
        ))}
      </section>

      <SessionList booked={booked} only="upcoming" onTherapist={onTherapist} />
      <button type="button" onClick={() => onTab("sessions")} className={cn(ghost, "w-full")}>
        <CalendarDays className="h-4 w-4" aria-hidden />
        {t("psessions.title")}
      </button>

      <Panel>
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy-600 text-white">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-navy-700">{t("home.yourRecord")}</p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                {t("home.yours")}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-navy-500">{t("home.filesAttached", { count: 1 })}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-2">
        <RowButton icon={NotebookPen} label={t("home.journal")} onClick={() => onScreen("journal")} />
        <RowButton icon={FileText} label={t("home.summary")} onClick={() => onScreen("summary")} />
        <RowButton icon={ShieldCheck} label={t("home.whoCanRead")} onClick={() => onScreen("access")} />
        <RowButton icon={Download} label={t("home.getCopy")} onClick={() => onScreen("record")} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------- sessions -- */

/**
 * `PatientSessionList`: grouped, each card with its therapist and credentials, the
 * time in her zone, "Covered by your benefit" where the price would be, the brief her
 * therapist signed, and the way back to the same person.
 */
function SessionList({
  booked,
  only = "all",
  onTherapist,
}: {
  booked: Booked;
  only?: "all" | "upcoming" | "past";
  onTherapist: (name: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const when = useWhen();

  const upcoming = [MARIAM_NEXT, ...(booked ? [booked] : [])];
  const groups: { title: MessageKey; blurb: MessageKey; rows: { at: string; therapist: string; brief?: string }[]; past: boolean }[] = [
    ...(only !== "past"
      ? [{ title: "psessions.booked" as MessageKey, blurb: "psessions.bookedBlurb" as MessageKey, rows: upcoming, past: false }]
      : []),
    ...(only !== "upcoming"
      ? [
          {
            title: "psessions.pastBooked" as MessageKey,
            blurb: "psessions.pastBookedBlurb" as MessageKey,
            rows: MARIAM_VISITS.map((v) => ({ at: v.at, therapist: v.therapist, brief: v.brief[locale] })),
            past: true,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.title}>
          <p className="text-[14px] font-bold text-navy-700">{t(group.title)}</p>
          <p className="mt-0.5 text-[11px] text-navy-400">{t(group.blurb)}</p>
          <ul className="mt-2 space-y-2">
            {group.rows.map((row) => {
              const who = therapistNamed(row.therapist);
              return (
                <li key={`${row.at}${row.therapist}`}>
                  <div className="rounded-3xl border border-navy-100/80 bg-white p-3 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]">
                    <p className="text-[12.5px] leading-snug font-bold text-navy-700">
                      <CalendarClock className="me-1.5 inline h-3.5 w-3.5 align-[-2px] text-navy-400" aria-hidden />
                      {demoName(row.therapist, locale)}
                      <span className="font-normal text-navy-400">, {demoName(who.credentials, locale)}</span>
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-navy-400">
                      {when(row.at)} · {t("psessions.coveredByBenefit")}
                    </p>
                    {row.brief ? (
                      <p className="mt-2 rounded-2xl bg-navy-50 p-2.5 text-[11.5px] leading-relaxed text-navy-600">
                        {row.brief}
                      </p>
                    ) : null}
                    {group.past ? (
                      <button
                        type="button"
                        onClick={() => onTherapist(row.therapist)}
                        className="tap-target mt-1.5 inline-flex h-8 items-center text-[11.5px] font-semibold text-brand-700"
                      >
                        {t("psessions.bookAgain")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SessionsTab({ booked, onTherapist }: { booked: Booked; onTherapist: (name: string) => void }) {
  const t = useT();
  const [which, setWhich] = useState<"all" | "upcoming" | "past">("all");
  return (
    <>
      <div role="tablist" aria-label={t("psessions.which")} className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-navy-100">
        {(["all", "upcoming", "past"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={which === key}
            onClick={() => setWhich(key)}
            className={cn(
              "tap-target flex-1 rounded-full py-1.5 text-center text-[11.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              which === key ? "bg-navy-600 text-white shadow-sm" : "text-navy-500 hover:text-navy-700",
            )}
          >
            {t(`psessions.${key}` as MessageKey)}
          </button>
        ))}
      </div>
      <SessionList booked={booked} only={which} onTherapist={onTherapist} />
    </>
  );
}

/* ----------------------------------------------------------------- radar -- */

/**
 * The radar, on its own dark ground as `/patient/radar` paints it. The map is the
 * console's own `WorldRadar`; nobody on it is free this minute, which is what the
 * seeded database says, so the list under it offers each person's page instead.
 */
function RadarTab({ onTherapist }: { onTherapist: (name: string) => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="space-y-3 px-3 text-white">
      <div className="overflow-hidden rounded-3xl bg-white/[0.04] p-2 ring-1 ring-white/10">
        {/* No dots: nobody is free this minute, and a dot is the claim that somebody is. */}
        <WorldRadar
          dots={[]}
          selectedId={null}
          onSelect={() => undefined}
          scale={2.8}
          className="aspect-[2/1] w-full"
        />
      </div>
      <div className="rounded-3xl bg-white/[0.06] p-3.5 ring-1 ring-white/10">
        <p className="text-[14px] font-bold">{t("radar.nobody")}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/70">{t("home.liveNoneBody")}</p>
      </div>
      <ul className="space-y-2">
        {DEMO_THERAPISTS.slice(0, 4).map((who) => (
          <li key={who.name}>
            <button
              type="button"
              onClick={() => onTherapist(who.name)}
              className="tap-target flex w-full items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 text-start ring-1 ring-white/10 transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Face name={who.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold">{demoName(who.name, locale)}</span>
                <span className="block truncate text-[10.5px] text-white/65">{demoLanguages(who.languages, locale)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/50 rtl:rotate-180" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ therapists -- */

/** `/patient/browse`: the search, the areas with their counts, and whoever matches. */
function TherapistsTab({ onTherapist }: { onTherapist: (name: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const [area, setArea] = useState<string | null>(null);
  const shown = area ? DEMO_THERAPISTS.filter((who) => who.specialties.includes(area)) : [];

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-navy-400" aria-hidden />
        <p className="w-full rounded-2xl border border-navy-100 bg-white py-2.5 ps-8 pe-3 text-[12px] text-navy-700">
          {area ? demoSpecialty(area, locale) : <span className="text-navy-400">{t("browse.placeholder")}</span>}
        </p>
      </div>

      {shown.length > 0 ? (
        <ul className="space-y-2">
          {shown.map((who) => (
            <li key={who.name}>
              <TherapistCard who={who} onClick={() => onTherapist(who.name)} />
            </li>
          ))}
        </ul>
      ) : null}

      <section>
        <p className="text-[14px] font-bold text-navy-700">{t("browse.areas")}</p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-navy-400">{t("browse.areasBody")}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {DEMO_AREAS.map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                aria-pressed={area === entry.code}
                onClick={() => setArea(area === entry.code ? null : entry.code)}
                className={cn(
                  "tap-target flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  area === entry.code
                    ? "border-navy-600 bg-navy-600 text-white"
                    : "border-navy-100 bg-white text-navy-600",
                )}
              >
                {demoSpecialty(entry.code, locale)}
                <span className={cn("text-[10px]", area === entry.code ? "text-white/75" : "text-navy-400")}>
                  {entry.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * A therapist's page: who they are, the licence line, the price, and the hours they
 * published. Pick one and book it; hers are covered by Cairo Foundry, as every one of
 * her sessions is.
 */
function TherapistPage({
  name,
  booked,
  onBook,
  onSeeSessions,
}: {
  name: string;
  booked: Booked;
  onBook: (at: string) => void;
  onSeeSessions: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const who = therapistNamed(name);
  const [slot, setSlot] = useState<string | null>(null);
  /* Three open hours on the next two working days, 14:00 onward Cairo time, as the seed opens them. */
  const hours = ["2026-09-28T12:00:00Z", "2026-09-28T14:00:00Z", "2026-09-29T11:00:00Z", "2026-09-29T13:00:00Z"];
  const mine = booked && booked.therapist === name ? booked : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <Face name={who.name} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold tracking-tight text-navy-700">{demoName(who.name, locale)}</p>
          <p className="truncate text-[11.5px] text-navy-400">
            {demoName(who.credentials, locale)} · {demoName(who.city, locale)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-navy-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
            {t("common.ratingFrom", { average: who.rating.average, count: who.rating.count })}
          </p>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-navy-600">{who.headline[locale]}</p>
      <ul className="flex flex-wrap gap-1.5">
        {who.specialties.map((s) => (
          <li key={s} className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold text-navy-600 ring-1 ring-navy-100">
            {demoSpecialty(s, locale)}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
        {t("radar.verifiedMeans")}
      </p>
      <p className="text-[12px] text-slate-600">
        {t("radar.oneHour")} <span className="font-semibold text-slate-900">{money(who.egp)}</span>
      </p>

      {mine ? (
        <Panel>
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-900">
            <Check className="h-4 w-4 text-brand-500" aria-hidden />
            {t("pbook.bookedWith", { name: demoName(who.name, locale) })}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-700">
            {formatWhen(new Date(mine.at), { name: DEMO_ZONE, source: "reader" }, locale)}
          </p>
          <p className="mt-2 rounded-xl bg-brand-50 px-2.5 py-1.5 text-[11.5px] font-medium text-brand-900">
            {t("pbilling.coveredBody")}
          </p>
          <button type="button" onClick={onSeeSessions} className={cn(primary, "mt-3 w-full")}>
            {t("pat.seeIt")}
          </button>
        </Panel>
      ) : (
        <Panel>
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-slate-600" aria-hidden />
            {t("pbook.bookSession")}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">{t("psessions.coveredByBenefit")}</p>
          <div className="mt-2.5 space-y-2.5">
            {[hours.slice(0, 2), hours.slice(2)].map((day) => (
              <div key={day[0]}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase rtl:tracking-normal">
                  {formatDay(new Date(day[0]!), DEMO_ZONE, locale)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {day.map((at) => (
                    <button
                      key={at}
                      type="button"
                      aria-pressed={slot === at}
                      onClick={() => setSlot(at)}
                      className={cn(
                        "tap-target flex h-8 items-center gap-1 rounded-lg border px-2 text-[11.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                        slot === at
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-700 hover:border-slate-900 hover:bg-slate-50",
                      )}
                    >
                      <Clock className="h-3 w-3" aria-hidden />
                      <span dir="ltr">{formatTime(new Date(at), DEMO_ZONE)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={slot === null}
            onClick={() => slot && onBook(slot)}
            className="tap-target mt-3 h-9 w-full rounded-xl bg-slate-900 px-3 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {t("common.confirm")}
          </button>
        </Panel>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- you -- */

/** `/patient/account`: her initials, her employer's benefit, and what is next. */
function YouTab({ booked, onScreen, onTab }: { booked: Booked; onScreen: (s: Screen) => void; onTab: (tab: Tab) => void }) {
  const t = useT();
  const locale = useLocale();
  const next = booked ? [MARIAM_NEXT, booked] : [MARIAM_NEXT];
  return (
    <>
      <section className="relative overflow-hidden rounded-[26px] bg-navy-900 px-4 pt-12 pb-4 text-white">
        <Glow className="-end-24 -top-24 h-60 w-60" />
        <div className="relative flex items-center gap-3">
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center rounded-full bg-brand-500 text-[17px] font-bold text-navy-700 ring-4 ring-white/10"
            style={{ width: 52, height: 52 }}
          >
            MH
          </span>
          <div className="min-w-0">
            <p className="truncate text-[19px] font-bold tracking-tight">{demoName(DEMO_PATIENT.full, locale)}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/15">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              {t("pyou.benefitBadge", { name: DEMO_PATIENT.employer })}
            </span>
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]">
        <p className="px-3.5 pt-3 pb-1.5 text-[12px] font-semibold text-navy-700">{t("psessions.upcoming")}</p>
        {next.map((row) => (
          <div key={row.at} className="flex items-center justify-between gap-2 border-t border-navy-100 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-navy-700">{demoName(row.therapist, locale)}</p>
              <p className="text-[10.5px] text-navy-400">{formatDay(new Date(row.at), DEMO_ZONE, locale)}</p>
            </div>
            <button
              type="button"
              onClick={() => onTab("sessions")}
              className="shrink-0 rounded-xl bg-navy-900 px-2.5 py-1 text-[10.5px] font-semibold text-white"
            >
              {t("pyou.open")}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-navy-100/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-semibold text-navy-700">{t("pyou.summary")}</p>
          <button type="button" onClick={() => onScreen("summary")} className="text-[10.5px] font-semibold text-navy-700 underline">
            {t("pyou.readAll")}
          </button>
        </div>
        <p className="mt-1.5 line-clamp-4 text-[11.5px] leading-relaxed text-navy-600">{MARIAM_SUMMARY.body[locale]}</p>
      </div>

      <RowButton icon={ShieldCheck} label={t("home.whoCanRead")} onClick={() => onScreen("access")} />
      <RowButton icon={Download} label={t("home.getCopy")} onClick={() => onScreen("record")} />
    </>
  );
}

/* ------------------------------------------------------- the other screens -- */

function Steps() {
  const t = useT();
  const locale = useLocale();
  const [done, setDone] = useState<number[]>([]);
  return (
    <>
      <p className="-mt-1 text-[12px] leading-relaxed text-navy-400">{t("homework.body")}</p>
      {MARIAM_STEPS.map((step, i) => {
        const ticked = done.includes(i);
        return (
          <button
            key={step.en}
            type="button"
            aria-pressed={ticked}
            onClick={() => setDone((prev) => (ticked ? prev.filter((x) => x !== i) : [...prev, i]))}
            className="tap-target block w-full text-start"
          >
            <Panel className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg ring-2 transition-colors",
                  ticked ? "bg-brand-500 text-navy-700 ring-brand-500" : "bg-white ring-navy-200",
                )}
              >
                {ticked ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              </span>
              <span className={cn("text-[12.5px] leading-snug font-bold text-navy-700", ticked && "line-through decoration-navy-300")}>
                {step[locale]}
              </span>
            </Panel>
          </button>
        );
      })}
    </>
  );
}

function Journal() {
  const locale = useLocale();
  return (
    <>
      {MARIAM_JOURNAL.map((entry) => (
        <Panel key={entry.on}>
          <p className="text-[10.5px] font-semibold text-brand-700">{formatDay(new Date(entry.on), DEMO_ZONE, locale)}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-navy-600">{entry.text[locale]}</p>
        </Panel>
      ))}
    </>
  );
}

function Summary() {
  const t = useT();
  const locale = useLocale();
  return (
    <Panel>
      <div className="flex items-center gap-2.5">
        <Face name={MARIAM_SUMMARY.author} size={32} />
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-bold text-navy-700">
            {demoName(MARIAM_SUMMARY.author, locale)}
            <span className="font-normal text-navy-400">, {demoName(MARIAM_SUMMARY.credentials, locale)}</span>
          </p>
          <p className="truncate text-[10.5px] text-navy-400">
            {t("pat.version", { n: MARIAM_SUMMARY.version })} · {formatDay(new Date(MARIAM_SUMMARY.on), DEMO_ZONE, locale)}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-navy-600">{MARIAM_SUMMARY.body[locale]}</p>
    </Panel>
  );
}

/** Who can read her history: Dr Karim, until she changes her mind, and the button that stops it. */
function Access() {
  const t = useT();
  const locale = useLocale();
  const [step, setStep] = useState<"open" | "asking" | "stopped">("open");
  const name = demoName("Dr Karim Nabil", locale);
  return (
    <>
      <Panel>
        <p className="text-[10px] font-bold tracking-wider text-navy-400 uppercase rtl:tracking-normal">
          {t("consent.whoHasAccess")}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Face name="Dr Karim Nabil" size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-bold text-navy-700">{name}</span>
              <span className="block truncate text-[10.5px] text-navy-400">
                {step === "stopped" ? t("consent.cannotRead") : t("consent.untilChange")}
              </span>
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
              step === "stopped" ? "bg-navy-50 text-navy-500" : "bg-brand-50 text-brand-800",
            )}
          >
            {step === "stopped" ? t("consent.cannotRead") : t("consent.canRead")}
          </span>
        </div>
        {step === "open" ? (
          <button
            type="button"
            onClick={() => setStep("asking")}
            className="tap-target mt-2.5 block w-full rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-700 ring-1 ring-red-200"
          >
            {t("consent.stop")}
          </button>
        ) : null}
        {step === "asking" ? (
          <div className="mt-2.5 rounded-xl bg-red-50 p-2.5 ring-1 ring-red-200">
            <p className="text-[11.5px] leading-relaxed text-red-900">{t("consent.stopConfirm", { name })}</p>
            <button
              type="button"
              onClick={() => setStep("stopped")}
              className="tap-target mt-2 block w-full rounded-xl bg-red-600 px-3 py-2 text-center text-[12px] font-semibold text-white"
            >
              {t("consent.stopYes")}
            </button>
          </div>
        ) : null}
      </Panel>
      {/* What a therapist she allows may and may never do, as `/patient/consent` draws it with `SeesWhat`. */}
      <Panel>
        <p className="text-[12px] font-bold text-navy-700">{t("consent.whoTherapist")}</p>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-snug text-navy-600">
          {(["consent.mayRead", "consent.mayKeep"] as const).map((key) => (
            <li key={key} className="flex items-start gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
              {t(key)}
            </li>
          ))}
          {(["consent.neverBefore", "consent.neverAfter", "consent.neverWhy"] as const).map((key) => (
            <li key={key} className="flex items-start gap-1.5">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function RecordCopy() {
  const t = useT();
  return (
    <>
      <p className="-mt-1 text-[12px] leading-relaxed text-navy-400">{t("precord.body")}</p>
      <Panel>
        <p className="text-[13px] font-bold text-navy-700">{t("precord.copyTitle")}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-navy-500">{t("precord.copyBody")}</p>
        <span className={cn(primary, "mt-3 w-full")}>
          <Download className="h-3.5 w-3.5" aria-hidden />
          {t("precord.send", { email: "mariam.hassan@example.com" })}
        </span>
      </Panel>
    </>
  );
}
