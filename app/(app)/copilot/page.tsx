import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listThreads } from "@/lib/data/copilot";
import { listPatients } from "@/lib/data/patients";
import { getSettings } from "@/lib/settings";
import { fullName, initials, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Copilot", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The copilot inbox: one conversation per patient.
 *
 * Patients without a thread yet are listed too, so starting a conversation is
 * one tap rather than a thing you have to know exists.
 */
export default async function CopilotInboxPage() {
  const actor = await requireUser();
  const [threads, patients, settings] = await Promise.all([
    listThreads(actor),
    listPatients(actor),
    getSettings(),
  ]);

  const withThreads = new Set(threads.map((t) => t.patientId));
  const untouched = patients.filter((p) => !withThreads.has(p.id));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Copilot"
        subtitle="One conversation per patient. Each knows only that patient."
      />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
          Every session you complete earns {settings.copilot.messagesPerPatientPerSession} copilot
          questions about that patient. Unused ones roll over and last{" "}
          {settings.pricing.creditExpiryMonths} months.
        </p>

        {threads.length === 0 && untouched.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" aria-hidden />}
              title="No patients yet"
              body="Run a session and a copilot conversation appears here for that patient."
            />
          </Card>
        ) : null}

        {threads.length > 0 ? (
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li key={thread.threadId}>
                <Link
                  href={`/copilot/${thread.patientId}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-500 text-xs font-semibold text-white">
                    {initials(thread.firstName, thread.lastName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-900">
                        {fullName(thread.firstName, thread.lastName)}
                      </span>
                      {thread.lastMessageAt ? (
                        <span className="shrink-0 text-xs text-slate-400">
                          {relativeDay(thread.lastMessageAt)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {thread.lastMessage ?? `${thread.sessionCount} sessions on record`}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {untouched.length > 0 ? (
          <Card>
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              Start a conversation
            </p>
            <ul className="divide-y divide-slate-100">
              {untouched.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/copilot/${patient.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {fullName(patient.firstName, patient.lastName)}
                    </span>
                    <Badge tone="slate">{patient.sessionCount} sessions</Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
