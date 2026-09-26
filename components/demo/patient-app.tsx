"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUser,
  Clock,
  Download,
  FileText,
  Globe2,
  Home,
  ListChecks,
  NotebookPen,
  Receipt,
  Search,
  ShieldCheck,
  Star,
  Users,
  Video,
} from "lucide-react";

import { MotionRoot, soft } from "./motion";
import { Avatar, Glow } from "@/components/clinician/kit";
import type { DemoContent } from "@/lib/content/demo";
import { formatDay } from "@/lib/scheduling/tz";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { WorldRadar } from "@/components/radar/world-radar";
import { DEMO_PATIENT_NAME, demoLanguages, demoName, PATIENT_BILLS, RADAR_DEMO } from "@/lib/marketing/fixtures";
import { DEMO_SESSION_EGP, egp } from "@/lib/marketing/prices";
import { cn } from "@/lib/utils";

import { DeviceFrame } from "./device-frame";

/**
 * 🔴 76.81 — THE PATIENT'S APP, AS A PHONE SOMEBODY CAN ACTUALLY USE, and now in
 * the redesign's clothes: the navy header card on home, rounded white cards on
 * the navy-50 ground, the floating bar with the lifted globe, and the SOS orb
 * floating above it, as `app/(patient)/patient/page.tsx` draws them.
 *
 * ## So the whole app is here, and the radar tab books a session
 *
 * Five tabs, each with its name at the top and its own screen, and the tab you
 * are on is lit in the bar exactly as it is in `components/patient/bottom-nav.tsx`.
 * The radar tab walks the real sequence: pick somebody, see the price (with VAT
 * only when the product's rule charges it), go in. When it completes, the
 * booked session appears on the Sessions tab.
 *
 * ## 🔴 It books nothing, and cannot, and it says nobody is free
 *
 * Fixtures and local state. No action, no route, no fetch. The clinicians are
 * invented, and nothing on this phone claims any of them is online now: the
 * page under it says it is an example screen, and a pulse beside an invented
 * name would be the one claim on it that is false. The price is the product's
 * own benchmark session in pounds (`lib/marketing/prices.ts`).
 */

type Tab = "home" | "sessions" | "radar" | "therapists" | "you";

/**
 * The screens that are not tabs. In the real app these are rows on the home
 * screen rather than destinations in the bar.
 */
type Screen = "journal" | "summary" | "record" | "steps" | "billing";

const TABS: { key: Tab; label: MessageKey; icon: typeof Globe2; lifted?: boolean }[] = [
  { key: "home", label: "tab.home", icon: Home },
  { key: "sessions", label: "tab.sessions", icon: CalendarDays },
  { key: "radar", label: "tab.radar", icon: Globe2, lifted: true },
  { key: "therapists", label: "tab.therapists", icon: Users },
  { key: "you", label: "tab.you", icon: CircleUser },
];

/** The heading each screen carries, as the real app titles it. */
const SCREEN_TITLE: Record<Screen, MessageKey> = {
  journal: "home.journal",
  summary: "home.summary",
  record: "precord.title",
  steps: "tab.steps",
  billing: "tab.billing",
};

/** The pounds on this phone, formatted for the page's language. */
function useMoney() {
  const locale = useLocale();
  return (minor: number) => egp(minor, locale);
}

export function PatientApp({
  content,
  initial = "radar",
  open = null,
  className,
}: {
  content?: DemoContent;
  initial?: Tab;
  /** Open on a screen that hangs off Home rather than on a tab. */
  open?: Screen | null;
  className?: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(open ? "home" : initial);
  const [screen, setScreen] = useState<Screen | null>(open);
  const [picked, setPicked] = useState<number | null>(null);
  const [booked, setBooked] = useState<number | null>(null);

  const title = screen
    ? t(SCREEN_TITLE[screen])
    : t(TABS.find((x) => x.key === tab)?.label ?? "tab.sessions");

  function go(next: Tab) {
    setScreen(null);
    setTab(next);
  }

  const view = screen ?? tab;

  return (
    <MotionRoot>
      <DeviceFrame
        as="phone"
        className={className}
        sos={t("crisis.orbLabel")}
        tabs={TABS.map(({ key, label, icon, lifted }) => ({
          key,
          label: t(label),
          icon,
          lifted,
        }))}
        activeTab={screen ? "home" : tab}
        onTab={(key) => { go(key as Tab); }}
      >
        {/*
          🔴 THE SCREEN'S NAME, at the top, where the real app puts it. Home is
          the one screen that opens on its navy card instead, as it does in
          the app, and every other one is titled.
        */}
        {screen === null && tab === "home" ? null : (
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy-50/90 px-4 pt-1 pb-2.5 backdrop-blur">
            {screen ? (
              <button
                type="button"
                onClick={() => { setScreen(null); }}
                aria-label={t("common.back")}
                className="-ms-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-navy-600 ring-1 ring-navy-100"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </button>
            ) : null}
            <p className="min-w-0 truncate text-[15px] font-bold text-navy-700">{title}</p>
          </div>
        )}

        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={soft}
          className="px-3 pb-3"
        >
          {screen === "journal" ? <Journal content={content} /> : null}
          {screen === "summary" ? <Summary content={content} /> : null}
          {screen === "record" ? <RecordCopy /> : null}
          {screen === "steps" ? <Steps content={content} /> : null}
          {screen === "billing" ? <Billing /> : null}

          {screen === null ? (
            <>
              {tab === "home" ? (
                <HomeTab
                  content={content}
                  booked={booked}
                  onScreen={setScreen}
                  onFindSomeone={() => { go("radar"); }}
                  onBrowse={() => { go("therapists"); }}
                  onSeeSessions={() => { go("sessions"); }}
                />
              ) : null}
              {tab === "sessions" ? (
                <Sessions
                  content={content}
                  booked={booked}
                  onScreen={setScreen}
                  onWhoCanRead={() => { go("you"); }}
                />
              ) : null}
              {tab === "radar" ? (
                <Radar
                  picked={picked}
                  booked={booked}
                  sessionVatBps={content?.sessionVatBps ?? 0}
                  onPick={setPicked}
                  onBook={(i) => { setBooked(i); setPicked(null); }}
                  onSeeSessions={() => { go("sessions"); }}
                />
              ) : null}
              {tab === "therapists" ? (
                <Therapists onFindSomeone={() => { go("radar"); }} />
              ) : null}
              {tab === "you" ? (
                <You content={content} onScreen={setScreen} />
              ) : null}
            </>
          ) : null}
        </motion.div>
      </DeviceFrame>
    </MotionRoot>
  );
}

/* -------------------------------------------------------------- the parts -- */

/** The redesign's card: white, rounded, a hairline and a soft shadow. */
function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-navy-100/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A row that opens a screen: the icon on its tile, the name, the chevron. */
function Tile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof NotebookPen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target flex w-full items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-start text-[13px] font-semibold text-navy-700 ring-1 ring-navy-100 transition-colors hover:bg-navy-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-navy-400 rtl:rotate-180" aria-hidden />
    </button>
  );
}

/**
 * The invented clinicians in the reader's language: on /ar "Dr Nour Demo" is
 * written as an Arabic name and her languages as Arabic words.
 */
function useDemoCast(): typeof RADAR_DEMO {
  const locale = useLocale();
  return RADAR_DEMO.map((who) => ({
    ...who,
    name: demoName(who.name, locale),
    languages: demoLanguages(who.languages, locale),
  }));
}

/** A clinician as the app's card draws one: face, name, languages, price. */
function ClinicianCard({ who, onClick }: { who: (typeof RADAR_DEMO)[number]; onClick?: () => void }) {
  const t = useT();
  const money = useMoney();
  const body = (
    <span className="flex items-center gap-2.5">
      <Avatar name={who.name} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold text-navy-700">{who.name}</span>
        <span className="block truncate text-[11px] text-navy-400">{who.languages}</span>
      </span>
      <span className="shrink-0 text-end">
        <span className="block text-[12.5px] font-bold tabular-nums text-navy-700">{money(DEMO_SESSION_EGP)}</span>
        <span className="flex items-center justify-end gap-1 text-[10px] text-navy-400">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {t("pat.minutes", { minutes: who.minutes })}
        </span>
      </span>
    </span>
  );
  const shape =
    "block w-full rounded-3xl border border-navy-100/80 bg-white p-3 text-start shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(shape, "tap-target transition-colors hover:border-brand-300")}>
      {body}
    </button>
  ) : (
    <div className={shape}>{body}</div>
  );
}

/** A list whose rows arrive one after another, as the redesign's lists do. */
function Stack({ children, className }: { children: React.ReactNode[]; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...soft, delay: i * 0.05 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ home -- */

function HomeTab({
  content,
  booked,
  onScreen,
  onFindSomeone,
  onBrowse,
  onSeeSessions,
}: {
  content?: DemoContent;
  booked: number | null;
  onScreen: (screen: Screen) => void;
  onFindSomeone: () => void;
  onBrowse: () => void;
  onSeeSessions: () => void;
}) {
  const t = useT();
  const cast = useDemoCast();
  const locale = useLocale();
  const next = content?.patientSessions[0];
  const step = content?.homework[0];
  const name = DEMO_PATIENT_NAME[locale];

  return (
    <Stack>
      {[
        /*
          THE NAVY HEADER CARD: the greeting, and the therapists here as faces
          with the one thing to do beside them. Faces, not a count and not a
          pulse: the people are invented and none of them is online.
        */
        <section key="hero" className="relative overflow-hidden rounded-[26px] bg-navy-900 p-4 text-white">
          <Glow className="-end-16 -top-16 h-44 w-44" />
          <div className="relative flex items-center gap-2.5">
            <Avatar name={name} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold tracking-tight">{t("home.greeting", { name })}</p>
              <p className="truncate text-[11px] text-white/70">{t("home.recordYours")}</p>
            </div>
          </div>
          <div className="relative mt-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/12">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] font-semibold text-brand-300">{t("home.exploreTitle")}</p>
              <span className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
                {cast.map((who) => (
                  <span key={who.name} className="rounded-full ring-2 ring-navy-900">
                    <Avatar name={who.name} size={28} />
                  </span>
                ))}
              </span>
            </div>
            <button
              type="button"
              onClick={onFindSomeone}
              className="tap-target mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 text-[12px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)]"
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t("home.findNow")}</span>
            </button>
          </div>
        </section>,

        <button
          key="search"
          type="button"
          onClick={onBrowse}
          className="tap-target flex h-10 w-full items-center gap-2 rounded-2xl bg-white px-3 text-start text-[12px] text-navy-400 ring-1 ring-navy-100"
        >
          <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{t("home.searchPlaceholder")}</span>
        </button>,

        /* The next session, above anything that can be scrolled past. */
        next ? (
          <button key="next" type="button" onClick={onSeeSessions} className="tap-target block w-full text-start">
            <Row className="flex items-center gap-2.5">
              <Avatar name={next.therapist} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold tracking-[0.12em] text-brand-700 uppercase rtl:tracking-normal">
                  {t("psessions.upcoming")}
                </span>
                <span className="block truncate text-[13.5px] font-bold text-navy-700">{next.therapist}</span>
                <span className="block truncate text-[11px] text-navy-400">{next.when}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-navy-400 rtl:rotate-180" aria-hidden />
            </Row>
          </button>
        ) : null,

        /* One step before the next session, on the dark card the app gives it. */
        step ? (
          <button
            key="step"
            type="button"
            onClick={() => { onScreen("steps"); }}
            className="tap-target relative block w-full overflow-hidden rounded-3xl bg-navy-700 p-3.5 text-start text-white"
          >
            <Glow className="-end-12 -top-12 h-32 w-32" />
            <span className="relative block text-[10px] font-semibold tracking-wide text-brand-300 uppercase rtl:tracking-normal">
              {t("home.beforeNext")}
            </span>
            <span className="relative mt-1 block text-[13.5px] leading-snug font-bold">{step.title}</span>
          </button>
        ) : null,

        <div key="rated" className="space-y-2">
          <p className="flex items-center gap-1.5 px-1 text-[13px] font-bold text-navy-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {t("home.ratedHighest")}
          </p>
          {cast.slice(0, 2).map((who) => (
            <ClinicianCard key={who.name} who={who} />
          ))}
        </div>,

        <div key="rows" className="space-y-2">
          <Tile icon={NotebookPen} label={t("home.journal")} onClick={() => { onScreen("journal"); }} />
          <Tile icon={FileText} label={t("home.summary")} onClick={() => { onScreen("summary"); }} />
          <Tile icon={ShieldCheck} label={t("home.yourRecord")} onClick={() => { onScreen("record"); }} />
        </div>,

        booked !== null ? (
          <p key="booked" className="px-1 text-[11px] leading-relaxed text-navy-500">{t("pat.bookedBody")}</p>
        ) : null,
      ].filter(Boolean)}
    </Stack>
  );
}

/* -------------------------------------------------------------- sessions -- */

function Sessions({
  content,
  booked,
  onScreen,
  onWhoCanRead,
}: {
  content?: DemoContent;
  booked: number | null;
  onScreen: (screen: Screen) => void;
  onWhoCanRead: () => void;
}) {
  const t = useT();
  const cast = useDemoCast();
  const rows = content?.patientSessions ?? [];
  const who = booked === null ? null : cast[booked];

  return (
    <Stack>
      {[
        /*
          The session the visitor just booked, at the top and on the dark card,
          so pressing "go in" on the radar tab visibly did something over here.
        */
        who ? (
          <div key="booked" className="relative overflow-hidden rounded-3xl bg-navy-900 p-3.5 text-white">
            <Glow className="-end-12 -top-12 h-32 w-32" />
            <p className="relative text-[10px] font-bold tracking-wider text-brand-300 uppercase rtl:tracking-normal">
              {t("pat.nowLabel")}
            </p>
            <div className="relative mt-1.5 flex items-center gap-2.5">
              <Avatar name={who.name} size={34} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold">{who.name}</p>
                <p className="truncate text-[11px] text-white/70">{t("pat.readyNow", { minutes: who.minutes })}</p>
              </div>
            </div>
            <span className="relative mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-[12px] font-semibold text-navy-700">
              <Video className="h-3.5 w-3.5" aria-hidden />
              {t("pat.goIn")}
            </span>
          </div>
        ) : null,

        ...rows.map((row, i) => (
          <Row key={`s${String(i)}`}>
            <div className="flex items-center gap-2.5">
              <Avatar name={row.therapist} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-navy-700">{row.therapist}</p>
                <p className="truncate text-[10.5px] text-navy-400">{row.when}</p>
              </div>
            </div>
            {row.brief ? (
              <p className="mt-2 rounded-2xl bg-navy-50 px-3 py-2 text-[11.5px] leading-relaxed text-navy-600">{row.brief}</p>
            ) : (
              <p className="mt-2 text-[11px] text-navy-400">{t("pat.noSummary")}</p>
            )}
          </Row>
        )),

        <div key="rows" className="space-y-2 pt-1">
          <Tile icon={NotebookPen} label={t("home.journal")} onClick={() => { onScreen("journal"); }} />
          <Tile icon={FileText} label={t("home.summary")} onClick={() => { onScreen("summary"); }} />
          <Tile icon={ShieldCheck} label={t("home.whoCanRead")} onClick={onWhoCanRead} />
          <Tile icon={Download} label={t("home.getCopy")} onClick={() => { onScreen("record"); }} />
        </div>,
      ].filter(Boolean)}
    </Stack>
  );
}

function Journal({ content }: { content?: DemoContent }) {
  return (
    <Stack>
      {(content?.journalEntries ?? []).map((entry) => (
        <Row key={entry.on}>
          <p className="text-[10.5px] font-semibold text-brand-700">{entry.on}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-navy-600">{entry.text}</p>
        </Row>
      ))}
    </Stack>
  );
}

function Summary({ content }: { content?: DemoContent }) {
  const t = useT();
  return (
    <Stack>
      {(content?.summaryVersions ?? []).map((version) => (
        <Row key={version.version}>
          <div className="flex items-center gap-2.5">
            <Avatar name={version.author} size={30} />
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-bold text-navy-700">{version.author}</p>
              <p className="truncate text-[10.5px] text-navy-400">
                {t("pat.version", { n: version.version })}
                {version.on ? ` · ${version.on}` : ""}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-navy-600">{version.body}</p>
        </Row>
      ))}
    </Stack>
  );
}

function RecordCopy() {
  const t = useT();
  return (
    <Stack>
      {[
        <p key="body" className="px-1 text-[12.5px] leading-relaxed text-navy-600">{t("precord.body")}</p>,
        <Row key="copy">
          <p className="text-[13px] font-bold text-navy-700">{t("precord.copyTitle")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-navy-500">{t("precord.copyBody")}</p>
          <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-[12px] font-semibold text-navy-700">
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t("precord.addEmail")}
          </span>
        </Row>,
      ]}
    </Stack>
  );
}

function Steps({ content }: { content?: DemoContent }) {
  const [done, setDone] = useState<string[]>([]);
  return (
    <Stack>
      {(content?.homework ?? []).map((item) => {
        const ticked = done.includes(item.title);
        return (
          <button
            key={item.title}
            type="button"
            aria-pressed={ticked}
            onClick={() => {
              setDone((prev) => (ticked ? prev.filter((x) => x !== item.title) : [...prev, item.title]));
            }}
            className="tap-target block w-full text-start"
          >
            <Row className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg ring-2 transition-colors",
                  ticked ? "bg-brand-500 text-navy-700 ring-brand-500" : "bg-white ring-navy-200",
                )}
              >
                {ticked ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[13px] font-bold text-navy-700", ticked && "line-through decoration-navy-300")}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-navy-500">{item.detail}</span>
              </span>
            </Row>
          </button>
        );
      })}
    </Stack>
  );
}

/* ----------------------------------------------------------------- radar -- */

function Radar({
  picked,
  booked,
  sessionVatBps,
  onPick,
  onBook,
  onSeeSessions,
}: {
  picked: number | null;
  booked: number | null;
  /** 🔴 The product's rule for Egypt, from the demo content, never a literal. */
  sessionVatBps: number;
  onPick: (i: number | null) => void;
  onBook: (i: number) => void;
  onSeeSessions: () => void;
}) {
  const t = useT();
  const cast = useDemoCast();
  const money = useMoney();

  if (booked !== null) {
    const who = cast[booked];
    return (
      <div className="space-y-3 pt-4 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-navy-700 shadow-[0_10px_28px_-8px_rgba(46,196,182,0.8)]"
        >
          <Check className="h-7 w-7" aria-hidden />
        </motion.span>
        <p className="text-[15px] font-bold text-navy-700">
          {t("pat.booked", { name: who?.name ?? "" })}
        </p>
        <p className="text-[12px] leading-relaxed text-navy-500">{t("pat.bookedBody")}</p>
        <button
          type="button"
          onClick={onSeeSessions}
          className="tap-target block w-full rounded-2xl bg-brand-500 px-3 py-2.5 text-[13px] font-semibold text-navy-700"
        >
          {t("pat.seeIt")}
        </button>
      </div>
    );
  }

  if (picked !== null) {
    const who = cast[picked];
    if (!who) return null;
    const price = DEMO_SESSION_EGP;
    /* Computed from the rule it is handed; zero under the exempt default. */
    const vat = Math.round((price * sessionVatBps) / 10_000);
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { onPick(null); }}
          className="tap-target flex items-center gap-1.5 text-[12px] font-semibold text-navy-500"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t("common.back")}
        </button>

        <Row>
          <div className="flex items-center gap-3">
            <Avatar name={who.name} size={48} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-navy-700">{who.name}</p>
              <p className="truncate text-[11.5px] text-navy-400">{who.languages}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1 rounded-2xl bg-navy-50 p-3 text-[12.5px]">
            <div className="flex justify-between gap-2">
              <span className="text-navy-500">{t("pat.theSession")}</span>
              <span className="font-semibold tabular-nums text-navy-700">{money(price)}</span>
            </div>
            {/* Hidden at zero, as the real pay screen hides it (`pay-flow.tsx`). */}
            {vat > 0 ? (
              <div className="flex justify-between gap-2">
                <span className="text-navy-500">{t("pat.vat")}</span>
                <span className="tabular-nums text-navy-600">{money(vat)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 border-t border-navy-100 pt-1 font-bold text-navy-700">
              <span>{t("pat.total")}</span>
              <span className="tabular-nums">{money(price + vat)}</span>
            </div>
          </div>
        </Row>

        {/* The no-account line, at the step where somebody braces for a signup wall. */}
        <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-navy-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          {t("pat.noAccount")}
        </p>

        <button
          type="button"
          onClick={() => { onBook(picked); }}
          className="tap-target block w-full rounded-2xl bg-brand-500 px-3 py-2.5 text-[13px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)]"
        >
          {t("pat.talkNow")}
        </button>
      </div>
    );
  }

  return (
    <Stack>
      {[
        /*
          🔴 THE MAP, BECAUSE THE APP OPENS ON ONE: `WorldRadar`, the console's
          own map, on the room's dark ground, with the invented clinicians'
          country on it. Pressing a dot opens that clinician, as it does there.
        */
        <div key="map" className="overflow-hidden rounded-3xl bg-navy-900 p-2">
          <WorldRadar
            dots={cast.map((who) => ({
              id: who.name,
              country: who.country,
              status: "online" as const,
              label: who.name,
            }))}
            selectedId={null}
            onSelect={(id) => {
              const index = cast.findIndex((who) => who.name === id);
              if (index >= 0) onPick(index);
            }}
            scale={2.8}
            className="aspect-[2/1] w-full"
          />
        </div>,
        ...cast.map((who, i) => (
          <ClinicianCard key={who.name} who={who} onClick={() => { onPick(i); }} />
        )),
      ]}
    </Stack>
  );
}

/* ------------------------------------------------------------ therapists -- */

function Therapists({ onFindSomeone }: { onFindSomeone: () => void }) {
  const t = useT();
  const cast = useDemoCast();
  return (
    <Stack>
      {[
        <div
          key="search"
          className="flex h-10 w-full items-center gap-2 rounded-2xl bg-white px-3 text-[12px] text-navy-400 ring-1 ring-navy-100"
        >
          <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{t("home.searchPlaceholder")}</span>
        </div>,
        ...cast.map((who) => <ClinicianCard key={who.name} who={who} />),
        <button
          key="find"
          type="button"
          onClick={onFindSomeone}
          className="tap-target block w-full rounded-2xl bg-brand-500 px-3 py-2.5 text-[13px] font-semibold text-navy-700"
        >
          {t("home.findNow")}
        </button>,
      ]}
    </Stack>
  );
}

/* --------------------------------------------------------------- billing -- */

function Billing() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  return (
    <Stack>
      {[
        ...PATIENT_BILLS.map((bill) => (
          <Row key={`${bill.clinician}${bill.on}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
                  <Receipt className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-navy-700">{t("transfer.subjectSessionWith", { name: demoName(bill.clinician, locale) })}</span>
                  <span className="block text-[10.5px] text-navy-400">
                    {formatDay(new Date(`${bill.on}T12:00:00Z`), "UTC", locale)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-[12.5px] font-bold tabular-nums text-navy-700">{money(DEMO_SESSION_EGP)}</span>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9.5px] font-bold",
                    bill.paid ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-800",
                  )}
                >
                  {bill.paid ? t("pat.paid") : t("pat.due")}
                </span>
              </span>
            </div>
          </Row>
        )),
        <p key="note" className="px-1 text-[11.5px] leading-relaxed text-navy-500">{t("pat.billingNote")}</p>,
      ]}
    </Stack>
  );
}

/* ------------------------------------------------------------------- you -- */

function You({ content, onScreen }: { content?: DemoContent; onScreen: (screen: Screen) => void }) {
  const t = useT();
  const cast = useDemoCast();
  const locale = useLocale();
  const who = content?.patientSessions[0]?.therapist ?? cast[0]?.name ?? "";
  const name = DEMO_PATIENT_NAME[locale];
  return (
    <Stack>
      {[
        <div key="me" className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-navy-900 p-3.5 text-white">
          <Glow className="-end-12 -top-12 h-32 w-32" />
          <Avatar name={name} size={40} />
          <div className="relative min-w-0">
            <p className="truncate text-[15px] font-bold">{name}</p>
            <p className="truncate text-[11px] text-white/70">{t("home.recordYours")}</p>
          </div>
        </div>,
        <Row key="access">
          <p className="text-[10px] font-bold tracking-wider text-navy-400 uppercase rtl:tracking-normal">
            {t("consent.whoHasAccess")}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={who} size={28} />
              <span className="truncate text-[13px] font-bold text-navy-700">{who}</span>
            </span>
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-800">
              {t("consent.canRead")}
            </span>
          </div>
          <span className="mt-2.5 block rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-700 ring-1 ring-red-200">
            {t("consent.stop")}
          </span>
        </Row>,
        <p key="why" className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-navy-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          {t("consent.neverWhy")}
        </p>,
        /* The way to billing, because Option A took it off the bar. */
        <Tile key="billing" icon={Receipt} label={t("tab.billing")} onClick={() => { onScreen("billing"); }} />,
        <Tile key="steps" icon={ListChecks} label={t("tab.steps")} onClick={() => { onScreen("steps"); }} />,
      ]}
    </Stack>
  );
}
