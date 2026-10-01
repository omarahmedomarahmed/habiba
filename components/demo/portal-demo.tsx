"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import QRCode from "qrcode";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Globe,
  Home,
  KeyRound,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  Plus,
  QrCode,
  Radio,
  ReceiptText,
  RotateCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { DeviceFrame } from "./device-frame";
import { MotionRoot, soft, spring } from "./motion";
import { Avatar, Badge, Card, Glow } from "@/components/clinician/kit";
import { PotRing } from "@/components/sponsor/ring";
import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { Meter, NeverBar } from "@/components/visual/primitives";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  CLINIC,
  CLINIC_TEAM,
  CLINIC_WEEKS,
  COMPANY,
  COMPANY_MONTHS,
  COMPANY_STAFF,
  COMPANY_TOPUPS,
  COMPANY_WEEKS,
  DEMO_ORGS,
  DEMO_ZONE,
  demoName,
  KARIM,
  KARIM_PATIENTS,
  KARIM_SESSIONS,
  MARIAM_COPILOT,
  MARIAM_OBSERVATIONS,
  PARTNER_DELIVERIES,
  PARTNER_KEYS,
} from "@/lib/marketing/fixtures";
import { egp, egpFrom } from "@/lib/marketing/prices";
import { formatCalendarDate, formatDay, formatTime } from "@/lib/scheduling/tz";
import { cn, formatMonthYear } from "@/lib/utils";

/**
 * 🔴 THE FOUR DESKS, AS THE SEEDED LOGINS SEE THEM (founder, 26 Sep).
 *
 * *"Make sure the mockups use the current updated layout of the portals, make the
 * whole mockup clickable and look exactly the same as the actual app, with the seeded
 * data from the video."*
 *
 * Each console here is the real portal redrawn inside a browser frame with the real
 * classes, and every section in its rail is a button that opens that section:
 *
 *   - `CompanyConsole`: `/sponsor` as Dalia Samir at Cairo Foundry, the navy rail of
 *     `components/portal/desk-navy.tsx` with its eight sections and icons.
 *   - `ClinicConsole`: `/clinic` as Hana Mahmoud at Nile Practice, the clinic's navy
 *     rail with its four groups and the tabs inside each (ruling 14b).
 *   - `TherapistConsole`: `/dashboard` as Dr Karim Nabil, the clinician's navy
 *     sidebar with New session, and on a phone the floating dock with the raised plus.
 *   - `PartnerConsole`: `/partner` as Helio Health.
 *
 * Below `sm` each desk collapses the way the real one does below `lg`: the portals to
 * the white header with the row of pills, the clinician to the dock.
 *
 * The portal's own pure components are imported rather than copied: `SpendHeatmap`
 * (C229's suppression and all), `PotRing`, `Meter`, `NeverBar`, `Card`, `Badge`,
 * `Avatar` and the logo. Everything else carries the page's own classes at the size
 * the frame allows. No action, no route, no fetch: local state only.
 */

/* ------------------------------------------------------------ shared bits -- */

function useMoney() {
  const locale = useLocale();
  return (pounds: number) => egp(pounds * 100, locale);
}

function useDate() {
  const locale = useLocale();
  return (iso: string) => formatCalendarDate(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso), DEMO_ZONE, locale);
}

type Section = { key: string; label: string; icon?: LucideIcon };

/**
 * The navy desk. `components/portal/desk-navy.tsx` and the clinician's sidebar in
 * `app/(app)/layout.tsx` are the same rail with different contents, so one shell
 * draws all four, fed what each one puts in it.
 */
function Desk({
  sections,
  active,
  onTab,
  never,
  neverTone = "dark",
  who,
  top,
  phone = "pills",
  dock,
  path,
  frame,
  children,
}: {
  sections: Section[];
  active: string;
  onTab: (key: string) => void;
  never?: { label: string; items: string[] };
  /** The sponsor's wall sits on the rail; the clinic's in a white card on it. */
  neverTone?: "dark" | "light";
  who: { name: string; sub: string; initials?: string };
  /** Above the sections: the clinician's New session. */
  top?: React.ReactNode;
  /** What replaces the rail on a narrow screen. */
  phone?: "pills" | "dock";
  dock?: React.ReactNode;
  /** The route the section lives at, for the address bar. */
  path?: string;
  /** Given, the desk draws its own browser window, so the address follows the section. */
  frame?: { bodyClassName?: string };
  children: React.ReactNode;
}) {
  const wall = never ? (
    neverTone === "dark" ? (
      <NeverBar label={never.label} items={never.items} tone="dark" />
    ) : (
      <div className="rounded-2xl bg-white p-3 [&_div]:border-0 [&_div]:pt-0">
        <NeverBar label={never.label} items={never.items} />
      </div>
    )
  ) : null;

  const body = (
    <MotionRoot>
      <div className="relative flex h-full min-h-0 bg-navy-50 text-navy-700">
        <nav className="no-scrollbar relative hidden w-48 shrink-0 flex-col overflow-y-auto bg-navy-900 text-white sm:flex lg:w-44 xl:w-48">
          <Glow className="-start-20 -top-20 h-48 w-48 opacity-70" />
          <div className="relative px-4 pt-4 pb-4">
            <Logo ink="white" height={22} />
          </div>
          {top}
          <div className="relative space-y-1 px-2.5">
            {sections.map(({ key, label, icon: Icon }) => {
              const on = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onTab(key);
                  }}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-start text-[12.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    on
                      ? "bg-brand-500 text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.9)]"
                      : "text-white/75 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              );
            })}
          </div>
          {wall ? <div className="relative mt-auto px-2.5 pt-4">{wall}</div> : <div className="mt-auto" />}
          <div className="relative m-2.5 flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10">
            {who.initials ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-navy-700">
                {who.initials}
              </span>
            ) : (
              <Avatar name={who.name} size={32} />
            )}
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-white">{who.name}</span>
              <span className="block truncate text-[10.5px] text-white/70">{who.sub}</span>
            </span>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* No rail on a narrow screen: the white header, and the pills under it. */}
          <header className="shrink-0 border-b border-navy-100 bg-white/90 backdrop-blur-xl sm:hidden">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <Logo ink="navy" height={21} />
              <span className="min-w-0 truncate text-[12.5px] font-bold text-navy-600">{who.name}</span>
            </div>
            {phone === "pills" ? (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5">
                {sections.map(({ key, label }) => {
                  const on = key === active;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onTab(key);
                      }}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                        on ? "bg-navy-600 text-white" : "bg-white text-navy-500 ring-1 ring-navy-100 hover:text-navy-700",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </header>

          <div className={cn("no-scrollbar @container relative min-h-0 flex-1 overflow-y-auto", phone === "dock" && "pb-20 sm:pb-0")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={soft}
                className="space-y-3 p-3.5 @lg:p-5"
              >
                {children}
                {wall ? <div className="rounded-3xl bg-navy-900 p-1 sm:hidden">{neverTone === "dark" ? wall : <div className="p-0.5">{wall}</div>}</div> : null}
              </motion.div>
            </AnimatePresence>
          </div>
          {phone === "dock" ? <div className="sm:hidden">{dock}</div> : null}
        </div>
      </div>
    </MotionRoot>
  );
  /*
   * 🔴 THE ADDRESS BAR FOLLOWS THE SECTION. A window that says `/sponsor` while
   * showing the joining code is a screenshot's habit, not a browser's.
   */
  return frame ? (
    <DeviceFrame as="browser" path={path} bodyClassName={frame.bodyClassName}>
      {body}
    </DeviceFrame>
  ) : (
    body
  );
}

/** `SponsorHeading` / `ClinicHead` / `PageHeader`: the page's own h1, at frame scale. */
function Head({ title, subtitle, note, action }: { title: string; subtitle?: string; note?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h3 className="text-[19px] leading-tight font-bold tracking-tight text-navy-700">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-navy-400">{subtitle}</p> : null}
        {note ? <p className="mt-0.5 text-[11.5px] font-semibold text-navy-400">{note}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** The kit's `buttonClass("primary", "sm")` and `("secondary", "sm")`, pressed but going nowhere. */
function Primary({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-[12px] font-semibold text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.8)] outline-none hover:bg-brand-400 focus-visible:ring-2 focus-visible:ring-navy-700"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}

function Ghost({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-navy-100 bg-white px-3 text-[12px] font-semibold text-navy-600 outline-none hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** The kit's `Stat`, at the frame's size: a label and a figure, light or on navy. */
function Stat({ label, children, tone = "light" }: { label: string; children: React.ReactNode; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-3.5",
        dark ? "bg-navy-900 text-white" : "border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04)]",
      )}
    >
      {dark ? <Glow className="-end-16 -top-16 h-40 w-40 opacity-60" /> : null}
      <p className={cn("relative text-[11.5px] font-semibold", dark ? "text-white/70" : "text-navy-400")}>{label}</p>
      <div className={cn("relative mt-0.5 text-[20px] leading-tight font-bold tabular-nums", dark ? "text-white" : "text-navy-700")}>
        {children}
      </div>
    </div>
  );
}

/** Rows that arrive one after another, as the portal's lists do. */
function Rows({ children }: { children: React.ReactNode[] }) {
  return (
    <ul className="divide-y divide-navy-100/70">
      {children.map((child, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: i * 0.04 }}
        >
          {child}
        </motion.li>
      ))}
    </ul>
  );
}

/** Ruling 14b: the pages inside the current group, one tap away, as the clinic draws them. */
function GroupTabs({ tabs, active, onTab }: { tabs: { key: string; label: string }[]; active: string; onTab: (key: string) => void }) {
  return (
    <div className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-navy-100">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-current={tab.key === active ? "page" : undefined}
          onClick={() => {
            onTab(tab.key);
          }}
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            tab.key === active ? "bg-navy-600 text-white" : "text-navy-500 hover:text-navy-700",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* =============================================================== company == */

const COMPANY_TABS: { key: string; label: MessageKey; icon: LucideIcon }[] = [
  { key: "overview", label: "sponsor.nav.overview", icon: LayoutDashboard },
  { key: "ledger", label: "sponsor.nav.ledger", icon: ReceiptText },
  { key: "people", label: "sponsor.nav.people", icon: Users },
  { key: "code", label: "sponsor.nav.code", icon: QrCode },
  { key: "pot", label: "sponsor.nav.pot", icon: Wallet },
  { key: "domains", label: "sponsor.nav.domains", icon: Globe },
  { key: "settings", label: "sponsor.nav.settings", icon: Settings },
  { key: "team", label: "sponsor.nav.team", icon: UsersRound },
];

const COMPANY_PATHS: Record<string, string> = {
  overview: "/sponsor",
  ledger: "/sponsor/ledger",
  people: "/sponsor/people",
  code: "/sponsor/code",
  pot: "/sponsor/pot",
  domains: "/sponsor/domains",
  settings: "/sponsor/settings",
  team: "/sponsor/team",
};

export function CompanyConsole({ initial = "overview", frame }: { initial?: string; frame?: { bodyClassName?: string } }) {
  const t = useT();
  const [tab, setTab] = useState(COMPANY_TABS.some((x) => x.key === initial) ? initial : "overview");

  return (
    <Desk
      sections={COMPANY_TABS.map((x) => ({ key: x.key, label: t(x.label), icon: x.icon }))}
      active={tab}
      onTab={setTab}
      path={COMPANY_PATHS[tab]}
      frame={frame}
      who={{ name: COMPANY.name, sub: t("sponsor.roleAdmin") }}
      never={{
        label: t("sponsor.neverLabel"),
        items: [t("sponsor.neverIndividual"), t("sponsor.neverAttendance"), t("sponsor.neverClinical")],
      }}
    >
      {tab === "overview" ? <CompanyOverview onTab={setTab} /> : null}
      {tab === "ledger" ? <CompanyLedger /> : null}
      {tab === "people" ? <CompanyPeople /> : null}
      {tab === "code" ? <CompanyCode /> : null}
      {tab === "pot" ? <CompanyPot /> : null}
      {tab === "domains" ? <CompanyDomains /> : null}
      {tab === "settings" ? <CompanySettings /> : null}
      {tab === "team" ? <CompanyTeam /> : null}
    </Desk>
  );
}

function CompanyOverview({ onTab }: { onTab: (key: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const date = useDate();
  const used = Math.round((COMPANY.spentEgp / COMPANY.putInEgp) * 100);

  return (
    <>
      <Head title={COMPANY.name} />
      <div className="grid gap-3 @3xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden p-4">
          <Glow className="-end-20 -top-20 h-48 w-48 opacity-40" />
          <div className="relative flex flex-col gap-3 @xs:flex-row @xs:items-center">
            <PotRing value={(100 - used) / 100} size={92} stroke={10}>
              <span className="text-[17px] font-bold tabular-nums text-navy-700">{100 - used}%</span>
            </PotRing>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[11.5px] font-semibold text-navy-400">{t("sponsor.balance")}</p>
                <Badge tone="teal">{t("sponsor.expires", { date: date(COMPANY.expiresOn) })}</Badge>
              </div>
              <p className="mt-0.5 text-[24px] leading-tight font-bold tracking-tight tabular-nums text-navy-700">
                {money(COMPANY.leftEgp)}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-navy-400">
                <span className="font-semibold text-navy-600">{t("sponsor.budgetTitle")}</span>
                {". "}
                {t("sponsor.budgetBody", { percent: used })}
              </p>
              <div className="mt-2">
                <Primary icon={Wallet} onClick={() => onTab("pot")}>
                  {t("sponsor.topUp")}
                </Primary>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-1">
          <Stat tone="dark" label={t("sponsor.spentTotal")}>
            {money(COMPANY.spentEgp)}
          </Stat>
          <Stat label={t("sponsor.sessionsTotal")}>{COMPANY.sessions}</Stat>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[14px] font-bold text-navy-700">{t("sponsor.spendTitle")}</p>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-navy-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
            {t("sponsor.whyWeekly")}
          </p>
        </div>
        <SpendHeatmap
          weeks={COMPANY_WEEKS.map((week) => ({
            weekStart: week.weekStart,
            label: formatCalendarDate(new Date(`${week.weekStart}T12:00:00Z`), "UTC", locale),
            spendCents: week.egp === null ? null : week.egp * 100,
          }))}
        />
      </Card>
    </>
  );
}

/** `/sponsor/ledger`: the figures, the months, the coverage mix and the top-ups. No names. */
function CompanyLedger() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const month = (iso: string) => formatMonthYear(`${iso}T12:00:00Z`, "UTC", locale);
  const topUps = COMPANY_TOPUPS.reduce((sum, row) => sum + row.egp, 0);

  return (
    <>
      <Head title={t("sponsor.nav.ledger")} subtitle={`${t("sponsor.ledgerBody")} ${t("sponsor.ledgerWeekly")}`} />
      <div className="grid grid-cols-2 gap-2.5 @3xl:grid-cols-3">
        <Stat tone="dark" label={t("sponsor.spentTotal")}>
          {money(COMPANY.spentEgp)}
        </Stat>
        {/* F7: totals over periods only; no average price and no employee share. */}
        <Stat label={t("sponsor.sessionsTotal")}>{COMPANY.sessions}</Stat>
        <Stat label={t("sponsor.ledgerTopUps")}>{money(topUps)}</Stat>
      </div>
      <div className="grid gap-2.5 @lg:grid-cols-2">
        <Card className="p-4">
          <p className="text-[14px] font-bold text-navy-700">{t("sponsor.ledgerByMonth")}</p>
          <ul className="mt-2 divide-y divide-navy-100 text-[12.5px] tabular-nums">
            {COMPANY_MONTHS.map((m) => (
              <li key={m.month} className="flex justify-between gap-3 py-2">
                <span className="text-navy-400">{month(m.month)}</span>
                <span className="text-navy-700">
                  {money(m.egp)} · {m.sessions}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <p className="text-[14px] font-bold text-navy-700">{t("sponsor.ledgerMix")}</p>
          <ul className="mt-2 divide-y divide-navy-100 text-[12.5px] tabular-nums">
            <li className="flex justify-between gap-3 py-2">
              <span className="text-navy-400">{COMPANY.coveragePercent}%</span>
              <span className="text-navy-700">{COMPANY.sessions}</span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}

/** `/sponsor/people`: who is enrolled, and nothing about their sessions. */
function CompanyPeople() {
  const t = useT();
  const locale = useLocale();
  const [held, setHeld] = useState<string[]>([]);
  return (
    <>
      <Head
        title={t("sponsor.roster")}
        subtitle={t("sponsor.rosterBody")}
        note={t("sponsor.rosterCountMany", { count: COMPANY_STAFF.length })}
      />
      <Card className="overflow-hidden p-0">
        <Rows>
          {COMPANY_STAFF.map((name) => {
            const paused = held.includes(name);
            return (
              <div key={name} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3.5 py-2.5">
                <Avatar name={name} size={30} />
                <p className="min-w-0 text-[13px] font-semibold text-navy-700">{demoName(name, locale)}</p>
                {paused ? <Badge tone="amber">{t("sponsor.pausedLabel")}</Badge> : null}
                <button
                  type="button"
                  onClick={() => setHeld((prev) => (paused ? prev.filter((x) => x !== name) : [...prev, name]))}
                  className="ms-auto inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-navy-500 ring-1 ring-navy-100 hover:bg-navy-50 hover:text-navy-700"
                >
                  {paused ? t("sponsor.resume") : t("sponsor.pause")}
                </button>
              </div>
            );
          })}
        </Rows>
      </Card>
      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-navy-400">
        <UserMinus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("sponsor.verifyCycle", { months: 6 })}
      </p>
    </>
  );
}

/** The real QR for the real joining link, drawn as squares: no image, no request. */
function useQr(text: string) {
  return useMemo(() => {
    const code = QRCode.create(text, { errorCorrectionLevel: "M" });
    const size = code.modules.size;
    const cells: [number, number][] = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (code.modules.get(x, y)) cells.push([x, y]);
      }
    }
    return { size, cells };
  }, [text]);
}

/** `/sponsor/code`: the poster, as `CodeCard` prints it. */
function CompanyCode() {
  const t = useT();
  const url = `24therapy.app/patient/benefit?code=${COMPANY.code}`;
  const qr = useQr(`https://${url}`);
  return (
    <div className="mx-auto max-w-md space-y-3">
      <Head title={t("sponsor.code")} subtitle={t("sponsor.codeBody")} />
      <Card className="p-4">
        <div className="flex flex-col items-center gap-3.5 py-2 text-center">
          <div className="rounded-3xl bg-white p-2.5 shadow-[0_8px_24px_-12px_rgba(10,35,66,0.18)] ring-1 ring-navy-100">
            <svg
              viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
              className="h-32 w-32 sm:h-36 sm:w-36"
              role="img"
              aria-label={COMPANY.code}
              shapeRendering="crispEdges"
            >
              <rect x={-2} y={-2} width={qr.size + 4} height={qr.size + 4} fill="#fff" />
              {qr.cells.map(([x, y]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#07182e" />
              ))}
            </svg>
          </div>
          <p
            dir="ltr"
            className="rounded-2xl bg-navy-50 px-4 py-2 font-mono text-[20px] font-bold tracking-[0.2em] text-navy-700 ring-1 ring-navy-100"
          >
            {COMPANY.code}
          </p>
          <p className="max-w-xs text-[12px] leading-relaxed text-navy-400">
            {t("sponsor.codePoster", { url, code: COMPANY.code })}
          </p>
        </div>
        <div className="mt-2 border-t border-navy-100 pt-3">
          <p className="text-[11.5px] font-semibold text-navy-400">
            {t("sponsor.attempts", { attempts: t("sponsor.attemptsCountMany", { count: 0 }) })}
          </p>
        </div>
      </Card>
    </div>
  );
}

/** `/sponsor/pot`: what is left of the last top-up, what you cover, and the terms. */
function CompanyPot() {
  const t = useT();
  const money = useMoney();
  const date = useDate();
  const [amount, setAmount] = useState(50_000);
  const last = COMPANY_TOPUPS[0]!;
  return (
    <>
      <Head title={t("sponsor.nav.pot")} />
      <Card className="p-4">
        <Meter
          usedLabel={money(COMPANY.leftEgp)}
          ofLabel={`${t("sponsor.funded")}: ${money(COMPANY.putInEgp)}`}
          fraction={COMPANY.spentEgp / COMPANY.putInEgp}
          note={t("sponsor.expiresOn", { date: date(COMPANY.expiresOn) })}
        />
      </Card>
      <Card className="p-4">
        <p className="text-[14px] font-bold text-navy-700">{t("sponsor.cov.title")}</p>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[26px] font-bold tabular-nums text-navy-700">{COMPANY.coveragePercent}%</span>
          <span className="text-[12px] text-navy-400">{t("sponsor.cov.ofSession", { rest: 0 })}</span>
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-navy-500">{t("sponsor.cov.quoted")}</p>
      </Card>
      {/* The top-up stepper: the step is the set of amounts accepted (76.1), so there is no box to type in. */}
      <Card className="p-4">
        <p className="text-[14px] font-bold text-navy-700">{t("sponsor.topUp")}</p>
        <p className="mt-0.5 text-[11.5px] text-navy-400">
          {t("dpo.lastTransfer", { amount: money(last.egp), date: date(last.on) })}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="-"
            disabled={amount <= 5_000}
            onClick={() => setAmount((n) => Math.max(5_000, n - 2_500))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-navy-100 bg-white text-[16px] font-bold text-navy-600 disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[7.5rem] rounded-xl bg-navy-50 px-3 py-1.5 text-center text-[15px] font-bold tabular-nums text-navy-700">
            {money(amount)}
          </span>
          <button
            type="button"
            aria-label="+"
            onClick={() => setAmount((n) => Math.min(250_000, n + 2_500))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-navy-100 bg-white text-[16px] font-bold text-navy-600"
          >
            +
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-navy-400">{t("sponsor.topUpBody", { min: money(5_000) })}</p>
      </Card>
      <Card className="p-4">
        <p className="text-[13px] font-bold text-navy-700">{t("sponsor.refundTerms")}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-navy-500">{t("dpo.refundPolicy")}</p>
      </Card>
    </>
  );
}

/** `/sponsor/domains`: Cairo Foundry lets people in from its staff list, so there are none. */
function CompanyDomains() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Head title={t("sponsor.domains.title")} subtitle={t("sponsor.domains.subtitle")} />
      <Card className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
          <Globe className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-[12.5px] leading-relaxed text-navy-500">{t("dpo.noDomains", { count: COMPANY_STAFF.length })}</p>
      </Card>
    </div>
  );
}

/** `/sponsor/settings`: how people join, and the setting that is not built. */
function CompanySettings() {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Head title={t("sponsor.settingsTitle")} />
      <Card className="overflow-hidden p-0">
        <Rows>
          {[
            { label: t("dpo.joinBy"), value: t("dpo.staffList", { count: COMPANY_STAFF.length }) },
            { label: t("sponsor.cov.title"), value: `${COMPANY.coveragePercent}%` },
            { label: t("dpo.whenPotEmpty"), value: t("dpo.payOwnWay") },
          ].map((row) => (
            <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-[12.5px] text-navy-500">{row.label}</span>
              <span className="text-[12.5px] font-semibold tabular-nums text-navy-700">{row.value}</span>
            </div>
          ))}
        </Rows>
      </Card>
      {/* Not built, and said so: a setting nobody can switch on is shown as exactly that. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-navy-200 bg-white/60 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[12.5px] text-navy-500">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {t("dpo.requireAttend")}
        </span>
        <span className="text-[11px] font-semibold text-navy-500">{t("dpo.notBuilt")}</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-navy-400">{t("sponsor.verifyCycle", { months: 6 })}</p>
    </div>
  );
}

/** `/sponsor/team`: the company's own logins. */
function CompanyTeam() {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Head title={t("sponsor.nav.team")} />
      <Card className="p-4">
        <ul className="divide-y divide-navy-100">
          <li className="flex flex-wrap items-center gap-2 py-2">
            <Avatar name={COMPANY.hr} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold text-navy-700">{demoName(COMPANY.hr, locale)}</span>
              <span className="block truncate text-[11px] text-navy-400">{COMPANY.hrEmail}</span>
            </span>
            <Badge tone="teal" className="ms-auto">
              {t("sponsor.roleAdmin")}
            </Badge>
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3">
          <span className="min-w-0 flex-1 truncate rounded-2xl border border-navy-100 bg-white px-3 py-2 text-[12px] text-navy-400">
            {t("sponsor.email")}
          </span>
          <Primary icon={UserPlus}>{t("sponsor.invite")}</Primary>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================ clinic == */

const CLINIC_GROUPS: { key: string; label: MessageKey; tabs: { key: string; label: MessageKey }[] }[] = [
  { key: "week", label: "clinic.nav.overview", tabs: [{ key: "week", label: "clinic.nav.overview" }] },
  {
    key: "people",
    label: "clinic.nav.people",
    tabs: [
      { key: "people", label: "clinic.nav.people" },
      { key: "team", label: "clinic.nav.team" },
    ],
  },
  {
    key: "bills",
    label: "clinic.nav.money",
    tabs: [
      { key: "bills", label: "clinic.nav.bills" },
      { key: "earnings", label: "clinic.nav.earnings" },
      { key: "seats", label: "clinic.nav.seats" },
    ],
  },
  { key: "records", label: "records.title", tabs: [{ key: "records", label: "records.title" }] },
];

const CLINIC_PATHS: Record<string, string> = {
  week: "/clinic",
  people: "/clinic/people",
  team: "/clinic/team",
  bills: "/clinic/bills",
  earnings: "/clinic/earnings",
  seats: "/clinic/seats",
  records: "/clinic/records",
};

export function ClinicConsole({ initial = "week", frame }: { initial?: string; frame?: { bodyClassName?: string } }) {
  const t = useT();
  const locale = useLocale();
  const known = CLINIC_GROUPS.flatMap((g) => g.tabs.map((x) => x.key));
  const [tab, setTab] = useState(known.includes(initial) ? initial : "week");
  const group = CLINIC_GROUPS.find((g) => g.tabs.some((x) => x.key === tab)) ?? CLINIC_GROUPS[0]!;

  return (
    <Desk
      sections={CLINIC_GROUPS.map((g) => ({ key: g.key, label: t(g.label) }))}
      active={group.key}
      onTab={(key) => {
        setTab(CLINIC_GROUPS.find((g) => g.key === key)?.tabs[0]?.key ?? "week");
      }}
      neverTone="light"
      path={CLINIC_PATHS[tab]}
      frame={frame}
      who={{ name: CLINIC.name, sub: demoName(CLINIC.manager, locale) }}
      never={{
        label: t("clinic.neverLabel"),
        items: [t("clinic.neverNote"), t("clinic.neverRisk"), t("clinic.neverContact")],
      }}
    >
      {group.tabs.length > 1 ? (
        <GroupTabs tabs={group.tabs.map((x) => ({ key: x.key, label: t(x.label) }))} active={tab} onTab={setTab} />
      ) : null}
      {tab === "week" ? <ClinicWeek /> : null}
      {tab === "people" ? <ClinicPeople /> : null}
      {tab === "team" ? <ClinicTeam /> : null}
      {tab === "bills" ? <ClinicBills /> : null}
      {tab === "earnings" ? <ClinicEarnings /> : null}
      {tab === "seats" ? <ClinicSeats /> : null}
      {tab === "records" ? <ClinicRecords /> : null}
    </Desk>
  );
}

function ClinicWeek() {
  const t = useT();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const week = CLINIC_WEEKS[index]!;
  const clinicians = new Set(week.rows.map((row) => row.clinician)).size;
  const when = (iso: string) => `${formatDay(new Date(iso), DEMO_ZONE, locale)}, ${formatTime(new Date(iso), DEMO_ZONE)}`;

  return (
    <>
      <Head
        title={t("clinic.scheduleTitle")}
        subtitle={t("clinic.scheduleBody")}
        action={<Ghost icon={Download}>{t("clinic.exportCsv")}</Ghost>}
      />
      <Card className="flex flex-wrap items-center justify-between gap-2 p-1.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="inline-flex h-8 items-center gap-1 rounded-xl px-2 text-[12px] font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t("clinic.prevWeek")}
        </button>
        <span className="order-first flex basis-full flex-col items-center pt-1 text-center @md:order-none @md:min-w-0 @md:flex-1 @md:basis-auto @md:pt-0">
          <span className="truncate text-[13px] font-bold text-navy-700">
            {t("clinic.week", { date: formatDay(new Date(week.monday), DEMO_ZONE, locale) })}
          </span>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-navy-400">
            <Clock className="h-3 w-3" aria-hidden />
            {t("clinic.timesIn", { zone: locale === "ar" ? "القاهرة" : "Cairo" })}
          </span>
        </span>
        <button
          type="button"
          disabled={index === CLINIC_WEEKS.length - 1}
          onClick={() => setIndex((i) => Math.min(CLINIC_WEEKS.length - 1, i + 1))}
          className="inline-flex h-8 items-center gap-1 rounded-xl px-2 text-[12px] font-semibold text-navy-600 hover:bg-navy-50 disabled:opacity-40"
        >
          {t("clinic.nextWeek")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </button>
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat tone="dark" label={t("clinic.hoursBooked")}>
          {week.rows.length}
        </Stat>
        <Stat label={t("clinic.onTheRota")}>{clinicians}</Stat>
      </div>
      <Card className="overflow-hidden">
        <Rows>
          {week.rows.map((row) => (
            <div key={`${row.at}${row.patient}`} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={row.patient} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-navy-700">{demoName(row.patient, locale)}</p>
                <p className="truncate text-[11.5px] text-navy-400">{demoName(row.clinician, locale)}</p>
              </div>
              <span className="shrink-0 text-end text-[11.5px] font-semibold tabular-nums text-navy-600">{when(row.at)}</span>
            </div>
          ))}
        </Rows>
      </Card>
    </>
  );
}

function ClinicPeople() {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <Head title={t("clinic.peopleTitle")} action={<Primary icon={UserPlus}>{t("clinic.inviteTitle")}</Primary>} />
      <Card className="overflow-hidden">
        <Rows>
          {CLINIC_TEAM.map((person) => (
            <div key={person.name} className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={person.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-navy-700">{demoName(person.name, locale)}</p>
                <p className="truncate text-[11px] text-navy-400">
                  {person.email} · {t("dpo.patientsCount", { count: person.patients })}
                </p>
              </div>
              <Badge tone={person.verify === "verified" ? "green" : "amber"} className="shrink-0">
                {person.verify === "verified" ? <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden /> : null}
                {t(person.verify === "verified" ? "clinic.verified" : "clinic.verifyPending")}
              </Badge>
            </div>
          ))}
        </Rows>
      </Card>
      <p className="text-[11.5px] leading-relaxed text-navy-500">{t("clinic.cannotVerify")}</p>
    </>
  );
}

function ClinicTeam() {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <Head title={t("clinic.team.title")} subtitle={t("clinic.team.body")} />
      <Card className="p-4">
        <p className="text-[13px] font-bold text-navy-700">{t("clinic.team.staffTitle")}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <Avatar name={CLINIC.manager} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-navy-700">{demoName(CLINIC.manager, locale)}</span>
            <span className="block truncate text-[11px] text-navy-400">{CLINIC.managerEmail}</span>
          </span>
          <Badge tone="teal">{t("clinic.team.isAdmin")}</Badge>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-navy-400">{t("clinic.team.adminSeesAll")}</p>
      </Card>
      <Card className="p-4">
        <p className="text-[13px] font-bold text-navy-700">{t("clinic.team.rolesTitle")}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-navy-400">{t("clinic.team.rolesEmpty")}</p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-navy-500">{t("clinic.team.neverDelegable")}</p>
      </Card>
    </>
  );
}

/** One bill for the seats, never a line per session (C263). */
function ClinicBills() {
  const t = useT();
  const money = useMoney();
  const monthly = egpFrom(CLINIC.seats * 7_200) / 100;
  return (
    <>
      <Head title={t("clinic.billsTitle")} subtitle={t("clinic.billsBody")} action={<Ghost icon={Download}>{t("clinic.exportCsv")}</Ghost>} />
      <Card className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
            <ReceiptText className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-[14px] font-bold text-navy-700">{t("clinic.nav.seats")}</p>
        </div>
        <ul className="mt-2 divide-y divide-navy-100/70 text-[12.5px]">
          {[
            { month: "September 2026", monthAr: "سبتمبر 2026", due: true },
            { month: "August 2026", monthAr: "أغسطس 2026", due: false },
          ].map((row) => (
            <li key={row.month} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 text-navy-500">
                <MonthLabel en={row.month} ar={row.monthAr} /> · {t("dpo.seatsAt", { count: CLINIC.seats, price: money(monthly / CLINIC.seats) })}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-navy-700">{money(monthly)}</span>
                {row.due ? <Badge tone="amber">{t("clinic.due")}</Badge> : <Badge tone="green">{t("dpo.paidLabel")}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-[11.5px] leading-relaxed text-navy-500">{t("dpo.oneTotal")}</p>
    </>
  );
}

function MonthLabel({ en, ar }: { en: string; ar: string }) {
  const locale = useLocale();
  return <>{locale === "ar" ? ar : en}</>;
}

function ClinicEarnings() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const total = CLINIC_TEAM.reduce((sum, row) => sum + row.earnedEgp, 0);
  const top = Math.max(...CLINIC_TEAM.map((row) => row.earnedEgp));
  return (
    <>
      <Head title={t("clinic.earn.title")} subtitle={t("clinic.earn.body")} />
      <Stat tone="dark" label={t("clinic.earn.combined")}>
        {money(total)}
      </Stat>
      <div className="grid gap-2.5 @2xl:grid-cols-2">
        {CLINIC_TEAM.map((row) => (
          <Card key={row.name} className="p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={row.name} size={34} />
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy-700">{demoName(row.name, locale)}</p>
              <p className="shrink-0 text-[15px] font-bold tabular-nums text-navy-700">{money(row.earnedEgp)}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((row.earnedEgp / top) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-navy-400">{t("clinic.earn.noWithdrawals")}</p>
          </Card>
        ))}
      </div>
      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-navy-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
        {t("clinic.earn.theirsOnly")}
      </p>
    </>
  );
}

function ClinicSeats() {
  const t = useT();
  const money = useMoney();
  const [seats, setSeats] = useState<number>(CLINIC.seats);
  const perSeat = egpFrom(7_200) / 100;
  return (
    <>
      <Head title={t("clinic.nav.seats")} />
      <Card className="flex items-center gap-4 p-4">
        <PotRing value={CLINIC.seats / seats} size={80} stroke={9}>
          <span dir="ltr" className="text-[20px] leading-none font-bold tabular-nums text-navy-700">
            {CLINIC.seats}/{seats}
          </span>
        </PotRing>
        <p className="min-w-0 text-[13px] font-bold text-navy-700">{t("clinic.seatsFilled", { filled: CLINIC.seats, invited: 0 })}</p>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="-"
            disabled={seats <= CLINIC.seats}
            onClick={() => setSeats((n) => Math.max(CLINIC.seats, n - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-navy-100 bg-white text-[16px] font-bold text-navy-600 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-8 text-center text-[18px] font-bold tabular-nums text-navy-700">{seats}</span>
          <button
            type="button"
            aria-label="+"
            onClick={() => setSeats((n) => Math.min(12, n + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-navy-100 bg-white text-[16px] font-bold text-navy-600"
          >
            +
          </button>
        </div>
        <p className="text-[12.5px] font-semibold tabular-nums text-navy-600">
          {t("dpo.seatsAt", { count: seats, price: money(perSeat) })} · {money(perSeat * seats)}
        </p>
      </Card>
    </>
  );
}

function ClinicRecords() {
  const t = useT();
  return (
    <div className="max-w-2xl space-y-3">
      <Head title={t("records.title")} subtitle={t("records.bodyClinic")} />
      <Card className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
          <FileText className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-[12.5px] leading-relaxed text-navy-500">{t("records.none")}</p>
      </Card>
    </div>
  );
}

/* ============================================================= therapist == */

const THERAPIST_TABS: { key: string; label: MessageKey; short?: MessageKey; icon: LucideIcon; primary?: boolean }[] = [
  { key: "today", label: "portal.nav.today", icon: Home, primary: true },
  { key: "schedule", label: "portal.nav.schedule", icon: CalendarDays, primary: true },
  { key: "patients", label: "portal.nav.patients", icon: Users, primary: true },
  { key: "money", label: "portal.nav.money", icon: Wallet },
  { key: "radar", label: "portal.nav.crisisRadar", icon: Radio },
  { key: "settings", label: "portal.nav.settings", icon: Settings },
];

/**
 * `/dashboard` as Dr Karim Nabil: the clinician's sidebar with New session over the
 * six destinations of `lib/nav/clinician.ts`, and on a phone the floating dock with
 * the raised plus and More.
 */
const THERAPIST_PATHS: Record<string, string> = {
  today: "/dashboard",
  new: "/sessions/new",
  schedule: "/sessions",
  patients: "/patients",
  money: "/earnings",
  radar: "/on-call",
  settings: "/settings",
};

export function TherapistConsole({ initial = "today", frame }: { initial?: string; frame?: { bodyClassName?: string } }) {
  const t = useT();
  const [tab, setTab] = useState(THERAPIST_TABS.some((x) => x.key === initial) ? initial : "today");
  const [chart, setChart] = useState<string | null>(initial === "chart" ? "Mariam Hassan" : null);
  const [more, setMore] = useState(false);

  const go = (key: string) => {
    setTab(key);
    setChart(null);
    setMore(false);
  };

  const dock = (
    <div className="absolute inset-x-2 bottom-2 z-20">
      {more ? (
        <div className="mb-2 rounded-[22px] bg-white p-2 shadow-[0_-20px_60px_-20px_rgba(3,11,23,0.45)] ring-1 ring-navy-100">
          {THERAPIST_TABS.filter((x) => !x.primary).map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => go(x.key)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-start",
                tab === x.key && "bg-brand-50 ring-1 ring-brand-100",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  tab === x.key ? "bg-brand-500 text-navy-600" : "bg-navy-50 text-navy-500",
                )}
              >
                <x.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-[12.5px] font-semibold text-navy-700">{t(x.label)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-around rounded-[22px] bg-navy-900/95 px-1.5 py-0.5 shadow-[0_20px_40px_-16px_rgba(3,11,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
        {THERAPIST_TABS.filter((x) => x.primary)
          .slice(0, 2)
          .map((x) => (
            <DockItem key={x.key} icon={x.icon} label={t(x.label)} on={tab === x.key && !more} onClick={() => go(x.key)} />
          ))}
        <button
          type="button"
          aria-label={t("portal.dash.start")}
          onClick={() => go("new")}
          className="-mt-6 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-navy-600 shadow-[0_10px_28px_-8px_rgba(46,196,182,0.9)] ring-4 ring-navy-50"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        {THERAPIST_TABS.filter((x) => x.primary)
          .slice(2)
          .map((x) => (
            <DockItem key={x.key} icon={x.icon} label={t(x.label)} on={tab === x.key && !more} onClick={() => go(x.key)} />
          ))}
        <DockItem
          icon={MoreHorizontal}
          label={t("portal.nav.more")}
          on={more || !THERAPIST_TABS.find((x) => x.key === tab)?.primary}
          onClick={() => setMore((x) => !x)}
        />
      </div>
    </div>
  );

  return (
    <Desk
      sections={THERAPIST_TABS.map((x) => ({ key: x.key, label: t(x.label), icon: x.icon }))}
      active={tab}
      onTab={go}
      who={{ name: KARIM.name, sub: KARIM.email, initials: "KN" }}
      path={THERAPIST_PATHS[tab]}
      frame={frame}
      phone="dock"
      dock={dock}
      top={
        <button
          type="button"
          onClick={() => go("new")}
          aria-current={tab === "new" ? "page" : undefined}
          className="relative mx-2.5 mb-4 flex h-10 items-center justify-center gap-2 rounded-2xl bg-white/10 text-[12.5px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
        >
          <Plus className="h-4 w-4 text-brand-300" aria-hidden />
          {t("portal.nav.newSession")}
        </button>
      }
    >
      {chart ? (
        <KarimChart name={chart} onBack={() => setChart(null)} />
      ) : (
        <>
          {tab === "today" ? <KarimToday onOpen={(name) => { setTab("patients"); setChart(name); }} /> : null}
          {tab === "new" ? <KarimNew /> : null}
          {tab === "schedule" ? <KarimSchedule /> : null}
          {tab === "patients" ? <KarimPatients onOpen={setChart} /> : null}
          {tab === "money" ? <KarimMoney /> : null}
          {tab === "radar" ? <KarimRadar /> : null}
          {tab === "settings" ? <KarimSettings /> : null}
        </>
      )}
    </Desk>
  );
}

function DockItem({ icon: Icon, label, on, onClick }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={cn(
        "my-1 flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        on ? "bg-white/10 text-brand-300" : "text-white/70",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className={cn("max-w-full truncate text-[9.5px]", on ? "font-semibold" : "font-medium")}>{label}</span>
    </button>
  );
}

function useSessionWhen() {
  const locale = useLocale();
  return (iso: string) => `${formatDay(new Date(iso), DEMO_ZONE, locale)}, ${formatTime(new Date(iso), DEMO_ZONE)}`;
}

function KarimToday({ onOpen }: { onOpen: (name: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const when = useSessionWhen();
  const recent = KARIM_SESSIONS.slice(0, 5);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-navy-400">{formatDay(new Date("2026-09-26T09:00:00Z"), DEMO_ZONE, locale)}</p>
          <h3 className="text-[20px] leading-tight font-bold tracking-tight text-navy-700">
            {t("portal.dash.hello", { name: locale === "ar" ? "كريم" : "Karim" })}
          </h3>
        </div>
        <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand-500 px-3.5 text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.8)]">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[12px] font-semibold">{t("portal.dash.start")}</span>
            <span className="text-[10px] font-medium text-navy-600">{t("portal.dash.startBlurb")}</span>
          </span>
        </span>
      </div>
      <div className="grid gap-3 @3xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3 @3xl:order-last">
          <Card className="flex items-center gap-3 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
              <Radio className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-navy-700">{t("portal.nav.crisisRadar")}</span>
              <span className="block text-[11.5px] text-navy-400">{t("portal.dash.radarOffBody")}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-navy-300 rtl:rotate-180" aria-hidden />
          </Card>
          <Card className="flex items-center gap-3 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-500 ring-1 ring-navy-100 ring-inset">
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-navy-700">{t("dpo.payAsYouGo")}</span>
              <span className="block text-[11.5px] text-navy-400">{t("portal.dash.monthMany", { count: 4 })}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-navy-300 rtl:rotate-180" aria-hidden />
          </Card>
        </div>
        <Card className="p-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-bold text-navy-700">{t("portal.dash.recent")}</p>
            <span className="text-[11.5px] font-semibold text-brand-700">{t("portal.all")}</span>
          </div>
          <ol className="relative mt-3 space-y-2 ps-5">
            <span aria-hidden className="absolute start-1.5 top-3 bottom-3 w-0.5 rounded-full bg-navy-100" />
            {recent.map((session) => (
              <li key={session.at} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -start-[18px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-4 ring-white",
                    session.upcoming ? "bg-brand-500" : "bg-navy-200",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onOpen(session.patient)}
                  className="flex w-full items-center gap-2.5 rounded-2xl bg-navy-50 p-2.5 text-start transition-colors hover:bg-navy-100"
                >
                  <Avatar name={session.patient} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-navy-700">{demoName(session.patient, locale)}</span>
                    <span className="block truncate text-[11px] text-navy-400">{when(session.at)}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

/**
 * `/sessions/new`: one field, then you are recording. Pick her, pick where, see what
 * the session leaves him, and start. Starting here only lights the card the dashboard
 * shows for a session in progress; it opens no room.
 */
function KarimNew() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const [who, setWho] = useState<string | null>(null);
  const [where, setWhere] = useState<"room" | "person">("room");
  const [live, setLive] = useState(false);
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
      on ? "bg-navy-600 text-white" : "bg-white text-navy-600 ring-1 ring-navy-100",
    );

  if (live && who) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-navy-900 p-3.5 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.7)]">
        <Avatar name={who} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">{demoName(who, locale)}</p>
          <p className="text-[11.5px] text-white/75">{where === "room" ? t("portal.new.whereRoom") : t("portal.new.whereInPerson")}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
          {t("portal.status.live")}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-3">
      <Head title={t("portal.sessions.newTitle")} subtitle={t("portal.sessions.newSubtitle")} />
      <Card className="space-y-3 p-4">
        <div>
          <p className="text-[12px] font-semibold text-navy-600">{t("tnew.existing")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {KARIM_PATIENTS.map((p) => (
              <button key={p.name} type="button" aria-pressed={who === p.name} onClick={() => setWho(p.name)} className={chip(who === p.name)}>
                {demoName(p.name, locale)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-navy-600">{t("portal.new.where")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={where === "room"} onClick={() => setWhere("room")} className={chip(where === "room")}>
              {t("portal.new.whereRoom")}
            </button>
            <button type="button" aria-pressed={where === "person"} onClick={() => setWhere("person")} className={chip(where === "person")}>
              {t("portal.new.whereInPerson")}
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-navy-50 p-3">
          <p className="flex justify-between gap-2 text-[12px] text-navy-500">
            {t("tnew.price")}
            <span className="font-bold tabular-nums text-navy-700">{money(KARIM.priceEgp)}</span>
          </p>
          <p className="mt-1 text-[11.5px] text-navy-500">
            {t("tnew.youKeep", { amount: money(KARIM.keepsEgp) })} ·{" "}
            {t("tnew.ourFee", { amount: money(KARIM.priceEgp - KARIM.keepsEgp), percent: 15 })}
          </p>
        </div>
        <button
          type="button"
          disabled={who === null}
          onClick={() => setLive(true)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 text-[13px] font-semibold text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.8)] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("tnew.startNow")}
        </button>
      </Card>
    </div>
  );
}

function KarimSchedule() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const when = useSessionWhen();
  const [which, setWhich] = useState<"sessions" | "bookings">("sessions");
  return (
    <>
      <GroupTabs
        tabs={[
          { key: "sessions", label: t("portal.nav.sessions") },
          { key: "bookings", label: t("portal.nav.bookings") },
        ]}
        active={which}
        onTab={(key) => setWhich(key as "sessions" | "bookings")}
      />
      <Head title={which === "sessions" ? t("portal.nav.sessions") : t("portal.nav.bookings")} />
      <Card className="overflow-hidden">
        <Rows>
          {(which === "sessions" ? KARIM_SESSIONS : KARIM_SESSIONS.filter((s) => s.upcoming)).map((session) => (
            <div key={session.at} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={session.patient} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-navy-700">{demoName(session.patient, locale)}</p>
                <p className="truncate text-[11px] text-navy-400">{when(session.at)}</p>
              </div>
              <span className="shrink-0 text-end">
                <span className="block text-[12px] font-bold tabular-nums text-navy-700">{money(KARIM.priceEgp)}</span>
                <Badge tone={session.upcoming ? "teal" : "green"}>{session.upcoming ? t("dpo.booked") : t("dpo.paidLabel")}</Badge>
              </span>
            </div>
          ))}
        </Rows>
      </Card>
    </>
  );
}

function KarimPatients({ onOpen }: { onOpen: (name: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const date = useDate();
  return (
    <>
      <Head title={t("portal.patients.title")} subtitle={t("portal.patients.subtitle", { count: KARIM_PATIENTS.length })} />
      <Card className="overflow-hidden">
        <Rows>
          {KARIM_PATIENTS.map((patient) => (
            <button
              key={patient.name}
              type="button"
              onClick={() => onOpen(patient.name)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start transition-colors hover:bg-navy-50"
            >
              <Avatar name={patient.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-navy-700">{demoName(patient.name, locale)}</span>
                <span className="block truncate text-[11px] text-navy-400">
                  {t("dpo.sessionsLast", { count: patient.sessions, date: date(patient.last) })}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
            </button>
          ))}
        </Rows>
      </Card>
    </>
  );
}

/** Her chart as he sees it: the standing observations, and the copilot answer with its source. */
function KarimChart({ name, onBack }: { name: string; onBack: () => void }) {
  const t = useT();
  const locale = useLocale();
  const date = useDate();
  const [asked, setAsked] = useState(false);
  const mariam = name === "Mariam Hassan";
  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy-500">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t("portal.patients.title")}
      </button>
      <div className="flex items-center gap-3">
        <Avatar name={name} size={44} />
        <div className="min-w-0">
          <h3 className="truncate text-[19px] font-bold tracking-tight text-navy-700">{demoName(name, locale)}</h3>
          <p className="truncate text-[11.5px] text-navy-400">
            {mariam ? t("dpo.chartLine", { count: 4, employer: COMPANY.name }) : t("dpo.chartLine", { count: 2, employer: COMPANY.name })}
          </p>
        </div>
      </div>
      {mariam ? (
        <>
          <Card className="p-3.5">
            <p className="text-[13px] font-bold text-navy-700">{t("dpo.observations")}</p>
            <ul className="mt-2 space-y-2">
              {MARIAM_OBSERVATIONS.map((row) => (
                <li key={row.at} className="rounded-2xl bg-navy-50 p-2.5">
                  <p className="text-[10.5px] font-semibold tracking-wide text-brand-700 uppercase rtl:tracking-normal">{date(row.at)}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-navy-600">{row.text[locale]}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy-700">
              <Sparkles className="h-4 w-4 text-brand-700" aria-hidden />
              {t("portal.nav.copilot")}
            </p>
            <p className="mt-2 rounded-2xl bg-navy-900 px-3 py-2 text-[12px] leading-relaxed text-white">
              {MARIAM_COPILOT.question[locale]}
            </p>
            {asked ? (
              <div className="mt-2 rounded-2xl bg-navy-50 p-3">
                <p className="text-[12px] leading-relaxed text-navy-700">{MARIAM_COPILOT.answer[locale]}</p>
                <p className="mt-2 border-s-2 border-brand-400 ps-2 text-[11px] leading-relaxed text-navy-500">
                  {date(MARIAM_COPILOT.cite.on)} · “{MARIAM_COPILOT.cite.quote[locale]}”
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <Primary icon={Send} onClick={() => setAsked(true)}>
                  {t("dpo.ask")}
                </Primary>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="overflow-hidden">
          <Rows>
            {KARIM_SESSIONS.filter((s) => s.patient === name).map((s) => (
              <div key={s.at} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12px]">
                <span className="text-navy-600">{date(s.at)}</span>
                <Badge tone="green">{t("dpo.paidLabel")}</Badge>
              </div>
            ))}
          </Rows>
        </Card>
      )}
    </>
  );
}

/** `/earnings`: what each session paid him, and the fee beside it. */
function KarimMoney() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const date = useDate();
  const held = KARIM_SESSIONS.filter((s) => !s.upcoming);
  const fee = KARIM.priceEgp - KARIM.keepsEgp;
  return (
    <>
      <Head title={t("portal.earnings.title")} subtitle={t("portal.earnings.subtitle")} />
      <div className="grid grid-cols-2 gap-2.5">
        <Stat tone="dark" label={t("dpo.youKept")}>
          {money(KARIM.keepsEgp * held.length)}
        </Stat>
        <Stat label={t("dpo.paidSessions")}>{held.length}</Stat>
      </div>
      <Card className="p-3.5">
        <p className="text-[12px] font-semibold text-navy-500">{t("dpo.perSession", { price: money(KARIM.priceEgp) })}</p>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full">
          <div className="h-full bg-brand-500" style={{ width: `${(KARIM.keepsEgp / KARIM.priceEgp) * 100}%` }} />
          <div className="h-full flex-1 bg-slate-400" />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11.5px]">
          <span className="flex items-center gap-1.5 text-navy-600">
            <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
            {t("tnew.youKeep", { amount: money(KARIM.keepsEgp) })}
          </span>
          <span className="flex items-center gap-1.5 text-navy-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
            {t("tnew.ourFee", { amount: money(fee), percent: 15 })}
          </span>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <Rows>
          {held.map((session) => (
            <div key={session.at} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12px]">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-navy-700">{demoName(session.patient, locale)}</span>
                <span className="block text-[10.5px] text-navy-400">
                  {date(session.at)} · {t("dpo.paidByBenefit", { name: COMPANY.name })}
                </span>
              </span>
              <span className="shrink-0 text-end tabular-nums">
                <span className="block font-bold text-navy-700">{money(KARIM.keepsEgp)}</span>
                <span className="block text-[10.5px] text-navy-400">{money(KARIM.priceEgp)}</span>
              </span>
            </div>
          ))}
        </Rows>
      </Card>
    </>
  );
}

function KarimRadar() {
  const t = useT();
  const [online, setOnline] = useState(false);
  return (
    <>
      <Head title={t("portal.nav.crisisRadar")} />
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl p-4",
          online ? "bg-navy-900 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.7)]" : "border border-navy-100/80 bg-white",
        )}
      >
        {online ? <Glow className="-end-20 -top-20 h-56 w-56 opacity-60" /> : null}
        <div className="relative flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
              online ? "bg-brand-500 text-navy-600 ring-brand-400" : "bg-navy-50 text-navy-500 ring-navy-100",
            )}
          >
            <Radio className={cn("h-5 w-5", online && "live-dot")} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-[14px] font-bold", online ? "text-white" : "text-navy-700")}>
              {online ? t("portal.dash.radarOnline") : t("portal.nav.crisisRadar")}
            </span>
            <span className={cn("block text-[12px]", online ? "text-white/75" : "text-navy-400")}>
              {online ? t("portal.dash.radarOnBody") : t("portal.dash.radarOffBody")}
            </span>
          </span>
        </div>
        <button
          type="button"
          aria-pressed={online}
          onClick={() => setOnline((x) => !x)}
          className={cn(
            "relative mt-3 inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-semibold",
            online ? GO_OFFLINE : GO_ONLINE,
          )}
        >
          {online ? t("dpo.goOffline") : t("dpo.goOnline")}
        </button>
      </div>
    </>
  );
}

/* The availability toggle. Online it sits on the dark card with white ink; offline it is
 * the teal ground with navy ink, never white on teal. */
const GO_OFFLINE = "bg-white/10 text-white ring-1 ring-white/15";
const GO_ONLINE = "bg-brand-500 text-navy-700";

function KarimSettings() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  return (
    <div className="max-w-xl space-y-3">
      <Head title={t("portal.nav.settings")} />
      <Card className="overflow-hidden p-0">
        <Rows>
          {[
            { label: t("dpo.yourPrice"), value: money(KARIM.priceEgp) },
            { label: t("dpo.languages"), value: locale === "ar" ? "العربية، الإنجليزية" : "Arabic, English" },
            { label: t("dpo.licence"), value: "EG-PSY-20417" },
            { label: t("dpo.payoutTo"), value: "InstaPay · karim.nabil@instapay" },
          ].map((row) => (
            <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-[12.5px] text-navy-500">{row.label}</span>
              <span dir="auto" className="text-[12.5px] font-semibold text-navy-700">
                {row.value}
              </span>
            </div>
          ))}
        </Rows>
      </Card>
    </div>
  );
}

/* =============================================================== partner == */

const PARTNER_TABS: { key: string; label: MessageKey; icon: LucideIcon }[] = [
  { key: "keys", label: "dev.nav.keys", icon: KeyRound },
  { key: "deliveries", label: "dev.nav.deliveries", icon: Send },
];

export function PartnerConsole({ initial = "keys", frame }: { initial?: string; frame?: { bodyClassName?: string } }) {
  const t = useT();
  const [tab, setTab] = useState(initial);
  return (
    <Desk
      sections={PARTNER_TABS.map((x) => ({ key: x.key, label: t(x.label), icon: x.icon }))}
      active={tab}
      onTab={setTab}
      who={{ name: DEMO_ORGS.partner, sub: t("dev.roleAdmin") }}
      path="/partner"
      frame={frame}
      never={{ label: t("devs.keysNote"), items: [] }}
    >
      {tab === "keys" ? <PartnerKeys /> : <PartnerDeliveries />}
    </Desk>
  );
}

function PartnerKeys() {
  const t = useT();
  return (
    <>
      <Head title={t("dev.keysTitle")} action={<Primary icon={Plus}>{t("dev.newKey")}</Primary>} />
      <div className="space-y-2.5">
        {PARTNER_KEYS.map((key, i) => (
          <motion.div
            key={key.prefix}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...soft, delay: i * 0.06 }}
          >
            <Card className="p-3.5">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                    key.live ? "bg-navy-700 text-brand-300 ring-navy-600" : "bg-navy-50 text-navy-500 ring-navy-100",
                  )}
                >
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge tone={key.live ? "green" : "slate"}>{key.live ? t("dev.live") : t("dev.sandbox")}</Badge>
                    <span className="font-mono text-[13px] text-navy-500">{key.prefix}</span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {key.scopes.map((scope) => (
                      <li key={scope} className="rounded-lg bg-navy-50 px-2 py-0.5 font-mono text-[11.5px] text-navy-600">
                        {scope}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-navy-400">{t("dev.lastUsed", { date: key.usedAt })}</p>
                </div>
                <span className="hidden shrink-0 items-center gap-1 rounded-xl border border-navy-100 px-2.5 py-1.5 text-[12px] font-semibold text-navy-600 sm:inline-flex">
                  <RotateCw className="h-3.5 w-3.5" aria-hidden />
                  {t("dev.rotate")}
                </span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  );
}

type Filter = "all" | "delivered" | "pending";

function PartnerDeliveries() {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const pill = useId();
  const shown = PARTNER_DELIVERIES.filter((row) => filter === "all" || row.state === filter);
  const options: { id: Filter; label: string; n?: number }[] = [
    { id: "all", label: t("portal.all") },
    { id: "delivered", label: t("dev.delivered"), n: PARTNER_DELIVERIES.filter((d) => d.state === "delivered").length },
    { id: "pending", label: t("dev.pending"), n: PARTNER_DELIVERIES.filter((d) => d.state === "pending").length },
  ];

  return (
    <>
      <Head title={t("dev.nav.deliveries")} />
      <LayoutGroup id={pill}>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((option) => {
            const on = option.id === filter;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(option.id);
                }}
                className={cn(
                  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  on ? "bg-navy-600 text-white" : "bg-white text-navy-600 ring-1 ring-navy-100",
                )}
              >
                {option.label}
                {option.n !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                      on ? "bg-white/15 text-white" : "bg-navy-50 text-navy-500",
                    )}
                  >
                    {option.n}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      <motion.ul layout className="flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((row) => (
            <motion.li
              key={`${row.event}${row.at}`}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={spring}
            >
              <Card className={cn("p-3", row.state === "pending" && "border-amber-300")}>
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "w-12 shrink-0 rounded-lg py-1 text-center font-mono text-[12px] font-bold",
                      row.state === "delivered" ? "bg-brand-100 text-brand-900" : "bg-amber-100 text-navy-700",
                    )}
                  >
                    {row.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <code className="font-mono text-[12.5px] font-semibold text-navy-700">{row.event}</code>
                      <Badge tone={row.state === "delivered" ? "green" : "amber"}>
                        {row.state === "delivered" ? t("dev.delivered") : t("dev.pending")}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11.5px] break-all text-navy-500">
                      {row.subject} · {row.at}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-navy-400">{t("dev.attempts", { count: String(row.attempts) })}</p>
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </>
  );
}
