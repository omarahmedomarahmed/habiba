import type { Metadata } from "next";

import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import {
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

  const [perSession, byKind, byTherapist] = await Promise.all([
    costPerSession(30),
    usageByKind(30),
    usageByTherapist(30),
  ]);

  const totalMicrocents = byKind.reduce((sum, row) => sum + Number(row.microcents ?? 0), 0);
  const totalFees = byTherapist.reduce((sum, row) => sum + row.feeCents, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Usage</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Last 30 days. Model spend, audio minutes and what patients paid — no clinical content.
        </p>
      </div>

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
            We took <strong>{formatUsd(totalFees)}</strong> and spent{" "}
            <strong>{formatMicrocents(totalMicrocents)}</strong> on models — a gross margin of{" "}
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
              <tr className="border-b border-slate-100 text-start text-xs text-slate-400">
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
                      <span className="text-slate-300">—</span>
                    )}
                  </Td>
                  <Td align="end" className="font-medium">
                    {formatMicrocents(Number(row.microcents ?? 0))}
                  </Td>
                </tr>
              ))}
              {byKind.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-6 text-center text-slate-400">
                    No model calls in the last 30 days.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Per clinician</p>
        <p className="mt-0.5 text-sm text-slate-500">
          Sorted by spend. The one at the top is the one who decides whether unlimited works.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-start text-xs text-slate-400">
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
                      <span className="font-medium text-slate-900">
                        {fullName(row.firstName, row.lastName, "")}
                      </span>
                      <span className="block truncate text-xs text-slate-400">{row.email}</span>
                    </Td>
                    <Td align="end">{row.sessions}</Td>
                    <Td align="end">{row.audioMinutes} min</Td>
                    <Td align="end">{row.aiCalls}</Td>
                    <Td align="end" className={underwater ? "font-semibold text-red-600" : ""}>
                      {formatMicrocents(row.costMicrocents)}
                    </Td>
                    <Td align="end">{formatUsd(row.patientCents)}</Td>
                    <Td align="end" className="font-medium text-teal-700">
                      {formatUsd(row.feeCents)}
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
        className={`mt-1 text-2xl font-bold tracking-tight ${tone === "teal" ? "text-teal-600" : "text-slate-900"}`}
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
