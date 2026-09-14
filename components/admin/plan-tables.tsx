"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui";
import { runPlan, type Plan } from "@/lib/finance/beta";
import { count, egp as toEgp, usd } from "@/lib/finance/format";

/**
 * The operating plan, on a screen, with the guesses on sliders.
 *
 * ## 🔴 ONLY THE GUESSES MOVE
 *
 * The measured AI terms are not sliders. Neither are the salaries, which are a
 * decision somebody has already made. What moves is the handful of market
 * numbers nobody knows yet, because those are the ones a reader should be
 * poking at, and putting a measurement beside them on the same control would
 * invite exactly the confusion the provenance system exists to prevent.
 *
 * ## The cliff is the point of the screen
 *
 * Every other number here changes the answer by a bit. `churnAtFullPrice`
 * changes whether there is a business. It gets its own block and its own
 * sentence saying so.
 */
export function PlanTables({
  plans,
  provenance,
}: {
  plans: { slug: string; plan: Plan }[];
  provenance: { measured: number; decided: number; guess: number };
}) {
  const [slug, setSlug] = useState(plans[2]?.slug ?? plans[0]!.slug);
  const [cliff, setCliff] = useState<number | null>(null);
  const [sessionEgp, setSessionEgp] = useState<number | null>(null);
  const [therapistEgp, setTherapistEgp] = useState<number | null>(null);
  const [clinicEgp, setClinicEgp] = useState<number | null>(null);
  const [consent, setConsent] = useState<number | null>(null);

  const base = plans.find((p) => p.slug === slug)!.plan;
  const rate = base.egpPerUsd;

  const live = useMemo<Plan>(() => {
    const next: Plan = JSON.parse(JSON.stringify(base));
    if (sessionEgp !== null) next.unit.sessionPriceUsd = sessionEgp / rate;
    if (consent !== null) next.unit.consentRate = consent;
    next.segments = next.segments.map((s) => {
      const out = { ...s };
      /*
       * 🔴 The cliff slider MULTIPLIES rather than replaces, so the three
       * segments keep their relationship to each other. A company and a solo
       * therapist do not churn at the same rate and a single flat number would
       * quietly assert that they do.
       */
      if (cliff !== null) out.churnAtFullPrice = Math.min(0.95, s.churnAtFullPrice * cliff);
      if (therapistEgp !== null && s.key === "therapist") out.monthlyUsd = therapistEgp / rate;
      if (clinicEgp !== null && s.key === "clinic") out.monthlyUsd = clinicEgp / rate;
      return out;
    });
    return next;
  }, [base, cliff, sessionEgp, therapistEgp, clinicEgp, consent, rate]);

  const r = useMemo(() => runPlan(live), [live]);
  const last = r.months[r.months.length - 1]!;
  const touched = [cliff, sessionEgp, therapistEgp, clinicEgp, consent].filter((x) => x !== null).length;

  const egp = (u: number) => toEgp(u, rate);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Plan</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {plans.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSlug(p.slug)}
              className={
                p.slug === slug
                  ? "rounded-xl bg-navy-500 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              }
            >
              {p.plan.name}
            </button>
          ))}
        </div>
        {/*
          🔴 THE SPLIT, BEFORE THE NUMBERS. Two measured, a handful decided, the
          rest guessed. A reader who sees the tables first has already taken them
          for evidence, which is the one thing this plan is not yet.
        */}
        <p className="mt-3 text-xs text-slate-600">
          <strong className="text-teal-700">{provenance.measured} measured</strong> ·{" "}
          {provenance.decided} decided · <strong>{provenance.guess} guessed</strong>
        </p>
        {touched > 0 ? (
          <p className="mt-3 text-xs text-amber-800">
            {touched} guess(es) changed.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setCliff(null);
                setSessionEgp(null);
                setTherapistEgp(null);
                setClinicEgp(null);
                setConsent(null);
              }}
            >
              Reset
            </button>
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue, final month" value={usd(last.revenueUsd)} />
        <Stat label="Gross margin" value={`${last.grossMarginPct.toFixed(0)}%`} />
        <Stat
          label="Break even"
          value={r.breakEvenMonth ? `month ${r.breakEvenMonth}` : "not in horizon"}
          tone={r.breakEvenMonth ? "good" : "bad"}
        />
        <Stat
          label="Cash, final"
          value={usd(last.cashUsd)}
          tone={last.cashUsd < 0 ? "bad" : "good"}
        />
      </div>

      {r.runsOutInMonth ? (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">
            Cash goes below zero in month {r.runsOutInMonth}. The low point is month{" "}
            {r.deepestDeficitMonth} at {usd(r.deepestDeficitUsd)} down, so this plan needs{" "}
            {usd(r.deepestDeficitUsd + base.openingCashUsd)}.
          </p>
        </Card>
      ) : null}

      {/* -------------------------------------------------------- the cliff -- */}
      <Card className="border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">The number that decides this</p>
        <p className="mt-1 text-sm text-amber-900/90">
          Who leaves when the discount ends. Slide it; watch break even move.
        </p>
        <div className="mt-3">
          <Slider
            label="Churn at the cliff"
            value={cliff ?? 1}
            min={0.1}
            max={2}
            step={0.05}
            onChange={setCliff}
            format={(v) => `${v.toFixed(2)}x`}
          />
        </div>
      </Card>

      {/* ------------------------------------------------------ the prices -- */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Prices, in pounds</p>
        <p className="mt-0.5 text-xs text-slate-500">
          All guesses. {rate} EGP to the dollar.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Slider
            label="A session"
            value={sessionEgp ?? Math.round(base.unit.sessionPriceUsd * rate)}
            min={200}
            max={1200}
            step={25}
            onChange={setSessionEgp}
            format={(v) => `${v} EGP`}
          />
          <Slider
            label="A therapist, a month"
            value={therapistEgp ?? Math.round((base.segments.find((s) => s.key === "therapist")?.monthlyUsd ?? 0) * rate)}
            min={0}
            max={5000}
            step={100}
            onChange={setTherapistEgp}
            format={(v) => `${v} EGP`}
          />
          <Slider
            label="A clinic, a month"
            value={clinicEgp ?? Math.round((base.segments.find((s) => s.key === "clinic")?.monthlyUsd ?? 0) * rate)}
            min={0}
            max={15000}
            step={250}
            onChange={setClinicEgp}
            format={(v) => `${v} EGP`}
          />
          <Slider
            label="Recording consent"
            value={consent ?? base.unit.consentRate}
            min={0}
            max={1}
            step={0.05}
            onChange={setConsent}
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Our cut is {(live.unit.takeRate * 100).toFixed(0)}% of a session, so{" "}
          {egp(live.unit.sessionPriceUsd * live.unit.takeRate)}, plus{" "}
          {egp(live.unit.aiFeeUsd)} for the AI where the patient said yes.
        </p>
      </Card>

      {/* -------------------------------------------------------- the table -- */}
      <Card className="overflow-x-auto p-4">
        <p className="text-sm font-semibold text-slate-900">Month by month</p>
        <table className="mt-3 w-full min-w-3xl text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              {["Mo", "Cos", "Clin", "Thera", "Sessions", "Subs", "Given away", "Fees", "Revenue", "Costs", "Net", "Cash"].map(
                (h, i) => (
                  <th key={h} className={i === 0 ? "py-2 text-start font-medium" : "py-2 text-end font-medium"}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {r.months
              .filter((m) => r.months.length <= 12 || m.month % 3 === 0 || m.month === 1)
              .map((m) => (
                <tr key={m.month} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-600">{m.month}</td>
                  <td className="py-2 text-end tabular-nums text-slate-600">{count(m.companies)}</td>
                  <td className="py-2 text-end tabular-nums text-slate-600">{count(m.clinics)}</td>
                  <td className="py-2 text-end tabular-nums text-slate-600">{count(m.therapistAccounts)}</td>
                  <td className="py-2 text-end tabular-nums text-slate-600">{count(m.sessions)}</td>
                  <td className="py-2 text-end tabular-nums text-slate-600">{usd(m.subscriptionUsd)}</td>
                  <td className="py-2 text-end tabular-nums text-amber-700">{usd(m.discountGivenUsd)}</td>
                  <td className="py-2 text-end tabular-nums text-slate-600">
                    {usd(m.sessionFeeUsd + m.aiFeeUsd)}
                  </td>
                  <td className="py-2 text-end font-semibold tabular-nums text-slate-900">
                    {usd(m.revenueUsd)}
                  </td>
                  <td className="py-2 text-end tabular-nums text-slate-600">
                    {usd(
                      m.aiCostUsd + m.videoCostUsd + m.paymentCostUsd + m.creditBurnUsd + m.operatingCostUsd,
                    )}
                  </td>
                  <td
                    className={
                      m.netUsd < 0
                        ? "py-2 text-end font-semibold tabular-nums text-rose-600"
                        : "py-2 text-end font-semibold tabular-nums text-teal-700"
                    }
                  >
                    {usd(m.netUsd)}
                  </td>
                  <td className="py-2 text-end tabular-nums text-slate-900">{usd(m.cashUsd)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          {r.months.length <= 12 ? "Every month." : "Every third month. The model computes all "}
          {r.months.length > 12 ? r.months.length : ""}
        </p>
      </Card>

      {/* --------------------------------------------------- what it costs -- */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Whole plan</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Revenue" value={usd(r.totals.revenueUsd)} />
          <Stat label="People" value={usd(r.totals.peopleUsd)} />
          <Stat label="Marketing" value={usd(r.totals.marketingUsd)} />
          <Stat label="CAC" value={usd(r.blendedCacUsd)} />
          <Stat label="Given away" value={usd(r.totals.discountGivenUsd)} />
          <Stat label="Credit burned" value={usd(r.totals.creditBurnUsd)} />
          <Stat label="OpenAI" value={usd(r.totals.aiCostUsd)} />
          <Stat label="Net" value={usd(r.totals.netUsd)} tone={r.totals.netUsd < 0 ? "bad" : "good"} />
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ bits -- */

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          tone === "bad"
            ? "mt-1 text-lg font-semibold tabular-nums text-rose-600"
            : tone === "good"
              ? "mt-1 text-lg font-semibold tabular-nums text-teal-700"
              : "mt-1 text-lg font-semibold tabular-nums text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
        />
        <span className="w-24 shrink-0 text-end text-sm font-semibold tabular-nums text-slate-900">
          {format(value)}
        </span>
      </div>
    </div>
  );
}
