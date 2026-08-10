import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { investigate } from "@/lib/data/radar-admin";
import { formatDate, formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Investigation", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The one place in the admin console that shows a transcript.
 *
 * This is what was built instead of impersonation. Signing in as a clinician
 * would have given a support agent a fully authenticated view of every chart
 * they hold, indefinitely, to answer a question about one session. This shows
 * one session — the one somebody complained about — reachable only from that
 * complaint, and writes an audit row before a word of it renders.
 *
 * The off-record gaps are the reason it exists at all. A patient alleging
 * something happened while the recording was paused deserves to have that pause
 * be a fact with a timestamp, rather than an argument about whether it
 * happened. It cuts both ways: a clinician accused of something during a period
 * the microphone was demonstrably still running has that too.
 */
export default async function InvestigatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("super_admin");
  const { id } = await params;

  const found = await investigate(id);
  if (!found) notFound();

  const { report, gaps, transcript } = found;

  await audit({
    actor,
    category: "phi_access",
    action: "break_glass.investigate",
    resourceType: "session",
    resourceId: report.sessionId,
    patientId: report.patientId,
    reason: `Report ${report.id} — ${report.kind}`,
  });

  return (
    <div className="space-y-5">
      <Link
        href="/admin/radar"
        className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Radar control
      </Link>

      <Card className="border-amber-200 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          You are reading a therapy transcript
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          This visit is recorded in the audit log against your name, with the report that justified
          it. It is the only session you can open from here.
        </p>
      </Card>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {report.kind === "abuse" ? "Conduct report" : "Report"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {report.therapistName} · session{" "}
          {report.endedAt ? formatDate(report.endedAt) : "in progress"}
          {report.durationMinutes ? ` · ${report.durationMinutes} min` : ""} · filed{" "}
          {formatDate(report.createdAt)}
        </p>
      </div>

      {report.detail ? (
        <Card className="p-4">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            What the patient said
          </p>
          <blockquote className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-800 italic">
            “{report.detail}”
          </blockquote>
          {report.patientEmail ? (
            <p className="mt-2 text-xs text-slate-500">Reply to: {report.patientEmail}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
          <EyeOff className="h-3 w-3" aria-hidden />
          Periods with no recording
        </p>
        {gaps.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            None. The microphone ran continuously for the whole session, so everything that was
            said is below.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              {gaps.length} {gaps.length === 1 ? "gap" : "gaps"} — the recording was off. We have
              the timings, not the words.
            </p>
            <ul className="mt-2 space-y-1">
              {gaps.map((gap) => (
                <li
                  key={gap.fromMs}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-slate-500">
                    {formatDuration(Math.round(gap.fromMs / 1000))} →{" "}
                    {formatDuration(Math.round(gap.toMs / 1000))}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {gap.seconds >= 60
                      ? `${Math.floor(gap.seconds / 60)} min ${gap.seconds % 60}s`
                      : `${gap.seconds}s`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
          Transcript — {transcript.length} lines
        </p>
        <div className="mt-2 max-h-[36rem] space-y-1.5 overflow-y-auto">
          {transcript.map((line, index) => (
            <p key={index} className="text-sm leading-relaxed">
              <span className="mr-2 font-mono text-[11px] text-slate-400 tabular-nums">
                {formatDuration(Math.round(line.startMs / 1000))}
              </span>
              <span className="font-semibold text-navy-500">
                {line.speaker === "patient"
                  ? "Patient"
                  : line.speaker === "therapist"
                    ? "Therapist"
                    : "Speaker"}
              </span>{" "}
              <span className="text-slate-700">{line.text}</span>
            </p>
          ))}
          {transcript.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing was recorded for this session at all.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
