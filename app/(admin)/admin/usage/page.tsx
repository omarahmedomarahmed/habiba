import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { requireRole } from "@/lib/auth/guard";
import {
  PLATFORM_BUCKET,
  consentRate,
  costPerSession,
  formatMicrocents,
  usageByKind,
  usageByTherapist,
} from "@/lib/data/usage";
import { formatUsd } from "@/lib/billing/plans";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What the product costs to run, per clinician and per session.
 *
 * The figure that decides the business is at the top: cost per session. Every
 * pricing assumption downstream of it — the seat fee, the take rate, whether
 * unlimited is survivable — is a guess until this is a real number with real
 * sessions behind it.
 *
 * No clinical content anywhere on this page. It reads token counts, audio
 * seconds and money; it never touches a transcript, and it is not a route into
 * one.
 */
export default async function AdminUsagePage() {
  await requireRole("super_admin");

  const [perSession, byKind, byTherapist, consent] = await Promise.all([
    costPerSession(30),
    usageByKind(30),
    usageByTherapist(30),
    /*
     * 🔴 58.9 — THE NUMBER SPRINT 57 WAS SHAPED AROUND, FINALLY ASKED.
     *
     * C209 makes the AI fee conditional on the patient's consent, and the whole
     * unlimited-plan billing change was designed to keep that consent free of
     * money pressure. Whether it worked is one query, `consentRate`, and
     * nothing in the product called it: `verify:reachable` has named it in
     * MUST_WIRE since the gate existed.
     *
     * It belongs here rather than on a dashboard, because the decline rate is
     * only meaningful beside what a session costs to run. A high decline rate
     * with a low cost per session is a product working as designed; the same
     * decline rate with a high one is a margin conversation.
     */
    consentRate(30),
  ]);

  const totalMicrocents = byKind.reduce((sum, row) => sum + Number(row.microcents ?? 0), 0);
  const totalFees = byTherapist.reduce((sum, row) => sum + row.feeCents, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Usage</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Last 30 days. Model spend, audio minutes and what patients paid, no clinical content.
        </p>
      </div>

      {/*
        🔴 C209 — consent is the patient's and the AI fee rides on it, so the
        rate is an operating figure rather than a curiosity. "Not asked" is
        listed beside the other two on purpose: a session where nobody asked is
        not a session where somebody declined, and collapsing the two would make
        a process failure look like a patient's choice.
      */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Recording consent, last 30 days</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Sessions</dt>
            <dd className="text-lg text-slate-700">{consent.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Granted</dt>
            <dd className="text-lg font-bold text-slate-900">{consent.granted}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Declined</dt>
            <dd className="text-lg text-slate-700">{consent.declined}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Never asked</dt>
            <dd className="text-lg text-slate-700">{consent.notAsked}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          The therapist incurs the AI fee; the patient switches it on (C209). A decline is the
          product working.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cost per session" value={formatMicrocents(perSession.perSessionMicrocents)} />
        <Stat label="Sessions with AI" value={String(perSession.sessions)} />
        <Stat label="Model spend" value={formatMicrocents(totalMicrocents)} />
        <Stat label="Our fees" value={formatUsd(totalFees)} tone="teal" />
      </div>

      {/*
        The margin, stated rather than left to be worked out.

        A dashboard that shows spend and revenue in separate boxes invites
        somebody to eyeball the ratio and get it wrong. This is the sentence
        the numbers add up to.
      */}
      {totalFees > 0 ? (
        <Card className="p-4">
          <p className="text-sm text-slate-600">
            We took <strong><Money cents={totalFees} /></strong> and spent{" "}
            <strong>{formatMicrocents(totalMicrocents)}</strong> on models, a gross margin of{" "}
            <strong>{Math.round((1 - totalMicrocents / 100_000 / (totalFees / 100)) * 100)}%</strong>{" "}
            before payment processing and infrastructure.
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Where the money goes</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-start text-xs text-slate-500">
                <Th>Kind</Th>
                <Th>Model</Th>
                <Th align="end">Calls</Th>
                <Th align="end">Errors</Th>
                <Th align="end">Spend</Th>
              </tr>
            </thead>
            <tbody>
              {byKind.map((row) => (
                <tr key={`${row.kind}-${row.model}`} className="border-b border-slate-50">
                  <Td>{row.kind}</Td>
                  <Td className="font-mono text-xs text-slate-500">{row.model}</Td>
                  <Td align="end">{row.calls}</Td>
                  <Td align="end">
                    {Number(row.errors) > 0 ? (
                      <Badge tone="red">{Number(row.errors)}</Badge>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </Td>
                  <Td align="end" className="font-medium">
                    {formatMicrocents(Number(row.microcents ?? 0))}
                  </Td>
                </tr>
              ))}
              {byKind.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-6 text-center text-slate-500">
                    No model calls in the last 30 days.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Per clinician</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Sorted by spend. The top one decides whether unlimited works.
            </p>
          </div>
          {/*
            🔴 76.41 — THE ROW BEHIND EVERY ROW.
            Every figure in this table is a sum, and a sum cannot show the
            session that went wrong. One link to the list it is made of.
          */}
          <Link
            href="/admin/usage/sessions"
            className="tap-target shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Every session
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-start text-xs text-slate-500">
                <Th>Clinician</Th>
                <Th align="end">Sessions</Th>
                <Th align="end">Audio</Th>
                <Th align="end">Calls</Th>
                <Th align="end">Cost</Th>
                <Th align="end">Patients paid</Th>
                <Th align="end">Our fee</Th>
              </tr>
            </thead>
            <tbody>
              {byTherapist.map((row) => {
                const underwater = row.costMicrocents / 100_000 > row.feeCents / 100 && row.feeCents > 0;
                return (
                  <tr key={row.userId} className="border-b border-slate-50">
                    <Td>
                      {/*
                        🔴 76.41 — EVERY NAME IS A DOOR INTO THE SESSIONS
                        BEHIND ITS ROW. The PLATFORM bucket is the exception:
                        it is spend belonging to no clinician, so there is no
                        caseload to filter to.
                      */}
                      {row.userId === PLATFORM_BUCKET ? (
                        <span className="font-medium text-slate-900">{row.firstName}</span>
                      ) : (
                        <Link
                          href={`/admin/usage/sessions?therapist=${row.userId}`}
                          className="font-medium text-slate-900 underline decoration-slate-200 underline-offset-4 hover:decoration-slate-400"
                        >
                          {fullName(row.firstName, row.lastName, "")}
                        </Link>
                      )}
                      <span className="block truncate text-xs text-slate-500">{row.email}</span>
                    </Td>
                    <Td align="end">{row.sessions}</Td>
                    <Td align="end">{row.audioMinutes} min</Td>
                    <Td align="end">{row.aiCalls}</Td>
                    <Td align="end" className={underwater ? "font-semibold text-red-600" : ""}>
                      {formatMicrocents(row.costMicrocents)}
                    </Td>
                    <Td align="end"><Money cents={row.patientCents} /></Td>
                    <Td align="end" className="font-medium text-brand-700">
                      <Money cents={row.feeCents} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "teal" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tracking-tight ${tone === "teal" ? "text-brand-600" : "text-slate-900"}`}
      >
        {value}
      </p>
    </Card>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th className={`py-2 font-medium ${align === "end" ? "text-end" : "text-start"}`}>{children}</th>
  );
}

function Td({
  children,
  align,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  align?: "end";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`py-2.5 ${align === "end" ? "text-end" : "text-start"} ${className}`}
    >
      {children}
    </td>
  );
}
