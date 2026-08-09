import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";

import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listSessions } from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Sessions", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const actor = await requireUser();
  const sessions = await listSessions(actor);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Sessions"
        action={
          <Link href="/sessions/new" className="hidden lg:block">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden /> New
            </Button>
          </Link>
        }
      />

      <div className="px-4 pb-10 sm:px-6">
        {sessions.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" aria-hidden />}
              title="No sessions yet"
              body="Start one and your note will be waiting when you finish."
              action={
                <Link href="/sessions/new">
                  <Button variant="teal">Start a session</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const label =
                fullName(session.patientFirstName, session.patientLastName, "") ||
                session.guestName ||
                "Unnamed patient";
              const live = session.status === "in_progress" || session.status === "scheduled";

              return (
                <li key={session.id}>
                  <Link
                    href={live ? `/sessions/${session.id}/room` : `/sessions/${session.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-900">{label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {relativeDay(session.endedAt ?? session.createdAt)}
                        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
                        {session.modality === "video" ? " · Video" : ""}
                      </p>
                    </div>

                    <RowBadge status={session.status} noteStatus={session.noteStatus} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function RowBadge({ status, noteStatus }: { status: string; noteStatus: string }) {
  if (status === "in_progress") return <Badge tone="red">Live</Badge>;
  if (status === "scheduled") return <Badge tone="amber">Not started</Badge>;
  if (status === "cancelled") return <Badge tone="slate">Cancelled</Badge>;
  if (noteStatus === "generating") return <Badge tone="brand">Writing…</Badge>;
  if (noteStatus === "failed") return <Badge tone="amber">Note failed</Badge>;
  return <Badge tone="green">Note ready</Badge>;
}
