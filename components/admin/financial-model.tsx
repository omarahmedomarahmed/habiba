"use client";

import { useMemo, useState, useTransition } from "react";

import { saveScenarioAction, takeBenchmarkAction } from "@/app/(admin)/admin/financial-model/actions";
import { Badge, Card } from "@/components/ui";
import type { Assumptions, Hire, Provenance } from "@/lib/finance/assumptions";
import { count, usd } from "@/lib/finance/format";
import { forecast, type MonthRow } from "@/lib/finance/model";

/**
 * The forecast, on a screen somebody can move.
 *
 * ## 🔴 Every number carries where it came from
 *
 * A forecast that cannot tell you which of its inputs were measured is a
 * spreadsheet with a logo on it. Each input shows `measured`, `assumed` or
 * `derived`, and the measured ones carry the date and the sample size, because
 * "measured" on thirty-five sessions and "measured" on thirty-five thousand are
 * different claims.
 *
 * ## It recomputes here, not on the server
 *
 * `forecast()` is pure and cheap, so moving a slider re-runs all thirty-six
 * months in front of the reader. A round trip per keystroke would make the
 * dependency graph feel like a form rather than a model, and the whole point is
 * that changing one number moves fourteen others where you can see it happen.
 */
export function FinancialModel({
  scenarios,
  measuredOn,
  benchmarkSource,
  couldNotMeasure,
}: {
  scenarios: { slug: string; name: string; assumptions: Assumptions; shipped: boolean }[];
  measuredOn: string | null;
  benchmarkSource: { completedSessions: number; therapists: number; monthsOfHistory: number } | null;
  couldNotMeasure: string[];
}) {
  const [slug, setSlug] = useState(scenarios[2]?.slug ?? scenarios[0]!.slug);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  /**
   * 🔴 Hires are held apart from the slider overrides, because they are not one.
   *
   * A slider moves a number that already exists. A hire ADDS a row to the
   * payroll, with its own start month, and the month it starts is the whole
   * point: a salary from month one and the same salary from month nine are
   * different businesses. Folding them into `Record<string, number>` would have
   * meant flattening a list into paths, and a list pretending to be a form is
   * how a model quietly loses a person.
   */
  const [hires, setHires] = useState<Hire[]>([]);

  const base = scenarios.find((s) => s.slug === slug)!.assumptions;

  /** The scenario with whatever the reader has typed on top of it. */
  const live = useMemo(() => {
    const next: Assumptions = JSON.parse(JSON.stringify(base));
    for (const [path, value] of Object.entries(overrides)) {
      const [group, key] = path.split(".") as [keyof Assumptions, string];
      const target = next[group] as unknown as Record<string, { value: number; from: Provenance }>;
      if (target?.[key]) {
        target[key]!.value = value;
        /* 🔴 An overridden measurement is no longer a measurement. */
        target[key]!.from = "assumed";
      }
    }
    next.people = [...next.people, ...hires];
    return next;
  }, [base, overrides, hires]);

  const projection = useMemo(() => forecast(live), [live]);

  const set = (path: string, value: number) =>
    setOverrides((o) => ({ ...o, [path]: Number.isFinite(value) ? value : 0 }));

  const last = projection.months[projection.months.length - 1]!;
  const peak = Math.max(1, ...projection.months.map((m) => Math.max(m.revenueUsd, m.operatingCostUsd)));

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- scenarios -- */}
      <Card className="p-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Scenario</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => {
                setSlug(s.slug);
                setOverrides({});
                setHires([]);
              }}
              className={
                s.slug === slug
                  ? "rounded-xl bg-navy-500 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              }
            >
              {s.name}
            </button>
          ))}
        </div>
        {Object.keys(overrides).length > 0 || hires.length > 0 ? (
          <p className="mt-3 text-xs text-amber-800">
            {Object.keys(overrides).length} value(s) changed and {hires.length} person(s) added.
            Every changed value is marked assumed, whatever it was before.{" "}
            <button
              type="button"
              onClick={() => {
                setOverrides({});
                setHires([]);
              }}
              className="underline"
            >
              Reset
            </button>
          </p>
        ) : null}
      </Card>

      {/* ------------------------------------------------------- the answer -- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue, final month" value={usd(last.revenueUsd)} />
        <Stat label="Gross margin" value={`${last.grossMarginPct.toFixed(0)}%`} />
        <Stat
          label="Cash, final month"
          value={usd(last.cashUsd)}
          tone={last.cashUsd < 0 ? "bad" : "good"}
        />
        <Stat
          label={projection.runsOutInMonth ? "Cash runs out" : "Break even"}
          value={
            projection.runsOutInMonth
              ? `month ${projection.runsOutInMonth}`
              : projection.breakEvenMonth
                ? `month ${projection.breakEvenMonth}`
                : "not in 36 months"
          }
          tone={projection.runsOutInMonth ? "bad" : "good"}
        />
      </div>

      {projection.runsOutInMonth ? (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">
            The cash goes below zero in month {projection.runsOutInMonth}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-rose-900/90">
            {projection.breakEvenMonth
              ? `This scenario breaks even in month ${projection.breakEvenMonth}, which is ${projection.breakEvenMonth - projection.runsOutInMonth} months after the money runs out. Breaking even later than you run out is not a plan.`
              : "And it does not break even within the horizon."}
          </p>
          {/*
            🔴 The month it crosses zero is the alarm. THIS is the size of the
            problem, and they are rarely the same month: crossing in month three
            and bottoming out in month thirteen means the first number understates
            what has to be raised by an order of magnitude.
          */}
          <p className="mt-2 text-sm font-semibold text-rose-900">
            The low point is month {projection.deepestDeficitMonth}, at{" "}
            {usd(projection.deepestDeficitUsd)} below zero. That, plus what is in the account
            today, is what this plan actually needs:{" "}
            {usd(projection.deepestDeficitUsd + live.money.openingCashUsd.value)}.
          </p>
        </Card>
      ) : null}

      {/* ----------------------------------------------------- the inputs -- */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">One session</p>
        <p className="mt-0.5 text-xs text-slate-500">The half a quarter can establish.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Slider
            label="Session length"
            unit="minutes"
            path="unit.sessionMinutes"
            input={live.unit.sessionMinutes}
            min={3}
            max={90}
            step={1}
            onChange={set}
          />
          <Slider
            label="What a patient pays"
            unit="dollars"
            path="unit.sessionPriceUsd"
            input={live.unit.sessionPriceUsd}
            min={10}
            max={200}
            step={5}
            onChange={set}
          />
          <Slider
            label="Recording consent"
            unit="of sessions"
            path="unit.recordingConsentRate"
            input={live.unit.recordingConsentRate}
            min={0}
            max={1}
            step={0.05}
            percent
            onChange={set}
          />
          <Slider
            label="AI, fixed per session"
            unit="dollars"
            path="unit.aiFixedUsdPerSession"
            input={live.unit.aiFixedUsdPerSession}
            min={0}
            max={0.05}
            step={0.001}
            decimals={4}
            onChange={set}
          />
          <Slider
            label="AI, per audio minute"
            unit="dollars"
            path="unit.aiPerMinuteUsd"
            input={live.unit.aiPerMinuteUsd}
            min={0}
            max={0.02}
            step={0.0005}
            decimals={4}
            onChange={set}
          />
          <Slider
            label="Payment processing"
            unit="of card volume"
            path="unit.paymentPercent"
            input={live.unit.paymentPercent}
            min={0}
            max={0.06}
            step={0.001}
            percent
            onChange={set}
          />
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">How the business grows</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Not measured. One cohort, one quarter.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Slider
            label="Therapists to start"
            unit="people"
            path="market.startingTherapists"
            input={live.market.startingTherapists}
            min={0}
            max={200}
            step={1}
            onChange={set}
          />
          <Slider
            label="Therapists added a month"
            unit="people"
            path="market.therapistsAddedPerMonth"
            input={live.market.therapistsAddedPerMonth}
            min={0}
            max={60}
            step={1}
            onChange={set}
          />
          <Slider
            label="Therapist churn"
            unit="a month"
            path="market.therapistChurnMonthly"
            input={live.market.therapistChurnMonthly}
            min={0}
            max={0.2}
            step={0.005}
            percent
            onChange={set}
          />
          <Slider
            label="Patients per therapist"
            unit="people"
            path="market.patientsPerTherapist"
            input={live.market.patientsPerTherapist}
            min={1}
            max={40}
            step={1}
            onChange={set}
          />
          <Slider
            label="Sessions per patient"
            unit="a month"
            path="market.sessionsPerPatientPerMonth"
            input={live.market.sessionsPerPatientPerMonth}
            min={0.5}
            max={5}
            step={0.25}
            onChange={set}
          />
          <Slider
            label="Paying a subscription"
            unit="of therapists"
            path="pricing.payingShare"
            input={live.pricing.payingShare}
            min={0}
            max={1}
            step={0.05}
            percent
            onChange={set}
          />
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">The money you put in</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Slider
            label="Cash on hand today"
            unit="dollars"
            path="money.openingCashUsd"
            input={live.money.openingCashUsd}
            min={0}
            max={500_000}
            step={5_000}
            onChange={set}
          />
          <Slider
            label="Round"
            unit="dollars"
            path="money.fundingUsd"
            input={live.money.fundingUsd}
            min={0}
            max={5_000_000}
            step={50_000}
            onChange={set}
          />
          <Slider
            label="Round lands in month"
            unit=""
            path="money.fundingMonth"
            input={live.money.fundingMonth}
            min={1}
            max={36}
            step={1}
            onChange={set}
          />
          <Slider
            label="Flag a therapist over"
            unit="dollars a month"
            path="flags.aiPerTherapistMonthlyUsd"
            input={live.flags.aiPerTherapistMonthlyUsd}
            min={5}
            max={300}
            step={5}
            onChange={set}
          />
        </div>

        {live.money.allocation.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Earmarked for
            </p>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full">
              {live.money.allocation.map((a, i) => (
                <div
                  key={a.label}
                  style={{ width: `${a.share * 100}%` }}
                  className={["bg-brand-600", "bg-brand-400", "bg-slate-400", "bg-slate-300"][i % 4]}
                />
              ))}
            </div>
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              {live.money.allocation.map((a, i) => (
                <span key={a.label} className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-sm ${["bg-brand-600", "bg-brand-400", "bg-slate-400", "bg-slate-300"][i % 4]}`}
                  />
                  {a.label} {(a.share * 100).toFixed(0)}%{" "}
                  {usd(live.money.fundingUsd.value * a.share)}
                </span>
              ))}
            </p>
            {/*
              🔴 Said out loud rather than implied. Money is fungible and an
              earmark changes nothing about when the cash runs out. A model that
              let an allocation move the runway would be lying in the direction
              everybody wants to be lied to in.
            */}
            <p className="mt-2 text-xs text-slate-500">
              Presentational. Money is fungible; this moves no runway.
            </p>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------ the payroll -- */}
      <Payroll base={base.people} hires={hires} onChange={setHires} />

      {/* ------------------------------------------------------- the months -- */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">
          Revenue against what it costs to run
        </p>
        <div className="mt-4 flex items-end gap-px">
          {projection.months.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="flex h-24 w-full items-end justify-center gap-px">
                <div
                  className="w-1/2 rounded-t bg-brand-500"
                  style={{ height: `${Math.max(1, (m.revenueUsd / peak) * 100)}%` }}
                />
                <div
                  className="w-1/2 rounded-t bg-slate-300"
                  style={{ height: `${Math.max(1, (m.operatingCostUsd / peak) * 100)}%` }}
                />
              </div>
              {m.month % 6 === 0 ? (
                <span className="text-[9px] text-slate-500">{m.month}</span>
              ) : (
                <span className="text-[9px] text-transparent">.</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand-500" /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-slate-300" /> People and overhead
          </span>
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="py-2 text-start font-medium">Month</th>
                <th className="py-2 text-end font-medium">Therapists</th>
                <th className="py-2 text-end font-medium">Sessions</th>
                <th className="py-2 text-end font-medium">Revenue</th>
                <th className="py-2 text-end font-medium">AI</th>
                <th className="py-2 text-end font-medium">Gross</th>
                <th className="py-2 text-end font-medium">People</th>
                <th className="py-2 text-end font-medium">Net</th>
                <th className="py-2 text-end font-medium">Cash</th>
              </tr>
            </thead>
            <tbody>
              {projection.months
                .filter((m) => m.month % 3 === 0 || m.month === 1)
                .map((m) => (
                  <Row key={m.month} m={m} />
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Every third month. The model computes all {projection.months.length}.
        </p>
      </Card>

      {/* -------------------------------------------------- per therapist -- */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">One therapist, final month</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Model spend" value={usd(last.aiPerTherapistUsd)} />
          <Stat label="Contribution" value={usd(projection.finalTherapistContributionUsd)} />
          <Stat label="Flag set at" value={usd(live.flags.aiPerTherapistMonthlyUsd.value)} />
          <Stat
            label="Flagged?"
            value={last.flagged ? "yes" : "no"}
            tone={last.flagged ? "bad" : "good"}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          A fully booked therapist, three patients a day for twenty-two days, costs{" "}
          <strong>
            {usd(
              66 *
                (live.unit.aiFixedUsdPerSession.value +
                  live.unit.aiPerMinuteUsd.value * live.unit.sessionMinutes.value),
            )}
          </strong>{" "}
          a month. The flag is set{" "}
          {(
            live.flags.aiPerTherapistMonthlyUsd.value /
            Math.max(
              0.01,
              66 *
                (live.unit.aiFixedUsdPerSession.value +
                  live.unit.aiPerMinuteUsd.value * live.unit.sessionMinutes.value),
            )
          ).toFixed(1)}
          x above that, so it will not fire for somebody working hard. It fires for a clinic sharing
          one login, a runaway loop, or a bug.
        </p>
      </Card>

      {/* ---------------------------------------------- what is not known -- */}
      <Card className="border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">
          What it cannot know
        </p>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed text-amber-900/90">
          {couldNotMeasure.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-amber-900/80">
          {measuredOn && benchmarkSource
            ? `Measured ${measuredOn}, from ${benchmarkSource.completedSessions} completed sessions across ${benchmarkSource.therapists} therapists and ${benchmarkSource.monthsOfHistory} months.`
            : "No measurement has been taken on this database yet, so every unit figure is the shipped estimate."}
        </p>
      </Card>

      {/* ------------------------------------------------- keeping the work -- */}
      <Keep live={live} dirty={Object.keys(overrides).length > 0 || hires.length > 0} />
    </div>
  );
}

/* ------------------------------------------------------------------ bits -- */

function Row({ m }: { m: MonthRow }) {
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 text-slate-600">{m.month}</td>
      <td className="py-2 text-end tabular-nums text-slate-600">{count(m.therapists)}</td>
      <td className="py-2 text-end tabular-nums text-slate-600">{count(m.sessions)}</td>
      <td className="py-2 text-end tabular-nums text-slate-900">{usd(m.revenueUsd)}</td>
      <td className="py-2 text-end tabular-nums text-slate-600">{usd(m.aiCostUsd)}</td>
      <td className="py-2 text-end tabular-nums text-slate-600">{usd(m.grossProfitUsd)}</td>
      <td className="py-2 text-end tabular-nums text-slate-600">{usd(m.peopleUsd)}</td>
      <td
        className={
          m.netUsd < 0
            ? "py-2 text-end font-semibold tabular-nums text-rose-600"
            : "py-2 text-end font-semibold tabular-nums text-brand-700"
        }
      >
        {usd(m.netUsd)}
      </td>
      <td
        className={
          m.cashUsd < 0
            ? "py-2 text-end font-semibold tabular-nums text-rose-600"
            : "py-2 text-end tabular-nums text-slate-900"
        }
      >
        {usd(m.cashUsd)}
      </td>
    </tr>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p
        className={
          tone === "bad"
            ? "mt-1 text-lg font-bold text-rose-600"
            : "mt-1 text-lg font-bold text-slate-900"
        }
      >
        {value}
      </p>
    </Card>
  );
}

/**
 * One input, with its provenance on it.
 *
 * 🔴 The badge is the point of this component. A reader has to be able to tell,
 * without asking anybody, whether the number in front of them came from rows or
 * from somebody's judgement, and the two look identical once they are in a
 * chart.
 */
function Slider({
  label,
  unit,
  path,
  input,
  min,
  max,
  step,
  percent,
  decimals,
  onChange,
}: {
  label: string;
  unit: string;
  path: string;
  input: { value: number; from: Provenance; note: string; measuredOn?: string; samples?: number };
  min: number;
  max: number;
  step: number;
  percent?: boolean;
  decimals?: number;
  onChange: (path: string, value: number) => void;
}) {
  const shown = percent
    ? `${(input.value * 100).toFixed(0)}%`
    : input.value.toFixed(decimals ?? (input.value < 10 ? 2 : 0));

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <label htmlFor={path} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        <Badge tone={input.from === "measured" ? "teal" : "slate"}>{input.from}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={path}
          type="range"
          min={min}
          max={max}
          step={step}
          value={input.value}
          onChange={(e) => onChange(path, Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-700"
        />
        <span className="w-20 shrink-0 text-end text-sm font-semibold tabular-nums text-slate-900">
          {shown}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        {unit ? `${unit}. ` : ""}
        {input.note}
        {input.measuredOn ? ` (${input.measuredOn}, n=${input.samples})` : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- payroll -- */

/**
 * The people, and the month each of them starts.
 *
 * ## 🔴 A hire is a start month, not a salary
 *
 * Every model that gets this wrong gets it wrong the same way: it totals the
 * salaries and divides. Two engineers at $3,000 from month one and two from
 * month twenty-four cost the same on that arithmetic and are completely
 * different companies, because one of them spends its runway before it has any
 * revenue to spend it against. So the month is a field, it is on the screen,
 * and the cash line moves the instant it changes.
 *
 * ## 🔴 Burden is separate from salary and is never zero
 *
 * Employer tax, insurance and the rest run 15% here. A plan built on gross
 * salary alone is short by that much every month, and the gap only shows up as
 * a cash problem, never as a modelling one.
 */
function Payroll({
  base,
  hires,
  onChange,
}: {
  base: Hire[];
  hires: Hire[];
  onChange: (next: Hire[]) => void;
}) {
  const edit = (i: number, patch: Partial<Hire>) =>
    onChange(hires.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  const total = (list: Hire[]) =>
    list.reduce((sum, h) => sum + h.monthlyUsd * (1 + h.burden), 0);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">The people</p>
        <p className="text-xs text-slate-500">
          {usd(total([...base, ...hires]))} a month once everybody has started, burden included
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {base.map((h) => (
          <div
            key={`${h.role}-${h.startMonth}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm"
          >
            <span className="flex-1 font-medium text-slate-800">{h.role}</span>
            <span className="text-slate-500">from month {h.startMonth}</span>
            <span className="tabular-nums font-semibold text-slate-900">
              {usd(h.monthlyUsd)}
            </span>
            <Badge tone="slate">in the scenario</Badge>
          </div>
        ))}

        {hires.map((h, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2"
          >
            <label className="flex-1 min-w-40 text-xs text-slate-600">
              Role
              <input
                value={h.role}
                onChange={(e) => edit(i, { role: e.target.value })}
                placeholder="Support lead"
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
              />
            </label>
            <label className="w-28 text-xs text-slate-600">
              Starts month
              <input
                type="number"
                min={1}
                max={36}
                value={h.startMonth}
                onChange={(e) =>
                  edit(i, { startMonth: Math.min(36, Math.max(1, Number(e.target.value) || 1)) })
                }
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm tabular-nums text-slate-900"
              />
            </label>
            <label className="w-32 text-xs text-slate-600">
              A month
              <input
                type="number"
                min={0}
                step={250}
                value={h.monthlyUsd}
                onChange={(e) => edit(i, { monthlyUsd: Math.max(0, Number(e.target.value) || 0) })}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm tabular-nums text-slate-900"
              />
            </label>
            <label className="w-28 text-xs text-slate-600">
              Burden
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={h.burden}
                onChange={(e) =>
                  edit(i, { burden: Math.min(1, Math.max(0, Number(e.target.value) || 0)) })
                }
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm tabular-nums text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(hires.filter((_, j) => j !== i))}
              className="h-9 rounded-lg px-2 text-sm text-slate-500 underline hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onChange([
            ...hires,
            { role: "", startMonth: 7, monthlyUsd: 2500, burden: 0.15 },
          ])
        }
        className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
      >
        Add someone
      </button>

      <p className="mt-2 text-xs text-slate-500">
        Paid from that month on, with burden. No leavers.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------- keeping it -- */

/**
 * Saving a scenario, and freezing a measurement.
 *
 * 🔴 Neither button can change a price. Saving writes one row to
 * `finance_scenarios`; measuring writes one row to `finance_benchmarks`. There
 * is no third thing this screen can do to the database, which is what makes
 * "the forecast cannot charge anybody" checkable rather than promised.
 */
function Keep({ live, dirty }: { live: Assumptions; dirty: boolean }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Keep this</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="scenario-name" className="text-xs text-slate-600">
            Save as
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="scenario-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Funded, slower hiring"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
            <button
              type="button"
              disabled={pending || name.trim().length < 3}
              onClick={() =>
                start(async () => {
                  setMsg(
                    await saveScenarioAction({
                      slug: name,
                      name: name.trim(),
                      assumptions: live,
                      notes: null,
                    }),
                  );
                })
              }
              className="h-10 shrink-0 rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {dirty
              ? "Saves what is on the screen, changes and all, under a new name."
              : "Nothing is changed yet, so this would save the scenario as it ships."}
          </p>
        </div>

        <div>
          <label htmlFor="benchmark-label" className="text-xs text-slate-600">
            Measure and freeze
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="benchmark-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="After the first quarter"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setMsg(await takeBenchmarkAction(label));
                })
              }
              className="h-10 shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Measure
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            A dated snapshot, never updated. March is reproducible in June.
          </p>
        </div>
      </div>

      {msg.error ? <p className="mt-3 text-sm text-red-600">{msg.error}</p> : null}
      {msg.ok ? <p className="mt-3 text-sm text-brand-700">{msg.ok}</p> : null}
    </Card>
  );
}
