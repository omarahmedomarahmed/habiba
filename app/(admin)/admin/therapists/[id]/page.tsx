import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { TherapistAdminPanel } from "@/components/admin/therapist-panel";
import { Badge, Card } from "@/components/ui";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { earningsSummary, recentPayments } from "@/lib/billing/connect";
import { formatUsd } from "@/lib/billing/plans";
import { listInvoices } from "@/lib/billing/service";
import {
  therapistAiSpend,
  therapistCopilotUsage,
  therapistOverview,
  therapistPatients,
  therapistSessions,
} from "@/lib/data/admin";
import { formatDate, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Clinician", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * One clinician, end to end, for an operator.
 *
 * The PHI line is drawn in the queries, not in this file: `therapistSessions`
 * and `therapistCopilotUsage` never select transcript text, note content, risk
 * indicators or copilot messages, so there is no state of this page from which
 * a session can be read. Identifiers and metadata are shown, because you cannot
 * run a support desk blind — and every visit writes a `break_glass` audit row.
 */
export default async function TherapistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("super_admin");
  const { id } = await params;

  const therapist = await therapistOverview(id);
  if (!therapist) notFound();

  // Written before the reads render, so an operator who opens this page and
  // immediately closes it has still left a mark.
  await audit({
    actor,
    category: "break_glass",
    action: "admin.therapist.view",
    resourceType: "user",
    resourceId: id,
    reason: "Operator opened a clinician's account overview",
  });

  const [patients, sessions, copilot, aiSpend, invoices, earnings, payments] = await Promise.all([
    therapistPatients(id),
    therapistSessions(id),
    therapistCopilotUsage(id),
    therapistAiSpend(id),
    listInvoices(therapist.organizationId, 200),
    earningsSummary(id),
    recentPayments(id, 100),
  ]);

  const aiTotal = aiSpend.reduce((sum, row) => sum + row.costCents, 0);
  const completed = sessions.filter((s) => s.status === "completed").length;
  const copilotAsked = copilot.reduce((sum, row) => sum + row.asked, 0);
  const revenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amountCents - i.discountCents), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/therapists"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All clinicians
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {fullName(therapist.firstName, therapist.lastName, "Unnamed")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {therapist.email} · {therapist.organizationName} · joined{" "}
              {formatDate(therapist.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={therapist.status === "active" ? "green" : "red"}>
              {therapist.status}
            </Badge>
            <Badge tone={therapist.verificationStatus === "verified" ? "teal" : "slate"}>
              {therapist.verificationStatus}
            </Badge>
            <Badge tone={therapist.plan && therapist.plan !== "payg" ? "brand" : "slate"}>
              {therapist.plan ?? "payg"}
            </Badge>
            {therapist.chargesEnabled ? <Badge tone="teal">Stripe connected</Badge> : null}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completed sessions" value={String(completed)} />
        <Stat label="Patients" value={String(patients.length)} />
        <Stat label="Copilot questions" value={String(copilotAsked)} />
        <Stat
          label="Contribution"
          value={formatUsd(revenue + earnings.platformFeesCents - aiTotal)}
          sub={`${formatUsd(revenue + earnings.platformFeesCents)} in · ${formatUsd(aiTotal)} model spend`}
        />
      </div>

      {/*
        The one thing this console cannot do, said out loud. An operator should
        know the limit is structural rather than assume something is missing.
      */}
      <Card className="flex items-start gap-2.5 border-slate-200 bg-slate-50 p-3.5">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">You cannot read clinical content here.</span>{" "}
          Transcripts, note text, risk indicators and copilot messages are not selected by any query
          behind this page — there is no toggle that reveals them. What you can see is who the
          patients are, when sessions happened and every penny in both directions. This visit is in
          the audit log.
        </p>
      </Card>

      <TherapistAdminPanel
        therapistId={therapist.id}
        therapistName={fullName(therapist.firstName, therapist.lastName, "this clinician")}
        organizationId={therapist.organizationId}
        status={therapist.status}
        verification={therapist.verificationStatus}
        credentials={therapist.profile?.credentials ?? null}
        licence={[therapist.profile?.licenseType, therapist.profile?.licenseNumber, therapist.profile?.licenseState]
          .filter(Boolean)
          .join(" · ")}
        rateCents={therapist.sessionRateCents}
        payoutsEnabled={therapist.payoutsEnabled}
        earnings={{
          lifetimeNetCents: earnings.lifetimeNetCents,
          platformFeesCents: earnings.platformFeesCents,
          paidSessionCount: earnings.paidSessionCount,
        }}
        patients={patients.map((p) => ({
          id: p.id,
          name: fullName(p.firstName, p.lastName, "Unnamed"),
          email: p.email,
          phone: p.phone,
          source: p.source,
          sessionCount: p.sessionCount,
          copilotMessages: p.copilotMessages,
          lastSessionAt: p.lastSessionAt ? formatDate(p.lastSessionAt) : null,
        }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          when: formatDate(s.createdAt),
          status: s.status,
          modality: s.modality,
          noteStatus: s.noteStatus,
          durationMinutes: s.durationMinutes,
          segmentCount: s.segmentCount,
          priceCents: s.priceCents,
          paymentStatus: s.paymentStatus,
          reportSent: Boolean(s.reportSentAt),
          patient: fullName(s.patientFirstName, s.patientLastName, "") || s.guestName || "Unnamed",
        }))}
        copilot={copilot.map((c) => ({
          threadId: c.threadId,
          patient: fullName(c.patientFirstName, c.patientLastName, "Unnamed"),
          asked: c.asked,
          askedThisMonth: c.askedThisMonth,
          corrections: c.corrections,
          lastMessageAt: c.lastMessageAt ? formatDate(c.lastMessageAt) : null,
        }))}
        aiSpend={aiSpend.map((row) => ({
          kind: row.kind,
          calls: row.calls,
          costCents: row.costCents,
          errors: row.errors,
        }))}
        invoices={invoices.map((i) => ({
          id: i.id,
          kind: i.kind,
          description: i.description,
          amountCents: i.amountCents,
          discountCents: i.discountCents,
          discountReason: i.discountReason,
          status: i.status,
          issuedAt: formatDate(i.issuedAt),
          paidAt: i.paidAt ? formatDate(i.paidAt) : null,
        }))}
        payments={payments.map((p) => ({
          id: p.id,
          payerName: p.payerName,
          grossCents: p.grossCents,
          therapistNetCents: p.therapistNetCents,
          settledInvoiceCents: p.settledInvoiceCents,
          status: p.status,
          when: formatDate(p.paidAt ?? p.createdAt),
        }))}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Eye className="h-3 w-3" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}
