"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  refreshActivity,
  refreshAi,
  refreshAll,
  refreshClinics,
  refreshCompanies,
  refreshMoney,
  refreshPatients,
  refreshPayments,
  refreshSessions,
  refreshTherapists,
} from "@/app/(admin)/admin/tv/board-actions";
import type { WholeBoard } from "@/lib/console/board";

/**
 * 🔴 76.1 — THE BOARD. "I run the company by sitting back and watching TV."
 *
 * ## What it is for
 *
 * Nine dashboards, each one collapsible, each with its own refresh, each with a
 * door into the screen that manages that thing. A founder opens this and can see
 * every company, every clinic, every clinician, every dollar in and out, every
 * model call and every person waiting on a transfer, this week and this month,
 * without opening anything else.
 *
 * ## 🔴 EVERY SECTION HAS A DOOR, AND THAT IS THE DESIGN
 *
 * A dashboard you can only look at becomes a second place to keep numbers, and
 * then the two places disagree. Nothing here writes. Every section ends in a
 * link to the page that already has the buttons, so "see it" and "do something
 * about it" are one click apart and there is exactly one implementation of the
 * doing.
 *
 * ## 🔴 AND NOTHING MOVES UNTIL SOMEBODY ASKS
 *
 * No polling. Each section says when it was last read and has a button to read
 * it again, because the transfer queue changes by the minute and the clinic
 * roster changes twice a month, and forcing them to share a clock means either
 * the queue is stale or the roster thrashes under a reader's finger.
 */

/* ----------------------------------------------------------- formatting -- */

/**
 * 🔴 C84 — NO `Intl` IN A CLIENT COMPONENT, hand-rolled instead.
 *
 * `toLocaleString` reads the runtime's locale: `en-US` on the server pass and
 * whatever the browser says in the client one. These are money figures a founder
 * reads off a screen and quotes in a meeting.
 */
function grouped(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function usd(cents: number): string {
  const abs = Math.abs(cents) / 100;
  const body = abs < 10 ? abs.toFixed(2) : grouped(abs);
  return `${cents < 0 ? "-" : ""}$${body}`;
}

function when(at: Date): string {
  const h = String(at.getHours()).padStart(2, "0");
  const m = String(at.getMinutes()).padStart(2, "0");
  const s = String(at.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ------------------------------------------------------------- a section -- */

function Section({
  title,
  subtitle,
  manageHref,
  manageLabel,
  onRefresh,
  readAt,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle: string;
  manageHref: string;
  manageLabel: string;
  onRefresh: () => Promise<void>;
  readAt: Date;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 text-start"
        >
          <span
            aria-hidden
            className={`text-xs text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </button>
        <span className="text-xs text-slate-500">{subtitle}</span>

        <span className="ms-auto text-[11px] tabular-nums text-slate-400">
          read {when(readAt)}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await onRefresh()))}
          className="h-8 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
        >
          {pending ? "Reading…" : "Refresh"}
        </button>
        {/*
          🔴 THE DOOR. Every section ends somewhere you can act, because a number
          you can only look at is a number somebody screenshots into a document.
        */}
        <Link
          href={manageHref}
          className="h-8 rounded-lg bg-navy-500 px-3 text-xs font-semibold leading-8 text-white hover:bg-navy-600"
        >
          {manageLabel}
        </Link>
      </div>

      {open ? <div className="border-t border-slate-100 px-4 py-3">{children}</div> : null}
    </section>
  );
}

/** A big number with its label under it. The unit of this whole screen. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "good" }) {
  const colour =
    tone === "warn" ? "text-rose-600" : tone === "good" ? "text-teal-700" : "text-slate-900";
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className={`text-lg font-bold tabular-nums ${colour}`}>{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{label}</p>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{children}</div>;
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Nothing yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-[11px] uppercase tracking-wide text-slate-400">
            {head.map((h) => (
              <th key={h} className="px-2 py-1 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {r.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 tabular-nums text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- board -- */

export function Board({ initial }: { initial: WholeBoard }) {
  const [b, setB] = useState(initial);
  const [read, setRead] = useState<Record<string, Date>>(() => {
    const now = new Date();
    return {
      money: now, companies: now, clinics: now, therapists: now,
      sessions: now, ai: now, payments: now, people: now, activity: now,
    };
  });
  const [pending, start] = useTransition();

  const mark = (k: string) => setRead((r) => ({ ...r, [k]: new Date() }));

  const all = () =>
    start(async () => {
      setB(await refreshAll());
      const now = new Date();
      setRead({
        money: now, companies: now, clinics: now, therapists: now,
        sessions: now, ai: now, payments: now, people: now, activity: now,
      });
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">The board</h2>
          <p className="text-xs text-slate-500">
            Every company, clinic, clinician and dollar. Week and month.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={all}
          className="ms-auto h-9 rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Reading everything…" : "Refresh everything"}
        </button>
      </div>

      {/* ------------------------------------------------------------ money */}
      <Section
        title="Money"
        subtitle="in, owed, and model cost"
        manageHref={b.money.manageHref}
        manageLabel="The vault"
        readAt={read.money!}
        onRefresh={async () => {
          const next = await refreshMoney();
          setB((x) => ({ ...x, money: next }));
          mark("money");
        }}
      >
        <Row>
          <Stat label="Collected, 7 days" value={usd(b.money.inWeekCents)} />
          <Stat label="Collected, 30 days" value={usd(b.money.inMonthCents)} />
          <Stat label="Collected, ever" value={usd(b.money.inTotalCents)} />
          {/*
            🔴 DUE IS NOT REVENUE and it is coloured as a warning for that
            reason. It is what somebody has been asked for and has not sent, and
            a board that adds it to the takings is a board describing a company
            with more money than it has.
          */}
          <Stat
            label={`Owed to us, ${b.money.dueCount} invoices`}
            value={usd(b.money.dueCents)}
            tone={b.money.dueCents > 0 ? "warn" : undefined}
          />
          <Stat label="Model spend, 30 days" value={usd(b.money.aiMonthCents)} />
          <Stat
            label="Left after models, 30 days"
            value={usd(b.money.inMonthCents - b.money.aiMonthCents)}
            tone={b.money.inMonthCents - b.money.aiMonthCents >= 0 ? "good" : "warn"}
          />
        </Row>
        <div className="mt-2">
          <Table
            head={["30 days, by source", "amount"]}
            rows={[
              ["Subscriptions", usd(b.money.subscriptionCents)],
              ["Session fees, metered", usd(b.money.sessionCents)],
              ["Given away as discount", usd(b.money.waivedCents)],
            ]}
          />
        </div>
      </Section>

      {/* -------------------------------------------------------- companies */}
      <Section
        title={`Companies · ${b.companies.rows.length}`}
        subtitle="pots, coverage, spend"
        manageHref={b.companies.manageHref}
        manageLabel="Manage companies"
        readAt={read.companies!}
        onRefresh={async () => {
          const next = await refreshCompanies();
          setB((x) => ({ ...x, companies: next }));
          mark("companies");
        }}
      >
        <Table
          head={["Company", "State", "Billed from", "Coverage", "Pot balance", "Sessions, 30d"]}
          rows={b.companies.rows.map((r) => [
            r.name,
            r.state,
            (r.entity ?? "").toUpperCase(),
            r.coverageBps === null ? "no pot" : `${(r.coverageBps / 100).toFixed(0)}%`,
            usd(r.balanceCents),
            r.sessionsThisMonth,
          ])}
        />
        {/*
          🔴 THE POT TOTAL IS A LIABILITY, and it says so. It is money a customer
          gave us to spend on their staff. A product that reads it as income is
          insolvent and cheerful.
        */}
        <p className="mt-2 text-xs text-slate-500">
          Pots hold{" "}
          <strong className="text-slate-800">
            {usd(b.companies.rows.reduce((s, r) => s + r.committedCents, 0))}
          </strong>{" "}
          of customers&apos; money: a liability, not revenue.
        </p>
      </Section>

      {/* ---------------------------------------------------------- clinics */}
      <Section
        title={`Clinics · ${b.clinics.rows.length}`}
        subtitle="seats and what is unpaid"
        manageHref={b.clinics.manageHref}
        manageLabel="Manage clinics"
        readAt={read.clinics!}
        onRefresh={async () => {
          const next = await refreshClinics();
          setB((x) => ({ ...x, clinics: next }));
          mark("clinics");
        }}
      >
        <Table
          head={["Clinic", "State", "Billed from", "Seats", "Live seats", "Clinicians", "Unpaid"]}
          rows={b.clinics.rows.map((r) => [
            r.name,
            r.state ?? "held",
            (r.region ?? "").toUpperCase(),
            r.seats,
            r.liveSeats,
            r.clinicians,
            usd(r.dueCents),
          ])}
        />
      </Section>

      {/* ------------------------------------------------------- therapists */}
      <Section
        title={`Clinicians · ${b.therapists.rows.length}`}
        subtitle="how each one pays us"
        manageHref={b.therapists.manageHref}
        manageLabel="Manage clinicians"
        readAt={read.therapists!}
        onRefresh={async () => {
          const next = await refreshTherapists();
          setB((x) => ({ ...x, therapists: next }));
          mark("therapists");
        }}
      >
        {/*
          🔴 THE SPLIT IS THE HEADLINE, not the roster under it.
          A month where subscribers fall and metered rises is a month the plan is
          not worth buying, and it looks identical to a good month in every
          revenue total on this page.
        */}
        <Row>
          <Stat label="On a monthly plan" value={String(b.therapists.onPlan)} tone="good" />
          <Stat label="Pay as you go" value={String(b.therapists.metered)} />
          <Stat
            label="Sessions, 30 days"
            value={String(b.therapists.rows.reduce((s, r) => s + r.sessionsThisMonth, 0))}
          />
          <Stat
            label="Owed by clinicians"
            value={usd(b.therapists.rows.reduce((s, r) => s + r.dueCents, 0))}
          />
        </Row>
        <div className="mt-2">
          <Table
            head={["Clinician", "Practice", "Plan", "Sessions, 30d", "Model cost, 30d", "Owes"]}
            rows={b.therapists.rows.map((r) => [
              [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email,
              r.orgName ?? "",
              r.plan && r.plan !== "payg" ? `${r.plan} (${r.status})` : "pay as you go",
              r.sessionsThisMonth,
              usd(r.aiCents),
              usd(r.dueCents),
            ])}
          />
        </div>
      </Section>

      {/* --------------------------------------------------------- sessions */}
      <Section
        title="Sessions"
        subtitle="how many, and who consented"
        manageHref={b.sessions.manageHref}
        manageLabel="Usage"
        readAt={read.sessions!}
        onRefresh={async () => {
          const next = await refreshSessions();
          setB((x) => ({ ...x, sessions: next }));
          mark("sessions");
        }}
      >
        <Row>
          <Stat label="Last 7 days" value={String(b.sessions.week ?? 0)} />
          <Stat label="Last 30 days" value={String(b.sessions.month ?? 0)} />
          <Stat label="Ever" value={String(b.sessions.total ?? 0)} />
          <Stat label="Consented, 30d" value={String(b.sessions.consented ?? 0)} />
          <Stat label="Declined, 30d" value={String(b.sessions.declined ?? 0)} />
          <Stat label="In person, 30d" value={String(b.sessions.inPerson ?? 0)} />
        </Row>
        {(b.sessions.awaiting ?? 0) > 0 ? (
          <p className="mt-2 text-xs font-semibold text-rose-600">
            {b.sessions.awaiting} sessions waiting on a payment. Somebody is on a screen for each.
          </p>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------- AI */}
      <Section
        title="What the models cost"
        subtitle="by kind. The expense that scales"
        manageHref={b.ai.manageHref}
        manageLabel="Usage"
        readAt={read.ai!}
        onRefresh={async () => {
          const next = await refreshAi();
          setB((x) => ({ ...x, ai: next }));
          mark("ai");
        }}
      >
        <Table
          head={["Kind", "7 days", "30 days", "Calls, 30d", "Tokens in", "Tokens out"]}
          rows={b.ai.rows.map((r) => [
            r.kind,
            usd(r.weekCents),
            usd(r.monthCents),
            grouped(r.calls),
            grouped(r.tokensIn),
            grouped(r.tokensOut),
          ])}
        />
      </Section>

      {/* --------------------------------------------------------- payments */}
      <Section
        title="The transfer queue"
        subtitle="a rising number is somebody waiting"
        manageHref={b.payments.manageHref}
        manageLabel="Work the queue"
        readAt={read.payments!}
        onRefresh={async () => {
          const next = await refreshPayments();
          setB((x) => ({ ...x, payments: next }));
          mark("payments");
        }}
      >
        <Row>
          <Stat
            label="Waiting for a person"
            value={String(b.payments.waiting ?? 0)}
            tone={(b.payments.waiting ?? 0) > 0 ? "warn" : "good"}
          />
          <Stat
            label="Longest wait, minutes"
            value={String(b.payments.oldestMinutes ?? 0)}
            tone={(b.payments.oldestMinutes ?? 0) > 15 ? "warn" : undefined}
          />
          <Stat label="Confirmed, 7 days" value={String(b.payments.confirmedWeek ?? 0)} />
          <Stat label="Rejected, 7 days" value={String(b.payments.rejectedWeek ?? 0)} />
          <Stat label="Settled, 30 days" value={usd(b.payments.settledMonthCents ?? 0)} />
          <Stat label="Started, no proof yet" value={String(b.payments.awaitingProof ?? 0)} />
        </Row>
      </Section>

      {/* --------------------------------------------------------- patients */}
      <Section
        title="People"
        subtitle="how many, funded, claimed"
        manageHref={b.people.manageHref}
        manageLabel="The radar"
        readAt={read.people!}
        onRefresh={async () => {
          const next = await refreshPatients();
          setB((x) => ({ ...x, people: next }));
          mark("people");
        }}
      >
        <Row>
          <Stat label="People with a record" value={String(b.people.total ?? 0)} />
          <Stat label="New, 7 days" value={String(b.people.week ?? 0)} />
          <Stat label="New, 30 days" value={String(b.people.month ?? 0)} />
          <Stat label="Funded by an employer" value={String(b.people.sponsored ?? 0)} />
          <Stat label="Claimed their own record" value={String(b.people.claimed ?? 0)} />
        </Row>
      </Section>

      {/* --------------------------------------------------------- activity */}
      <Section
        title="Everything that happened"
        subtitle="every recorded act, by kind"
        manageHref={b.activity.manageHref}
        manageLabel="The audit log"
        readAt={read.activity!}
        onRefresh={async () => {
          const next = await refreshActivity();
          setB((x) => ({ ...x, activity: next }));
          mark("activity");
        }}
      >
        <Row>
          <Stat label="By our own staff, 30d" value={String(b.activity.actors.staff)} />
          <Stat label="By a company, 30d" value={String(b.activity.actors.sponsor)} />
          <Stat label="No named actor, 30d" value={String(b.activity.actors.unattributed)} />
        </Row>
        <div className="mt-2">
          <Table
            head={["Kind of act", "7 days", "30 days"]}
            rows={b.activity.rows.map((r) => [r.category, r.week, r.month])}
          />
        </div>
      </Section>
    </div>
  );
}
