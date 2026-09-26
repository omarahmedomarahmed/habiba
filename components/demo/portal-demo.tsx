"use client";

import { useId, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Hourglass,
  KeyRound,
  Lock,
  Plus,
  QrCode,
  Receipt,
  RotateCw,
  Send,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { Count, MotionRoot, soft, spring } from "./motion";
import { Avatar, Badge, Card, Glow, Stat } from "@/components/clinician/kit";
import { PotRing } from "@/components/sponsor/ring";
import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { Meter, NeverBar } from "@/components/visual/primitives";
import { dateTag } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  CLINIC_BILL,
  CLINIC_TEAM,
  CLINIC_WEEK,
  COMPANY_CODE,
  DEMO_ORGS,
  PARTNER_DELIVERIES,
  PARTNER_KEYS,
  POT,
  SPEND_CURVE,
} from "@/lib/marketing/fixtures";
import { egp, egpFrom } from "@/lib/marketing/prices";
import { cn } from "@/lib/utils";

/**
 * 🔴 76.71 — THE CLINIC, COMPANY AND PARTNER DESKS AS THEIR PEOPLE SIT IN FRONT
 * OF THEM, in the redesign's clothes (`components/portal/desk-navy.tsx`).
 *
 * The navy rail with the teal selection sliding between sections, the wall of
 * what the portal never shows in a card of its own at the rail's foot, and
 * the pages drawn from the portal kit: the dark figure for the number that
 * matters most, rounded white cards, faces on the rota. The heatmap, the meter,
 * the pot ring and the wall are the portal's own components (65.17), so the
 * site cannot show a chart the product does not draw.
 *
 * Every figure is invented (`lib/marketing/fixtures.ts`) and shown in pounds
 * through the product's own rate (`lib/marketing/prices.ts`). None of it books,
 * pays or fetches anything.
 */

/** Pounds for a fixture held in US cents, in the page's language. */
function useMoney() {
  const locale = useLocale();
  return (usdCents: number) => egp(egpFrom(usdCents), locale);
}

/** The pot's expiry, written in the page's language. */
function potDate(locale: "en" | "ar"): string {
  return new Intl.DateTimeFormat(dateTag(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${POT.expiresOn}T00:00:00Z`),
  );
}

/* --------------------------------------------------------------- the desk -- */

type Tab = { key: string; label: string; icon: typeof Users };

function Shell({
  org,
  kind,
  tabs,
  active,
  onTab,
  wall,
  children,
}: {
  org: string;
  kind: string;
  tabs: Tab[];
  active: string;
  onTab: (key: string) => void;
  /** The card at the rail's foot: what this portal never shows, or for a partner, how keys are kept. */
  wall: React.ReactNode;
  children: React.ReactNode;
}) {
  const group = useId();
  return (
    <MotionRoot>
      <div className="flex h-full min-h-0 bg-navy-50 text-navy-700">
        {/*
          The rail: icons alone on a narrow screen, the words beside them once
          there is room, and the teal pill sliding to the section you press.
        */}
        <nav className="relative flex w-14 shrink-0 flex-col overflow-hidden bg-navy-900 text-white sm:w-52">
          <Glow className="-start-20 -top-20 h-48 w-48 opacity-70" />
          <div className="relative flex items-center gap-2.5 px-2.5 pt-3 pb-4 sm:px-3.5">
            <Avatar name={org} size={34} />
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-[13px] font-bold">{org}</span>
              <span className="block truncate text-[11px] text-white/70">{kind}</span>
            </span>
          </div>

          <LayoutGroup id={group}>
            <div className="relative flex-1 space-y-1 px-2 sm:px-2.5">
              {tabs.map(({ key, label, icon: Icon }) => {
                const on = key === active;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { onTab(key); }}
                    aria-current={on ? "page" : undefined}
                    aria-label={label}
                    className={cn(
                      "relative flex h-10 w-full items-center justify-center gap-2.5 rounded-xl px-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:justify-start",
                      on ? "text-navy-700" : "text-white/75 hover:text-white",
                    )}
                  >
                    {on ? (
                      <motion.span
                        layoutId="rail"
                        transition={spring}
                        className="absolute inset-0 rounded-xl bg-brand-500 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.9)]"
                      />
                    ) : null}
                    <Icon className="relative h-4 w-4 shrink-0" aria-hidden />
                    <span className="relative hidden truncate sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          {/* 🔴 The wall, on screen the whole time, in its own card at the rail's foot. */}
          <div className="relative hidden p-2.5 sm:block">
            {wall}
          </div>
        </nav>

        <div className="no-scrollbar relative min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={soft}
              className="space-y-3 p-3.5 sm:p-4"
            >
              {children}
              {/* No rail wide enough for the wall: it goes to the foot of the page, on the dark card. */}
              <div className="rounded-3xl bg-navy-900 p-1 sm:hidden">
                {wall}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionRoot>
  );
}

function Head({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="min-w-0 text-[18px] leading-tight font-bold tracking-tight text-navy-700">{title}</h3>
      {action}
    </div>
  );
}

function Primary({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Plus }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-[12.5px] font-semibold text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.8)]">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

function Ghost({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Plus }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-navy-100 bg-white px-3 text-[12.5px] font-semibold text-navy-600">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
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
          transition={{ ...spring, delay: i * 0.05 }}
        >
          {child}
        </motion.li>
      ))}
    </ul>
  );
}

/* ================================================================ clinic == */

const CLINIC_TABS: { key: string; label: MessageKey; icon: typeof Users }[] = [
  { key: "week", label: "clinic.nav.overview", icon: CalendarDays },
  { key: "people", label: "clinic.nav.people", icon: Stethoscope },
  { key: "earnings", label: "clinic.nav.earnings", icon: Wallet },
  { key: "bills", label: "clinic.nav.bills", icon: Receipt },
];

export function ClinicConsole({ initial = "week" }: { initial?: string }) {
  const t = useT();
  const [tab, setTab] = useState(initial);

  return (
    <Shell
      org={DEMO_ORGS.clinic}
      kind={t("dpo.clinicKind")}
      tabs={CLINIC_TABS.map((x) => ({ ...x, label: t(x.label) }))}
      active={tab}
      onTab={setTab}
      wall={
        <NeverBar label={t("clinic.neverLabel")} items={[t("clinic.neverNote"), t("clinic.neverRisk")]} tone="dark" />
      }
    >
      {tab === "week" ? <ClinicWeek /> : null}
      {tab === "people" ? <ClinicPeople /> : null}
      {tab === "earnings" ? <ClinicEarnings /> : null}
      {tab === "bills" ? <ClinicBills /> : null}
    </Shell>
  );
}

/**
 * 🔴 THE ROTA HAS THE REAL ROTA'S COLUMNS: who, with whom, and when. The real
 * `/clinic` rota never showed video or in person, so neither does this.
 */
function ClinicWeek() {
  const t = useT();
  const clinicians = new Set(CLINIC_WEEK.map((row) => row.clinician)).size;
  return (
    <>
      <Head title={t("clinic.scheduleTitle")} action={<Ghost icon={Download}>{t("dpo.export")}</Ghost>} />

      <Card className="flex items-center justify-between gap-2 p-1.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl text-navy-500">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </span>
        <span className="min-w-0 truncate text-[13.5px] font-bold text-navy-700">{t("clinic.week", { date: "9 March" })}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl text-navy-500">
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </span>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat tone="dark" label={t("clinic.hoursBooked")} className="p-4">
          <Count value={CLINIC_WEEK.length} />
        </Stat>
        <Stat label={t("clinic.onTheRota")} className="p-4">
          <Count value={clinicians} />
        </Stat>
      </div>

      <Card className="overflow-hidden">
        <Rows>
          {CLINIC_WEEK.map((row) => (
            <div key={`${row.day}${row.time}${row.clinician}`} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={row.patient} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-navy-700">{row.patient}</p>
                <p className="truncate text-[11.5px] text-navy-400">{row.clinician}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums text-navy-600">
                <Clock className="h-3 w-3 text-navy-400" aria-hidden />
                {row.day} {row.time}
              </span>
            </div>
          ))}
        </Rows>
      </Card>
    </>
  );
}

const VERIFY: Record<string, { tone: "green" | "amber" | "slate"; label: MessageKey }> = {
  verified: { tone: "green", label: "clinic.verified" },
  pending: { tone: "amber", label: "clinic.verifyPending" },
  none: { tone: "slate", label: "clinic.verifyNone" },
};

/**
 * 🔴 NOT a session count beside a name. The real row
 * (`components/clinic/people-list.tsx`) shows no caseload, no session count, no
 * patient and no earnings: a practice that could see "Dr Salma: 14 patients"
 * has a performance-management surface built out of clinical volume.
 */
function ClinicPeople() {
  const t = useT();
  return (
    <>
      <Head title={t("clinic.peopleTitle")} action={<Primary icon={UserPlus}>{t("clinic.inviteTitle")}</Primary>} />
      <Card className="overflow-hidden">
        <Rows>
          {CLINIC_TEAM.map((person) => (
            <div key={person.name} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={person.name} size={34} />
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy-700">{person.name}</p>
              <Badge tone={VERIFY[person.verify]?.tone ?? "slate"} className="max-w-[55%] shrink-0">
                {person.verify === "verified" ? <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden /> : null}
                {t(VERIFY[person.verify]?.label ?? "clinic.verifyNone")}
              </Badge>
            </div>
          ))}
        </Rows>
      </Card>
      <p className="text-[12px] leading-relaxed text-navy-500">{t("clinic.cannotVerify")}</p>
    </>
  );
}

const PAYOUT: Record<string, { tone: "green" | "amber" | "slate"; label: MessageKey }> = {
  requested: { tone: "amber", label: "dpo.payoutRequested" },
  paid: { tone: "green", label: "dpo.payoutPaid" },
  none: { tone: "slate", label: "dpo.payoutNone" },
};

function ClinicEarnings() {
  const t = useT();
  const money = useMoney();
  /* A sum of the rows below, never a second figure that could disagree. */
  const total = CLINIC_TEAM.reduce((sum, row) => sum + row.earnedCents, 0);

  return (
    <>
      <Head title={t("clinic.nav.earnings")} action={<Ghost icon={Download}>{t("dpo.export")}</Ghost>} />
      <Stat tone="dark" label={t("clinic.earn.combined")} className="p-4">
        {money(total)}
      </Stat>
      <Card className="overflow-hidden">
        <Rows>
          {CLINIC_TEAM.filter((row) => row.earnedCents > 0).map((row) => (
            <div key={row.name} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={row.name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-navy-700">{row.name}</p>
                <Badge tone={PAYOUT[row.payout]?.tone ?? "slate"} className="mt-0.5">
                  {t(PAYOUT[row.payout]?.label ?? "dpo.payoutNone")}
                </Badge>
              </div>
              <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-navy-700">{money(row.earnedCents)}</span>
            </div>
          ))}
        </Rows>
      </Card>
      <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-navy-500">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        {t("clinic.earn.theirsOnly")}
      </p>
    </>
  );
}

/** One total for the period, never a line per session (C260), on the dark card. */
function ClinicBills() {
  const t = useT();
  const money = useMoney();
  return (
    <>
      <Head title={t("clinic.nav.bills")} action={<Ghost icon={Download}>{t("dpo.downloadInvoice")}</Ghost>} />
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-4 text-white">
        <Glow className="-end-16 -top-16 h-44 w-44 opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/70">{CLINIC_BILL.period}</p>
            <p className="mt-0.5 text-[12px] text-white/70">
              {t("dpo.seatsAt", { count: CLINIC_BILL.seats, price: money(CLINIC_BILL.seatCents) })}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-bold text-navy-700">
            <Check className="h-3 w-3" aria-hidden />
            {t("dpo.paidLabel")}
          </span>
        </div>
        <p className="relative mt-3 text-[28px] leading-tight font-bold tabular-nums">{money(CLINIC_BILL.totalCents)}</p>
      </div>
      <p className="text-[12px] leading-relaxed text-navy-500">{t("dpo.oneTotal")}</p>
    </>
  );
}

/* =============================================================== company == */

const COMPANY_TABS: { key: string; label: MessageKey; icon: typeof Users }[] = [
  { key: "overview", label: "sponsor.nav.overview", icon: Building2 },
  { key: "pot", label: "sponsor.nav.pot", icon: Banknote },
  { key: "code", label: "sponsor.nav.code", icon: QrCode },
  { key: "settings", label: "sponsor.nav.settings", icon: Settings2 },
];

export function CompanyConsole({ initial = "overview" }: { initial?: string }) {
  const t = useT();
  /* A page asking for the wall (`company-wall`) gets the overview: the wall is in the rail beside it. */
  const [tab, setTab] = useState(COMPANY_TABS.some((x) => x.key === initial) ? initial : "overview");

  return (
    <Shell
      org={DEMO_ORGS.company}
      kind={t("dpo.sponsorKind")}
      tabs={COMPANY_TABS.map((x) => ({ ...x, label: t(x.label) }))}
      active={tab}
      onTab={setTab}
      wall={
        <NeverBar
          label={t("sponsor.neverLabel")}
          items={[t("sponsor.neverIndividual"), t("sponsor.neverAttendance")]}
          tone="dark"
        />
      }
    >
      {tab === "overview" ? <CompanyOverview /> : null}
      {tab === "pot" ? <CompanyPot /> : null}
      {tab === "code" ? <CompanyCode /> : null}
      {tab === "settings" ? <CompanySettings /> : null}
    </Shell>
  );
}

/**
 * The pot as a ring beside its figure, the spend as the dark figure, and the
 * weekly heatmap under them, as `/sponsor` draws them. 🔴 W3: no headcount and
 * no count of who used it; a company sees money by the week, never a person.
 */
function CompanyOverview() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const left = POT.remainingCents / POT.addedCents;
  const spent = SPEND_CURVE.reduce((sum, point) => sum + point.cents, 0);

  return (
    <>
      <Head title={t("sponsor.nav.overview")} action={<Primary icon={Plus}>{t("sponsor.topUp")}</Primary>} />

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden p-4">
          <Glow className="-end-20 -top-20 h-48 w-48 opacity-40" />
          <div className="relative flex items-center gap-4">
            <PotRing value={left} size={92} stroke={10}>
              <span className="text-[17px] font-bold tabular-nums text-navy-700">
                <Count value={Math.round(left * 100)} format={(n) => `${String(Math.round(n))}%`} />
              </span>
            </PotRing>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-navy-400">{t("sponsor.balance")}</p>
              <p className="mt-0.5 text-[20px] leading-tight font-bold tracking-tight tabular-nums text-navy-700 sm:text-[24px]">
                {money(POT.remainingCents)}
              </p>
              <Badge tone="teal" className="mt-1.5">{t("sponsor.expires", { date: potDate(locale) })}</Badge>
            </div>
          </div>
        </Card>
        <Stat tone="dark" label={t("sponsor.spentTotal")} className="p-4">
          {money(spent)}
        </Stat>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[14px] font-bold text-navy-700">{t("sponsor.spendTitle")}</p>
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-navy-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
            {t("sponsor.whyWeekly")}
          </p>
        </div>
        <div className="mt-3">
          <SpendHeatmap
            weeks={SPEND_CURVE.map((point, index) => {
              const week = `W${String(index + 1)}`;
              /* The third week is under the floor, so the real rule hatches it. */
              return { weekStart: week, label: week, spendCents: index === 2 ? null : egpFrom(point.cents) };
            })}
          />
        </div>
      </Card>
    </>
  );
}

function CompanyPot() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();

  return (
    <>
      <Head title={t("sponsor.nav.pot")} action={<Primary icon={Plus}>{t("sponsor.topUp")}</Primary>} />
      {/* 65.17 again: `Meter` is the portal's own, so the demo cannot drift. */}
      <Card className="p-4">
        <Meter
          usedLabel={money(POT.remainingCents)}
          ofLabel={t("sponsor.ofLastTopUp", { amount: money(POT.addedCents) })}
          fraction={1 - POT.remainingCents / POT.addedCents}
          note={t("sponsor.expires", { date: potDate(locale) })}
        />
      </Card>
      <Card className="overflow-hidden">
        <Rows>
          {[
            { what: t("dpo.topUpRow"), when: "2 March", amount: `+${money(1_000_000)}`, plus: true },
            { what: t("dpo.sessionsWeekOf", { date: "2 March" }), when: "9 March", amount: `-${money(61_000)}`, plus: false },
            { what: t("dpo.sessionsWeekOf", { date: "23 February" }), when: "2 March", amount: `-${money(49_000)}`, plus: false },
          ].map((row) => (
            <div key={row.what} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-navy-700">{row.what}</span>
                <span className="block text-[11px] text-navy-400">{row.when}</span>
              </span>
              <span className={cn("shrink-0 font-bold tabular-nums", row.plus ? "text-brand-700" : "text-navy-700")}>
                {row.amount}
              </span>
            </div>
          ))}
        </Rows>
      </Card>
    </>
  );
}

/** The joining code as the framed poster the portal prints. */
function CompanyCode() {
  const t = useT();
  return (
    <>
      <Head title={t("sponsor.code")} action={<Ghost icon={ArrowUpRight}>{t("dpo.share")}</Ghost>} />
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <span aria-hidden className="grid h-24 w-24 shrink-0 grid-cols-7 gap-0.5 rounded-2xl bg-white p-2 ring-4 ring-navy-900">
          {QR.map((on, i) => (
            <span key={i} className={cn("rounded-[1px]", on ? "bg-navy-900" : "bg-transparent")} />
          ))}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold tracking-wider text-navy-700">{COMPANY_CODE.code}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-navy-500">{t("dpo.scanIt", { domain: COMPANY_CODE.domain })}</p>
          <p className="mt-2 text-[11.5px] text-navy-400">{t("dpo.joinedOf", { joined: COMPANY_CODE.joined })}</p>
        </div>
      </Card>
      <Card className="flex items-start gap-2 p-3">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden />
        <p className="text-[12px] leading-relaxed text-navy-500">{t("dpo.joiningTells")}</p>
      </Card>
    </>
  );
}

function CompanySettings() {
  const t = useT();
  return (
    <>
      <Head title={t("sponsor.nav.settings")} />
      <Card className="overflow-hidden">
        <Rows>
          {[
            { label: t("sponsor.cov.title"), value: "80%" },
            { label: t("dpo.whoEligible"), value: t("dpo.anyoneOn", { domain: COMPANY_CODE.domain }) },
            { label: t("dpo.whenPotEmpty"), value: t("dpo.payOwnWay") },
          ].map((row) => (
            <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-[13px] text-navy-500">{row.label}</span>
              <span className="text-[13px] font-semibold tabular-nums text-navy-700">{row.value}</span>
            </div>
          ))}
        </Rows>
      </Card>
      {/* Not built, and said so: a setting nobody can switch on is shown as exactly that. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-navy-200 bg-white/60 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[13px] text-navy-500">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {t("dpo.requireAttend")}
        </span>
        <span className="text-[11.5px] font-semibold text-navy-500">{t("dpo.notBuilt")}</span>
      </div>
    </>
  );
}

const QR: readonly boolean[] = [
  true, true, true, false, true, true, true,
  true, false, true, false, true, false, true,
  true, true, true, true, true, true, true,
  false, false, true, false, true, false, false,
  true, true, false, true, false, true, true,
  true, false, true, false, true, false, true,
  true, true, true, false, true, true, true,
];

/* =============================================================== partner == */

const PARTNER_TABS: { key: string; label: MessageKey; icon: typeof Users }[] = [
  { key: "keys", label: "dev.nav.keys", icon: KeyRound },
  { key: "deliveries", label: "dev.nav.deliveries", icon: Send },
];

/**
 * A partner's desk: the keys as cards with their scopes, and the delivery log
 * with its filter, as `/partner` and `/partner/deliveries` draw them. The rail's
 * card carries the one sentence about keys the portal itself puts there.
 */
export function PartnerConsole({ initial = "keys" }: { initial?: string }) {
  const t = useT();
  const [tab, setTab] = useState(initial);
  return (
    <Shell
      org={DEMO_ORGS.partner}
      kind={t("dev.roleAdmin")}
      tabs={PARTNER_TABS.map((x) => ({ ...x, label: t(x.label) }))}
      active={tab}
      onTab={setTab}
      wall={
        /* A promise about keys, so a shield rather than the wall's crosses. */
        <p className="flex items-start gap-2 rounded-2xl bg-white/5 p-3.5 text-xs leading-relaxed text-white/80 ring-1 ring-white/10">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden />
          {t("devs.keysNote")}
        </p>
      }
    >
      {tab === "keys" ? <PartnerKeys /> : <PartnerDeliveries />}
    </Shell>
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
                onClick={() => { setFilter(option.id); }}
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
                    <p className="mt-1 break-all font-mono text-[11.5px] text-navy-500">
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
