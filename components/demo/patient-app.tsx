"use client";

import { useState } from "react";
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
  ListChecks,
  NotebookPen,
  Receipt,
  ShieldCheck,
  Video,
} from "lucide-react";

import type { DemoContent } from "@/lib/content/demo";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { PATIENT_BILLS, RADAR_DEMO } from "@/lib/marketing/fixtures";
import { cn } from "@/lib/utils";

import { DeviceFrame } from "./device-frame";

/**
 * 🔴 76.81 — THE PATIENT'S APP, AS A PHONE SOMEBODY CAN ACTUALLY USE.
 *
 * ## What was wrong with the old phone mockups
 *
 * Each one drew a single screen with a decorative bottom bar under it. The bar
 * had the right five tabs and the lifted globe, and not one of them did
 * anything, so a reader could see that the app had a Sessions tab and could
 * never find out what was on it. Three separate faults:
 *
 *   1. **No name on the screen.** A list of dated cards with no heading could
 *      be anything. The real app puts the screen's name at the top; a mockup
 *      that leaves it off is showing a screen nobody could navigate to.
 *   2. **A nav that is a picture of a nav.** The one control every phone user
 *      reaches for first, drawn and dead.
 *   3. **Nothing to do.** The single loudest thing this product claims to a
 *      patient is that they can find somebody and be in a session in a minute,
 *      with no account. That is a SEQUENCE, and a still frame cannot make it.
 *
 * ## So the whole app is here, and the radar tab books a session
 *
 * Five tabs, each with its name at the top and its own screen, and the tab you
 * are on is lit in the bar exactly as it is in `components/patient/bottom-nav.tsx`.
 * The radar tab walks the real sequence: who is free, tap one, see the price
 * with VAT, go in. When it completes, the booked session appears on the Sessions
 * tab, because a demo where the tabs do not affect each other is five demos in
 * a trench coat.
 *
 * ## 🔴 It books nothing, and cannot
 *
 * Fixtures and local state. No action, no route, no fetch. The clinicians are
 * invented and carry the same DEMO- convention `scripts/demo.ts` uses, so there
 * is no path from this page to a real person's calendar — which is the property
 * that makes putting a working booking flow on an anonymous page safe.
 */

type Tab = "sessions" | "steps" | "radar" | "billing" | "you";

/**
 * The screens that are not tabs.
 *
 * In the real app these are rows on the home screen rather than destinations
 * in the bar, because the bar holds five things and a patient app with a
 * "more" tab is one where what somebody needs is always in the drawer. They
 * are reachable here the same way they are reachable there: from Sessions.
 */
type Screen = "journal" | "summary" | "record";

const TABS: { key: Tab; label: MessageKey; icon: typeof Globe2; lifted?: boolean }[] = [
  { key: "sessions", label: "tab.sessions", icon: CalendarDays },
  { key: "steps", label: "tab.steps", icon: ListChecks },
  { key: "radar", label: "tab.radar", icon: Globe2, lifted: true },
  { key: "billing", label: "tab.billing", icon: Receipt },
  { key: "you", label: "tab.you", icon: CircleUser },
];

const SCREEN_TITLE: Record<Screen, MessageKey> = {
  journal: "home.journal",
  summary: "home.summary",
  record: "precord.title",
};

const money = (cents: number) =>
  `$${String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export function PatientApp({
  content,
  initial = "radar",
  open = null,
  className,
}: {
  content?: DemoContent;
  initial?: Tab;
  /** Open on one of the screens that hangs off Sessions rather than on a tab. */
  open?: Screen | null;
  className?: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(open ? "sessions" : initial);
  const [screen, setScreen] = useState<Screen | null>(open);
  /* null = nobody picked, a name = the sheet is open, "booked" = it happened. */
  const [picked, setPicked] = useState<number | null>(null);
  const [booked, setBooked] = useState<number | null>(null);

  const title = screen
    ? t(SCREEN_TITLE[screen])
    : t(TABS.find((x) => x.key === tab)?.label ?? "tab.sessions");

  function go(next: Tab) {
    setScreen(null);
    setTab(next);
  }

  return (
    <DeviceFrame
      as="phone"
      className={className}
      tabs={TABS.map(({ key, label, icon, lifted }) => ({
        key,
        label: t(label),
        icon,
        lifted,
      }))}
      activeTab={screen ? "sessions" : tab}
      onTab={(key) => { go(key as Tab); }}
    >
      {/*
        🔴 THE SCREEN'S NAME, at the top, where the real app puts it. A phone
        mockup with no heading is a picture of a screen nobody could have
        navigated to, which is the one thing a navigable mockup exists to fix.
      */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur">
        {screen ? (
          <button
            type="button"
            onClick={() => { setScreen(null); }}
            aria-label={t("common.back")}
            className="-ms-1 shrink-0 text-slate-700"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
        ) : null}
        <p className="min-w-0 truncate text-[15px] font-bold text-slate-900">{title}</p>
      </div>

      <div className="px-4 py-3">
        {screen === "journal" ? <Journal content={content} /> : null}
        {screen === "summary" ? <Summary content={content} /> : null}
        {screen === "record" ? <RecordCopy /> : null}

        {screen === null ? (
          <>
            {tab === "sessions" ? (
              <Sessions
                content={content}
                booked={booked}
                onScreen={setScreen}
                onWhoCanRead={() => { go("you"); }}
              />
            ) : null}
            {tab === "steps" ? <Steps content={content} /> : null}
            {tab === "radar" ? (
              <Radar
                picked={picked}
                booked={booked}
                onPick={setPicked}
                onBook={(i) => { setBooked(i); setPicked(null); }}
                onSeeSessions={() => { go("sessions"); }}
              />
            ) : null}
            {tab === "billing" ? <Billing /> : null}
            {tab === "you" ? <You content={content} /> : null}
          </>
        ) : null}
      </div>
    </DeviceFrame>
  );
}

/* ───────────────────────────────────────────────────────── the screens ── */

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">{children}</div>
  );
}

/** One of the home screen's rows into a screen that is not a tab. */
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
      className="tap-target flex w-full items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 text-start text-[13px] font-medium text-slate-800 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 rtl:rotate-180" aria-hidden />
    </button>
  );
}

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
  const rows = content?.patientSessions ?? [];
  const who = booked === null ? null : RADAR_DEMO[booked];

  return (
    <div className="space-y-2.5">
      {/*
        The session the visitor just booked, at the top and lit, so pressing
        "go in" on the radar tab visibly did something over here. A demo whose
        tabs cannot affect each other is five demos in a trench coat.
      */}
      {who ? (
        <div className="animate-fade-rise rounded-2xl border-2 border-brand-400 bg-brand-50/70 p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-brand-700 uppercase">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
            {t("pat.nowLabel")}
          </p>
          <p className="mt-1 text-[14px] font-semibold text-slate-900">{who.name}</p>
          <p className="mt-0.5 text-[12px] text-slate-700">
            {t("pat.readyNow", { minutes: who.minutes })}
          </p>
          <span className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white">
            <Video className="h-3.5 w-3.5" aria-hidden />
            {t("pat.goIn")}
          </span>
        </div>
      ) : null}

      {rows.map((row, i) => (
        <Row key={i}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold text-slate-900">{row.therapist}</p>
            <p className="text-[11px] text-slate-600">{row.when}</p>
          </div>
          {row.brief ? (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{row.brief}</p>
          ) : (
            <p className="mt-1 text-[12px] text-slate-600">{t("pat.noSummary")}</p>
          )}
        </Row>
      ))}

      {/*
        🔴 The four rows the real home screen carries under the sessions, and
        they are here for the same reason the tabs are: three of these were
        separate, unreachable mockups elsewhere on the site. A screen a reader
        can only be SHOWN is a screenshot. One they can walk to is an app.
      */}
      <div className="space-y-2 pt-1">
        <Tile icon={NotebookPen} label={t("home.journal")} onClick={() => { onScreen("journal"); }} />
        <Tile icon={FileText} label={t("home.summary")} onClick={() => { onScreen("summary"); }} />
        <Tile icon={ShieldCheck} label={t("home.whoCanRead")} onClick={onWhoCanRead} />
        <Tile icon={Download} label={t("home.getCopy")} onClick={() => { onScreen("record"); }} />
      </div>
    </div>
  );
}

/**
 * What she wrote herself, between sessions.
 *
 * 🔴 And note what is NOT drawn beside it: no shield, no "your therapist is
 * reading this", no reassurance. C123 governs the real screen and it governs
 * the picture of the screen, because a demonstration that promises a watch is
 * the same false promise in a smaller frame.
 */
function Journal({ content }: { content?: DemoContent }) {
  return (
    <ul className="space-y-2.5">
      {(content?.journalEntries ?? []).map((entry) => (
        <li key={entry.on} className="rounded-2xl bg-slate-50 p-3.5">
          <p className="text-[11px] font-semibold text-slate-600">{entry.on}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-800">{entry.text}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * 🔴 28.6 — THE PORTABILITY ARGUMENT, SHOWN RATHER THAN ASSERTED.
 *
 * Two versions with two different clinicians' names on them. That is the whole
 * claim of this product to a patient, and a paragraph saying "your record
 * follows you" is worth less than the picture of it having done so.
 */
function Summary({ content }: { content?: DemoContent }) {
  const t = useT();
  return (
    <ul className="space-y-2.5">
      {(content?.summaryVersions ?? []).map((version) => (
        <li key={version.version} className="rounded-2xl border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-[13px] font-semibold text-slate-900">{version.author}</p>
            <p className="text-[11px] text-slate-600">
              {t("pat.version", { n: version.version })}
              {version.on ? ` · ${version.on}` : ""}
            </p>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-800">{version.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** 26.9 — the whole thing, in one document she can keep. */
function RecordCopy() {
  const t = useT();
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-slate-800">{t("precord.body")}</p>
      <Row>
        <p className="text-[13px] font-semibold text-slate-900">{t("precord.copyTitle")}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{t("precord.copyBody")}</p>
        <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white">
          <Download className="h-3.5 w-3.5" aria-hidden />
          {t("precord.addEmail")}
        </span>
      </Row>
    </div>
  );
}

function Steps({ content }: { content?: DemoContent }) {
  return (
    <div className="space-y-2.5">
      {(content?.homework ?? []).map((item) => (
        <Row key={item.title}>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2 border-slate-300" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-slate-900">{item.title}</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-700">
                {item.detail}
              </span>
            </span>
          </div>
        </Row>
      ))}
    </div>
  );
}

/**
 * 🔴 THE RADAR, AND THE THREE TAPS THAT ARE THE WHOLE CLAIM.
 *
 * Who is free now, what they cost with the tax on it, and a door. No account,
 * no form, no waiting list — and the screen says so at the step where somebody
 * would otherwise be bracing for a signup wall, rather than in a footnote.
 */
function Radar({
  picked,
  booked,
  onPick,
  onBook,
  onSeeSessions,
}: {
  picked: number | null;
  booked: number | null;
  onPick: (i: number | null) => void;
  onBook: (i: number) => void;
  onSeeSessions: () => void;
}) {
  const t = useT();

  if (booked !== null) {
    const who = RADAR_DEMO[booked];
    return (
      <div className="animate-fade-rise space-y-3 pt-2 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-100">
          <Check className="h-7 w-7 text-teal-700" aria-hidden />
        </span>
        <p className="text-[16px] font-bold text-slate-900">
          {t("pat.booked", { name: who?.name ?? "" })}
        </p>
        <p className="text-[13px] leading-relaxed text-slate-700">{t("pat.bookedBody")}</p>
        <button
          type="button"
          onClick={onSeeSessions}
          className="tap-target block w-full rounded-xl bg-brand-600 px-3 py-2.5 text-[13px] font-semibold text-white"
        >
          {t("pat.seeIt")}
        </button>
      </div>
    );
  }

  if (picked !== null) {
    const who = RADAR_DEMO[picked];
    if (!who) return null;
    const vat = Math.round(who.priceCents * 0.14);
    return (
      <div className="animate-fade-rise space-y-3">
        <button
          type="button"
          onClick={() => { onPick(null); }}
          className="tap-target flex items-center gap-1.5 text-[12px] font-semibold text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t("common.back")}
        </button>

        <Row>
          <p className="text-[15px] font-bold text-slate-900">{who.name}</p>
          <p className="mt-0.5 text-[12px] text-slate-700">{who.title}</p>
          <p className="mt-0.5 text-[12px] text-slate-700">{who.languages}</p>

          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-slate-700">{t("pat.theSession")}</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {money(who.priceCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">{t("pat.vat")}</span>
              <span className="text-slate-800 tabular-nums">{money(vat)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold">
              <span className="text-slate-900">{t("pat.total")}</span>
              <span className="text-slate-900 tabular-nums">{money(who.priceCents + vat)}</span>
            </div>
          </div>
        </Row>

        {/*
          🔴 The no-account line goes HERE, at the step where somebody is
          bracing for a signup wall, not in a footnote at the bottom of a
          marketing page where it is read by nobody who needed it.
        */}
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          {t("pat.noAccount")}
        </p>

        <button
          type="button"
          onClick={() => { onBook(picked); }}
          className="tap-target block w-full rounded-xl bg-brand-600 px-3 py-2.5 text-[13px] font-semibold text-white"
        >
          {t("pat.talkNow")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[12px] leading-relaxed text-slate-700">{t("pat.freeNow")}</p>
      {RADAR_DEMO.map((who, i) => (
        <button
          key={who.name}
          type="button"
          onClick={() => { onPick(i); }}
          className="tap-target block w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-start transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[14px] font-semibold text-slate-900">{who.name}</span>
            <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-teal-700 uppercase">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-500" />
              {t("pat.freeLabel")}
            </span>
          </span>
          <span className="mt-0.5 block text-[12px] text-slate-700">{who.languages}</span>
          <span className="mt-1.5 flex items-center gap-3 text-[12px] text-slate-800">
            <span className="font-semibold tabular-nums">{money(who.priceCents)}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-600" aria-hidden />
              {t("pat.minutes", { minutes: who.minutes })}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Billing() {
  const t = useT();
  return (
    <div className="space-y-2.5">
      {PATIENT_BILLS.map((bill) => (
        <Row key={`${bill.what}${bill.when}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-slate-900">
                {bill.what}
              </span>
              <span className="block text-[11px] text-slate-600">{bill.when}</span>
            </span>
            <span className="shrink-0 text-end">
              <span className="block text-[14px] font-bold text-slate-900 tabular-nums">
                {money(bill.cents)}
              </span>
              <span
                className={cn(
                  "mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                  bill.paid ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700",
                )}
              >
                {bill.paid ? t("pat.paid") : t("pat.due")}
              </span>
            </span>
          </div>
        </Row>
      ))}
      <p className="text-[12px] leading-relaxed text-slate-700">{t("pat.billingNote")}</p>
    </div>
  );
}

/**
 * The account tab, and what it is really for: the list of who can read you.
 *
 * 🔴 Not a settings screen with a name and a phone number on it. The one thing
 * a patient owns in this product is the answer to "who can read my history",
 * and this is where they change it, so this is what the tab shows.
 */
function You({ content }: { content?: DemoContent }) {
  const t = useT();
  /*
   * 🔴 THE NAME COMES FROM THE SESSIONS LIST, not from a literal here.
   *
   * Two reasons and both are real. The clinician who can read her history has
   * to be the clinician on her sessions, or the app contradicts itself one tab
   * over. And a name typed into markup is an English literal on a shared
   * surface, which 37L.6 counts and which the Arabic page would then render in
   * the wrong script.
   */
  const who = content?.patientSessions[0]?.therapist ?? RADAR_DEMO[0]?.name ?? "";
  return (
    <div className="space-y-2.5">
      <Row>
        <p className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
          {t("consent.whoHasAccess")}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-slate-900">{who}</span>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-teal-800 uppercase">
            {t("consent.canRead")}
          </span>
        </div>
        <span className="mt-2 block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-700">
          {t("consent.stop")}
        </span>
      </Row>
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
        {t("consent.neverWhy")}
      </p>
    </div>
  );
}
