"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Download,
  Hourglass,
  Lock,
  Plus,
  QrCode,
  Receipt,
  Settings2,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { Meter } from "@/components/visual/primitives";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  CLINIC_BILL,
  CLINIC_TEAM,
  CLINIC_WEEK,
  COMPANY_CODE,
  COMPANY_PAID,
  POT,
  SPEND_CURVE,
} from "@/lib/marketing/fixtures";
import { cn } from "@/lib/utils";

/**
 * 🔴 76.71 — THE CLINIC AND COMPANY CONSOLES, DRAWN AS CONSOLES.
 *
 * ## What was there, and why it said nothing
 *
 * The clinic demo was the numeral **11** above the word "seats", and a panel of
 * two lists headed "sees / never sees". The company demo was a meter and a bar
 * chart. Every one of those is true and none of them answers the question a
 * practice manager or an HR lead actually arrives with, which is *what am I
 * looking at on a Tuesday morning*. The founder's word for them was that they
 * "don't communicate anything", and that was the correct reading.
 *
 * ## What is here instead
 *
 * A portal: a left sidebar carrying the real navigation, screens you can move
 * between, tables with real rows, and the buttons that are actually on those
 * screens. Someone can look at this and know what they bought.
 *
 * ## The absences are drawn too
 *
 * A clinic screen with no clinical column, and a company screen with no patient
 * name on it, are the two hardest things to communicate about this product, and
 * they are invisible by nature: an absence photographs as nothing at all. So
 * each console carries a locked strip naming what its portal will never show,
 * in the portal's own words. That is not marketing copy bolted on; `clinic.never*`
 * and `sponsor.never*` are strings the real chrome renders at the foot of every
 * page.
 *
 * ## It fetches nothing
 *
 * The rule every demo on this site is held to. Props and fixtures, no action, no
 * route, nothing that could reach a row. The tabs move local state.
 */

/**
 * Whole dollars, grouped by hand.
 *
 * 🔴 C84, and `verify:sprint12` caught this file breaking it. `Intl` with an
 * explicit `"en-US"` in a CLIENT file is banned, because in a diff it is
 * indistinguishable from the `undefined` that means "ask whatever machine is
 * running this" — and that machine is the server on the first pass and the
 * browser on the second, so the two passes can format the same number two
 * different ways and React reports a hydration mismatch. The same argument as
 * `fmtUsd` in `components/sponsor/coverage-form.tsx`, which is where this
 * shape comes from.
 *
 * No cents, because every figure on these two consoles is a whole-dollar total
 * a finance team or a practice manager reads.
 */
function money(cents: number): string {
  const whole = String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}`;
}

/* ────────────────────────────────────────────────────────────── the shell ── */

type Tab = { key: string; label: string; icon: typeof Users };

function Shell({
  org,
  kind,
  tabs,
  active,
  onTab,
  never,
  children,
}: {
  org: string;
  kind: string;
  tabs: Tab[];
  active: string;
  onTab: (key: string) => void;
  never: { label: string; items: string[] };
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 bg-slate-50 text-slate-900">
      {/*
       * The sidebar. Narrow, and it collapses to icons rather than disappearing
       * on a phone: a portal demo whose navigation vanishes at the width most
       * people read marketing pages on is a demo of a different product.
       */}
      <nav className="flex w-14 shrink-0 flex-col border-e border-slate-200 bg-white sm:w-48">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-500 text-[11px] font-bold text-white">
            {org.slice(0, 1)}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-[13px] font-bold">{org}</span>
            <span className="block text-[10px] font-medium tracking-wide text-slate-600 uppercase">
              {kind}
            </span>
          </span>
        </div>

        <div className="flex-1 space-y-0.5 p-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { onTab(key); }}
              aria-current={key === active ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors",
                key === active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/*
         * 🔴 The wall, at the foot of the sidebar, exactly where the real chrome
         * puts it. It is drawn greyed and locked because it is not a setting
         * somebody could turn on: `clinic.neverBuilt` says "not a setting: it is
         * not built", and the picture should say the same thing.
         */}
        <div className="hidden border-t border-slate-100 px-3 py-3 sm:block">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-slate-600 uppercase">
            <Lock className="h-3 w-3" aria-hidden />
            {never.label}
          </p>
          <ul className="mt-1.5 space-y-1">
            {never.items.map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
                <X className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Head({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {action}
    </div>
  );
}

/**
 * What a clinic row says under a clinician's name, now that it is not a
 * session count. The three states the real portal shows, and nothing else.
 */
const VERIFY_LINE = {
  verified: "clinic.verified",
  pending: "clinic.verifyPending",
  none: "clinic.verifyNone",
} as const;

function Primary({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Plus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

function Ghost({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Plus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold tracking-wide text-slate-600 uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] text-slate-600">{note}</p> : null}
    </div>
  );
}

const PILL: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  grey: "bg-slate-100 text-slate-600",
};

function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────── the clinic ── */

const CLINIC_TABS: { key: string; label: MessageKey; icon: typeof Users }[] = [
  { key: "week", label: "clinic.nav.overview", icon: CalendarDays },
  { key: "people", label: "clinic.nav.people", icon: Stethoscope },
  { key: "earnings", label: "clinic.nav.earnings", icon: Wallet },
  { key: "bills", label: "clinic.nav.bills", icon: Receipt },
];

export function ClinicConsole() {
  const t = useT();
  const [tab, setTab] = useState("week");

  return (
    <Shell
      org="Nile Practice"
      kind={t("dpo.clinicKind")}
      tabs={CLINIC_TABS.map((x) => ({ ...x, label: t(x.label) }))}
      active={tab}
      onTab={setTab}
      never={{
        label: t("clinic.neverLabel"),
        items: [t("clinic.neverNote"), t("clinic.neverRisk")],
      }}
    >
      {tab === "week" ? <ClinicWeek /> : null}
      {tab === "people" ? <ClinicPeople /> : null}
      {tab === "earnings" ? <ClinicEarnings /> : null}
      {tab === "bills" ? <ClinicBills /> : null}
    </Shell>
  );
}

function ClinicWeek() {
  const t = useT();
  return (
    <>
      <Head
        title={t("clinic.week", { date: "9 March" })}
        action={<Ghost icon={Download}>{t("dpo.export")}</Ghost>}
      />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label={t("dpo.appointments")} value="34" note={t("dpo.thisWeek")} />
          <Stat
            label={t("dpo.clinicians")}
            value="4"
            note={t("dpo.ofSeats", { count: CLINIC_BILL.seats })}
          />
          <Stat
            label={t("dpo.billed")}
            value={money(CLINIC_BILL.totalCents)}
            note={t("dpo.monthSoFar")}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[10px] font-bold tracking-wide text-slate-600 uppercase">
            <span>{t("dpo.when")}</span>
            <span>{t("dpo.clinician")}</span>
            <span>{t("dpo.patient")}</span>
            <span>{t("dpo.where")}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {CLINIC_WEEK.map((row) => (
              <li
                key={`${row.day}${row.time}${row.clinician}`}
                className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 px-3 py-2.5 text-[13px]"
              >
                <span className="flex items-center gap-1.5 tabular-nums text-slate-600">
                  <Clock className="h-3 w-3 text-slate-600" aria-hidden />
                  {row.day} {row.time}
                </span>
                <span className="font-medium break-words">{row.clinician}</span>
                <span className="text-slate-700 break-words">{row.patient}</span>
                <Pill tone="grey">{row.modality === "video" ? t("dpo.video") : t("dpo.inPerson")}</Pill>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

const VERIFY: Record<string, { tone: keyof typeof PILL; label: MessageKey }> = {
  verified: { tone: "green", label: "clinic.verified" },
  pending: { tone: "amber", label: "clinic.verifyPending" },
  none: { tone: "grey", label: "clinic.verifyNone" },
};

function ClinicPeople() {
  const t = useT();
  return (
    <>
      <Head
        title={t("clinic.peopleTitle")}
        action={<Primary icon={UserPlus}>{t("clinic.inviteTitle")}</Primary>}
      />
      <div className="space-y-3 p-4">
        <ul className="space-y-2">
          {CLINIC_TEAM.map((person) => (
            <li
              key={person.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {person.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{person.name}</span>
                  {/*
                    🔴 NOT a session count, and this line used to be one.

                    The real row is `components/clinic/people-list.tsx`, whose
                    doc comment at :32 is explicit about what a row does not
                    show: "No caseload size, no session count, no patient, no
                    rating, no earnings. A clinician's caseload is their own, and
                    a practice that could see 'Dr Salma: 14 patients' beside
                    'Dr Omar: 2' has a performance-management surface built out
                    of clinical volume."

                    This console renders under the heading "the real portal, so
                    a marketing page cannot show a product we do not have". It
                    was showing "46 sessions this month" beside a named
                    clinician: not merely a feature we do not have, a feature
                    the product exists to refuse. Advertising it is worse than
                    advertising nothing, because somebody buys on it.
                  */}
                  <span className="block text-[11px] text-slate-600">
                    {t(VERIFY_LINE[person.verify])}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Pill tone={VERIFY[person.verify]?.tone ?? "grey"}>
                  {person.verify === "verified" ? (
                    <BadgeCheck className="h-3 w-3" aria-hidden />
                  ) : null}
                  {t(VERIFY[person.verify]?.label ?? "clinic.verifyNone")}
                </Pill>
              </span>
            </li>
          ))}
        </ul>

        {/*
         * 🔴 C267 — the practice can SEE where verification got to and can never
         * finish it. The sentence is on the real screen, and it is here because
         * the commonest thing a practice asks us to do is exactly this.
         */}
        <p className="text-[11px] leading-relaxed text-slate-600">{t("clinic.cannotVerify")}</p>
      </div>
    </>
  );
}

const PAYOUT: Record<string, { tone: keyof typeof PILL; label: MessageKey }> = {
  requested: { tone: "amber", label: "dpo.payoutRequested" },
  paid: { tone: "green", label: "dpo.payoutPaid" },
  none: { tone: "grey", label: "dpo.payoutNone" },
};

function ClinicEarnings() {
  const t = useT();
  const total = CLINIC_TEAM.reduce((sum, row) => sum + row.earnedCents, 0);

  return (
    <>
      <Head
        title={t("clinic.nav.earnings")}
        action={<Ghost icon={Download}>{t("dpo.export")}</Ghost>}
      />
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold tracking-wide text-slate-600 uppercase">
            {t("clinic.earn.combined")}
          </p>
          {/* A sum of the rows below, never a second query that could disagree. */}
          <p className="mt-1 text-2xl font-bold tabular-nums">{money(total)}</p>
        </div>

        <ul className="space-y-2">
          {CLINIC_TEAM.filter((row) => row.earnedCents > 0).map((row) => (
            <li
              key={row.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{row.name}</span>
                <Pill tone={PAYOUT[row.payout]?.tone ?? "grey"}>
                  {t(PAYOUT[row.payout]?.label ?? "dpo.payoutNone")}
                </Pill>
              </span>
              <span className="text-[15px] font-bold tabular-nums">{money(row.earnedCents)}</span>
            </li>
          ))}
        </ul>

        {/*
         * 🔴 63.14 — and there is no button beside these figures, deliberately.
         * The practice reads what its clinicians have earned and cannot move a
         * penny of it: on the real page that is the type system rather than a
         * missing control, and a demo with a Withdraw button on it would be
         * advertising a capability that does not exist.
         */}
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {t("clinic.earn.theirsOnly")}
        </p>
      </div>
    </>
  );
}

function ClinicBills() {
  const t = useT();
  return (
    <>
      <Head
        title={t("clinic.nav.bills")}
        action={<Ghost icon={Download}>{t("dpo.downloadInvoice")}</Ghost>}
      />
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold">{CLINIC_BILL.period}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {t("dpo.seatsAt", {
                  count: CLINIC_BILL.seats,
                  price: money(CLINIC_BILL.seatCents),
                })}
              </p>
            </div>
            <Pill tone="green">
              <Check className="h-3 w-3" aria-hidden />
              {t("dpo.paidLabel")}
            </Pill>
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{money(CLINIC_BILL.totalCents)}</p>
        </div>

        {/* One total for the period, never a line per session. C260. */}
        <p className="text-[11px] leading-relaxed text-slate-600">{t("dpo.oneTotal")}</p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────── the company ── */

const COMPANY_TABS: { key: string; label: MessageKey; icon: typeof Users }[] = [
  { key: "overview", label: "sponsor.nav.overview", icon: Building2 },
  { key: "pot", label: "sponsor.nav.pot", icon: Banknote },
  { key: "code", label: "sponsor.nav.code", icon: QrCode },
  { key: "settings", label: "sponsor.nav.settings", icon: Settings2 },
];

export function CompanyConsole() {
  const t = useT();
  const [tab, setTab] = useState("overview");

  return (
    <Shell
      org="Nile Holdings"
      kind={t("dpo.sponsorKind")}
      tabs={COMPANY_TABS.map((x) => ({ ...x, label: t(x.label) }))}
      active={tab}
      onTab={setTab}
      never={{
        label: t("sponsor.neverLabel"),
        items: [t("sponsor.neverIndividual"), t("sponsor.neverAttendance")],
      }}
    >
      {tab === "overview" ? <CompanyOverview /> : null}
      {tab === "pot" ? <CompanyPot /> : null}
      {tab === "code" ? <CompanyCode /> : null}
      {tab === "settings" ? <CompanySettings /> : null}
    </Shell>
  );
}

function CompanyOverview() {
  const t = useT();

  return (
    <>
      <Head
        title={t("sponsor.nav.overview")}
        action={<Primary icon={Plus}>{t("sponsor.topUp")}</Primary>}
      />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat
            label={t("sponsor.balance")}
            value={money(POT.remainingCents)}
            note={t("sponsor.ofLastTopUp", { amount: money(POT.addedCents) })}
          />
          <Stat
            label={t("dpo.joined")}
            value={String(COMPANY_CODE.joined)}
            note={t("dpo.ofStaff", { count: COMPANY_CODE.employees })}
          />
          <Stat
            label={t("dpo.usedIt")}
            value={String(COMPANY_CODE.usedThisMonth)}
            note={t("dpo.thisMonth")}
          />
        </div>

        {/*
         * 🔴 65.17 — THE REAL CHART, not a drawing of one.
         *
         * `SpendHeatmap` is the component on `/sponsor`, C229's suppression rule
         * and all, so the third week comes back hatched here because the
         * component hatches it rather than because this file asked for a hatch.
         * The marketing page demonstrates the rule without anybody writing a
         * sentence about the rule, and it stops working the day the chart does.
         */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[10px] font-bold tracking-wide text-slate-600 uppercase">
            {t("sponsor.spendTitle")}
          </p>
          <SpendHeatmap
            weeks={SPEND_CURVE.map((point, index) => ({
              weekStart: `W${String(index + 1)}`,
              spendCents: index === 2 ? null : point.cents,
            }))}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
            <span className="text-[10px] font-bold tracking-wide text-slate-600 uppercase">
              {t("dpo.whereMoneyWent")}
            </span>
            <span className="text-[10px] font-bold tracking-wide text-slate-600 uppercase">
              {t("dpo.paid")}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {COMPANY_PAID.map((row) => (
              <li
                key={row.therapist}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]"
              >
                <span className="truncate font-medium">{row.therapist}</span>
                {/*
                  🔴 THE AMOUNT, NOT THE COUNT. This column was "14 · $840".
                  
                  `app/(sponsor)/sponsor/page.tsx:26` states the rule: SPEND,
                  NEVER SESSION COUNTS, NEVER PEOPLE (C228), with one exception
                  that is an all-time organisation-wide total identifying
                  nobody. A count beside a named clinician is neither.
                  
                  And the real portal cannot produce this column at all:
                  `lib/data/sponsors.ts:96` calls its select list "THE WALL" and
                  says in as many words that there is no therapist and no count
                  in it, with `verify:sprint53` asserting against that list by
                  name. The amount stays, because C227 below is right that you
                  are paying these clinicians and may see what you paid them.
                */}
                <span className="shrink-0 font-bold tabular-nums text-slate-900">
                  {money(row.cents)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/*
         * 🔴 C227 — THE SENTENCE THAT IS THE PRODUCT. Therapists and amounts,
         * because you are paying them. Not one name of anybody who went.
         */}
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {t("dpo.neverWhoWent")}
        </p>
      </div>
    </>
  );
}

function CompanyPot() {
  const t = useT();

  return (
    <>
      <Head
        title={t("sponsor.nav.pot")}
        action={<Primary icon={Plus}>{t("sponsor.topUp")}</Primary>}
      />
      <div className="space-y-3 p-4">
        {/* 65.17 again: `Meter` is the portal's own, so the demo cannot drift. */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Meter
            usedLabel={money(POT.remainingCents)}
            ofLabel={t("sponsor.ofLastTopUp", { amount: money(POT.addedCents) })}
            fraction={1 - POT.remainingCents / POT.addedCents}
            note={t("sponsor.expires", { date: POT.expiresLabel })}
          />
        </div>

        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {[
            {
              what: t("dpo.topUpRow"),
              when: "2 March",
              amount: `+${money(1_000_000)}`,
              tone: "green" as const,
            },
            {
              what: t("dpo.sessionsWeekOf", { date: "2 March" }),
              when: "9 March",
              amount: `-${money(61_000)}`,
              tone: "grey" as const,
            },
            {
              what: t("dpo.sessionsWeekOf", { date: "23 February" }),
              when: "2 March",
              amount: `-${money(49_000)}`,
              tone: "grey" as const,
            },
          ].map((row) => (
            <li key={row.what} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.what}</span>
                <span className="block text-[11px] text-slate-600">{row.when}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-bold tabular-nums",
                  row.tone === "green" ? "text-emerald-700" : "text-slate-900",
                )}
              >
                {row.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function CompanyCode() {
  const t = useT();
  return (
    <>
      <Head
        title={t("sponsor.code")}
        action={<Ghost icon={ArrowUpRight}>{t("dpo.share")}</Ghost>}
      />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          {/* A drawn QR, not an image: it weighs nothing and it scales. */}
          <span aria-hidden className="grid h-24 w-24 shrink-0 grid-cols-7 gap-0.5 rounded-lg bg-white p-1.5 ring-1 ring-slate-200">
            {QR.map((on, i) => (
              <span key={i} className={cn("rounded-[1px]", on ? "bg-navy-800" : "bg-transparent")} />
            ))}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-lg font-bold tracking-wider">{COMPANY_CODE.code}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
              {t("dpo.scanIt", { domain: COMPANY_CODE.domain })}
            </p>
            <p className="mt-2 text-[11px] text-slate-600">
              {t("dpo.joinedOf", { joined: COMPANY_CODE.joined, total: COMPANY_CODE.employees })}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
          <p className="text-[12px] leading-relaxed text-slate-600">{t("dpo.joiningTells")}</p>
        </div>
      </div>
    </>
  );
}

function CompanySettings() {
  const t = useT();
  return (
    <>
      <Head title={t("sponsor.nav.settings")} />
      <div className="space-y-2.5 p-4">
        {[
          { label: t("dpo.coveredPerYear"), value: "12" },
          { label: t("dpo.capPerSession"), value: money(6_000) },
          { label: t("dpo.whoEligible"), value: t("dpo.anyoneOn", { domain: COMPANY_CODE.domain }) },
          { label: t("dpo.whenPotEmpty"), value: t("dpo.payOwnWay") },
        ].map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <span className="text-[13px] text-slate-700">{row.label}</span>
            <span className="text-[13px] font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}

        {/*
         * 🔴 C244 — the setting that does not exist, shown as not existing.
         * Every sponsor asks for it. Drawing the row disabled says no more
         * clearly than any paragraph, and it is where a reader looks for it.
         */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {t("dpo.requireAttend")}
          </span>
          <span className="text-[11px] font-semibold text-slate-600">{t("dpo.notBuilt")}</span>
        </div>
      </div>
    </>
  );
}

/**
 * A 7×7 block pattern that reads as a QR code at this size.
 *
 * It is not a scannable code and is never presented as one: the real screen
 * renders a real code for a real organisation, and inventing a scannable one for
 * a marketing page would be printing a working joining link nobody owns.
 */
const QR: readonly boolean[] = [
  true, true, true, false, true, true, true,
  true, false, true, false, true, false, true,
  true, true, true, true, true, true, true,
  false, false, true, false, true, false, false,
  true, true, false, true, false, true, true,
  true, false, true, false, true, false, true,
  true, true, true, false, true, true, true,
];
