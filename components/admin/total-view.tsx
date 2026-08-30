"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  Mail,
  Radio,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

import { close, mailClinicianHistory, mailRecordToPerson } from "@/app/(admin)/admin/tv/actions";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import type { NoteContent } from "@/lib/db/schema";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type Live = {
  id: string;
  startedAt: string | null;
  extended: boolean;
  modality: string;
  person: string;
  personEmail: string | null;
  clinician: string;
  clinicianEmail: string;
  recording: boolean;
  segments: number;
  lastActivityAt: string | null;
};

type RadarRow = {
  userId: string;
  name: string;
  email: string;
  status: string;
  where: string;
  lastSeenAt: string | null;
  suspended: boolean;
  rateCents: number;
  demo: boolean;
};

type Event = { at: string; kind: string; who: string; what: string; ref: string | null };

type Person = {
  key: string;
  email: string | null;
  names: string;
  therapists: string;
  sessionCount: number;
  messageCount: number;
  patientIds: string[];
};

type Message = { id: string; role: string; content: string; at: string; clinician: string };

type PersonSession = {
  id: string;
  status: string;
  modality: string;
  startedAt: string | null;
  durationMinutes: number | null;
  autoEndedReason: string | null;
  clinician: string;
  noteStatus: string | null;
  patientStatus: string | null;
  summary: string | null;
};

type Clinician = {
  id: string;
  name: string;
  email: string;
  status: string;
  verificationStatus: string;
  sessionCount: number;
  patientCount: number;
  lastLoginAt: string | null;
};

type AuditRow = {
  id: string;
  at: string;
  category: string;
  action: string;
  who: string;
  reason: string | null;
};

type Detail = {
  id: string;
  clinician: string;
  person: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  consent: string | null;
  note: NoteContent | null;
  noteStatus: string | null;
  patientStatus: string | null;
  transcript: { id: string; speaker: string; text: string }[];
  risks: { id: string; level: string; detail: string; at: string }[];
};

type Props = {
  until: string;
  hours: number;
  query: string;
  counts: Record<string, number>;
  live: Live[];
  radar: RadarRow[];
  events: Event[];
  people: Person[];
  selectedPerson: string | null;
  conversation: Message[];
  personSessions: PersonSession[];
  roster: Clinician[];
  audits: AuditRow[];
  detail: Detail | null;
};

const TABS = ["now", "timeline", "people", "clinicians", "audit"] as const;
type Tab = (typeof TABS)[number];

export function TotalView(props: Props) {
  const router = useRouter();
  const params = useSearchParams();
  // A URL carrying a person or a search is a URL asking for that tab. Landing
  // on "now" after following one of those links loses the thing that was asked
  // for without saying so.
  const [tab, setTab] = useState<Tab>(
    props.selectedPerson || props.query ? "people" : "now",
  );
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const left = new Date(props.until).getTime() - Date.now();
      if (left <= 0) {
        router.refresh();
        return;
      }
      const m = Math.floor(left / 60000);
      setRemaining(`${m}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [props.until, router]);

  // The live tab refreshes itself; the rest do not, so a long read is not
  // interrupted by the page moving under it.
  useEffect(() => {
    if (tab !== "now") return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [tab, router]);

  const go = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }
    router.push(`/admin/tv?${search.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Total View</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only, across every practice. Nothing here can be edited.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 tabular-nums">
            closes in {remaining}
          </span>
          <CloseButton />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        <Stat label="Live now" value={props.counts.live} tone="live" />
        <Stat label="On radar" value={props.counts.online} />
        <Stat label="Clinicians" value={props.counts.clinicians} />
        <Stat label="People" value={props.counts.people} />
        <Stat label="Sessions" value={props.counts.sessions} />
        <Stat label="Notes" value={props.counts.notes} />
        <Stat label="Copilot" value={props.counts.messages} />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold capitalize transition-colors",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "now" ? <Now live={props.live} radar={props.radar} onOpen={(id) => go({ session: id })} /> : null}
      {tab === "timeline" ? (
        <Timeline events={props.events} hours={props.hours} onHours={(h) => go({ hours: String(h) })} />
      ) : null}
      {tab === "people" ? (
        <People
          people={props.people}
          query={props.query}
          selected={props.selectedPerson}
          conversation={props.conversation}
          sessions={props.personSessions}
          onSearch={(q) => go({ q: q || null, person: null })}
          onSelect={(key) => go({ person: key })}
          onOpen={(id) => go({ session: id })}
        />
      ) : null}
      {tab === "clinicians" ? <Clinicians roster={props.roster} /> : null}
      {tab === "audit" ? <AuditList rows={props.audits} /> : null}

      {props.detail ? <SessionDetail detail={props.detail} onClose={() => go({ session: null })} /> : null}
    </div>
  );
}

function CloseButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await close();
          router.refresh();
        })
      }
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
      Close
    </Button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "live" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="truncate text-[11px] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-bold tabular-nums",
          tone === "live" && value > 0 ? "text-teal-600" : "text-slate-900",
        )}
      >
        {value ?? 0}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- now -- */

function Now({
  live,
  radar,
  onOpen,
}: {
  live: Live[];
  radar: RadarRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          <Activity className="h-4 w-4 text-teal-600" aria-hidden />
          In session right now
        </p>
        {live.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">Nobody is in a session.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {live.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {row.clinician} &rarr; {row.person}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {row.startedAt ? formatElapsed(minutesSince(row.startedAt)) : "—"}
                      {row.extended ? " · extended" : ""} · {row.segments} segments
                      {row.lastActivityAt
                        ? ` · last words ${formatAgo(secondsSince(row.lastActivityAt))} ago`
                        : " · silent"}
                    </span>
                  </span>
                  {row.recording ? (
                    <Badge tone="red">Recording</Badge>
                  ) : (
                    <Badge tone="amber">Paused</Badge>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          <Radio className="h-4 w-4 text-slate-400" aria-hidden />
          Radar
        </p>
        <ul className="divide-y divide-slate-100">
          {radar.map((row) => (
            <li key={row.userId} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  row.status === "online"
                    ? "live-dot bg-teal-500"
                    : row.status === "in_session"
                      ? "bg-slate-400"
                      : "bg-slate-200",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-900">{row.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {row.email}
                  {row.where ? ` · ${row.where}` : ""}
                  {row.rateCents > 0 ? ` · ${formatUsd(row.rateCents)}` : " · free"}
                </span>
              </span>
              {row.demo ? <Badge tone="slate">Fixture</Badge> : null}
              {row.suspended ? <Badge tone="red">Suspended</Badge> : null}
              <span className="shrink-0 text-xs text-slate-400 capitalize">
                {row.status.replace("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ timeline -- */

function Timeline({
  events,
  hours,
  onHours,
}: {
  events: Event[];
  hours: number;
  onHours: (h: number) => void;
}) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, Event[]>();
    for (const event of events) {
      // One row per minute, which is the resolution anybody reading a backlog
      // actually reasons in.
      const key = event.at.slice(0, 16);
      const list = buckets.get(key) ?? [];
      list.push(event);
      buckets.set(key, list);
    }
    return [...buckets.entries()];
  }, [events]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          {events.length} events, minute by minute
        </p>
        <div className="flex gap-1">
          {[1, 6, 24, 72, 168, 720].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onHours(h)}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-medium",
                hours === h ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {h < 24 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">Nothing in that window.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {grouped.map(([minute, rows]) => (
            <li key={minute} className="flex gap-3 px-4 py-2.5">
              <span className="w-28 shrink-0 pt-0.5 text-xs text-slate-400 tabular-nums">
                {minute.replace("T", " ")}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                {rows.map((row, i) => (
                  <span key={i} className="block text-sm">
                    <span className="me-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      {row.kind}
                    </span>
                    <span className="font-medium text-slate-800">{row.who}</span>
                    <span className="text-slate-600"> — {row.what}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- people -- */

function People({
  people,
  query,
  selected,
  conversation,
  sessions,
  onSearch,
  onSelect,
  onOpen,
}: {
  people: Person[];
  query: string;
  selected: string | null;
  conversation: Message[];
  sessions: PersonSession[];
  onSearch: (q: string) => void;
  onSelect: (key: string) => void;
  onOpen: (id: string) => void;
}) {
  const [term, setTerm] = useState(query);
  const person = people.find((p) => p.key === selected);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(term);
        }}
        className="flex gap-2"
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Name or email"
          aria-label="Search people"
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" aria-hidden />
        </Button>
      </form>

      {person ? (
        <PersonDetail person={person} conversation={conversation} sessions={sessions} onOpen={onOpen} />
      ) : null}

      <Card className="overflow-hidden">
        <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          <Users className="h-4 w-4 text-slate-400" aria-hidden />
          {people.length} people
        </p>
        <ul className="divide-y divide-slate-100">
          {people.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onSelect(p.key)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50",
                  selected === p.key && "bg-slate-50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {p.names || "—"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.email ?? "no email on file"} · {p.therapists}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                  {p.sessionCount}s · {p.messageCount}m
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PersonDetail({
  person,
  conversation,
  sessions,
  onOpen,
}: {
  person: Person;
  conversation: Message[];
  sessions: PersonSession[];
  onOpen: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{person.names}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {person.email ?? "no email"} · seen by {person.therapists} ·{" "}
          {person.patientIds.length} chart{person.patientIds.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || person.patientIds.length === 0}
            onClick={() =>
              start(async () => {
                setMessage(null);
                const result = await mailRecordToPerson(person.patientIds[0]!);
                setMessage(result.error ?? `Sent to ${result.sentTo}, copy to you.`);
              })
            }
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Sending…" : "Email their record to them"}
          </Button>
          <span className="text-xs text-slate-400">
            Goes to the address on the chart. You are blind-copied.
          </span>
        </div>
        {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}
      </div>

      {sessions.length > 0 ? (
        <ul className="divide-y divide-slate-100 border-b border-slate-100">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800">
                    {s.startedAt ? s.startedAt.slice(0, 16).replace("T", " ") : "not started"} ·{" "}
                    {s.clinician}
                  </span>
                  {s.summary ? (
                    <span className="block truncate text-xs text-slate-500">{s.summary}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {s.durationMinutes ? `${s.durationMinutes} min` : s.status}
                  {s.autoEndedReason ? ` · ${s.autoEndedReason}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {conversation.length > 0 ? (
        <div className="max-h-[28rem] space-y-2.5 overflow-y-auto px-4 py-3">
          {conversation.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "therapist" ? "bg-brand-50 text-slate-800" : "bg-slate-100 text-slate-700",
              )}
            >
              <p className="mb-1 text-[11px] text-slate-500">
                {m.role} · {m.clinician} · {m.at.slice(0, 16).replace("T", " ")}
              </p>
              {m.content}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-slate-500">No copilot conversation on record.</p>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------- clinicians -- */

function Clinicians({ roster }: { roster: Clinician[] }) {
  return (
    <Card className="overflow-hidden">
      <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        {roster.length} clinicians
      </p>
      <ul className="divide-y divide-slate-100">
        {roster.map((c) => (
          <ClinicianRow key={c.id} clinician={c} />
        ))}
      </ul>
    </Card>
  );
}

function ClinicianRow({ clinician }: { clinician: Clinician }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {clinician.name}
          </span>
          <span className="block truncate text-xs text-slate-500">{clinician.email}</span>
        </span>
        <span className="shrink-0 text-xs text-slate-400 tabular-nums">
          {clinician.sessionCount}s · {clinician.patientCount}p
        </span>
        {clinician.status === "suspended" ? <Badge tone="red">Suspended</Badge> : null}
        <Badge tone={clinician.verificationStatus === "verified" ? "green" : "amber"}>
          {clinician.verificationStatus}
        </Badge>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            Disclose their practice record
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            Sessions and note status as a spreadsheet — no transcripts. The clinician is told it
            happened, and the reason below is kept in the audit record. You are blind-copied.
          </p>
          <Field label="Send to" htmlFor={`to-${clinician.id}`}>
            <Input
              id={`to-${clinician.id}`}
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="records@example.gov"
            />
          </Field>
          <Field label="Reason and authority" htmlFor={`why-${clinician.id}`}>
            <Textarea
              id={`why-${clinician.id}`}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {message ? <p className="text-xs text-slate-600">{message}</p> : null}
          <Button
            size="sm"
            disabled={pending || !to || reason.trim().length < 20}
            onClick={() =>
              start(async () => {
                setMessage(null);
                const result = await mailClinicianHistory({
                  therapistId: clinician.id,
                  to,
                  reason,
                });
                setMessage(result.error ?? `Sent to ${result.sentTo}.`);
                if (!result.error) {
                  setTo("");
                  setReason("");
                }
              })
            }
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/* ----------------------------------------------------------------- audit */

function AuditList({ rows }: { rows: AuditRow[] }) {
  return (
    <Card className="overflow-hidden">
      <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        Audit log
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 px-4 py-2.5">
            <span className="w-28 shrink-0 text-xs text-slate-400 tabular-nums">
              {row.at.slice(0, 16).replace("T", " ")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-slate-800">
                <span className="me-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  {row.action}
                </span>{" "}
                {row.who}
              </span>
              {row.reason ? (
                <span className="block truncate text-xs text-slate-500">{row.reason}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --------------------------------------------------------------- detail */

function SessionDetail({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {detail.clinician} &rarr; {detail.person}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {detail.startedAt?.slice(0, 16).replace("T", " ") ?? "not started"}
              {detail.durationMinutes ? ` · ${detail.durationMinutes} min` : ""}
              {detail.consent ? ` · consent ${detail.consent}` : " · consent not recorded"}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {detail.risks.length > 0 ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              {detail.risks.map((r) => (
                <p key={r.id} className="text-sm text-amber-900">
                  <span className="font-semibold capitalize">{r.level}</span>
                  {r.detail ? ` — ${r.detail}` : ""}
                </p>
              ))}
            </div>
          ) : null}

          {detail.note ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-slate-400" aria-hidden />
                Note
                <Badge tone={detail.noteStatus === "approved" ? "green" : "amber"}>
                  {detail.noteStatus ?? "none"}
                </Badge>
                <Badge tone={detail.patientStatus === "approved" ? "green" : "slate"}>
                  patient {detail.patientStatus ?? "none"}
                </Badge>
              </p>
              {(
                [
                  ["Summary", detail.note.summary],
                  ["Subjective", detail.note.soap.subjective],
                  ["Objective", detail.note.soap.objective],
                  ["Assessment", detail.note.soap.assessment],
                  ["Plan", detail.note.soap.plan],
                  ["Impressions", detail.note.impressions],
                  ["Patient brief", detail.note.patientBrief],
                ] as const
              ).map(([label, body]) =>
                body ? (
                  <div key={label}>
                    <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{body}</p>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}

          {detail.transcript.length > 0 ? (
            <details className="rounded-2xl border border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                Transcript
                <span className="ms-2 text-xs font-normal text-slate-400">
                  {detail.transcript.length} segments
                </span>
              </summary>
              <div className="max-h-96 space-y-2 overflow-y-auto border-t border-slate-100 px-4 py-3">
                {detail.transcript.map((t) => (
                  <p key={t.id} className="text-sm leading-relaxed text-slate-600">
                    <span className="me-1.5 text-xs font-medium text-slate-400 capitalize">
                      {t.speaker}
                    </span>
                    {t.text}
                  </p>
                ))}
              </div>
            </details>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4" aria-hidden />
              No transcript captured.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Minutes read badly past an hour, and a stuck session is measured in days. */
function formatElapsed(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  if (minutes < 60 * 36) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function formatAgo(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 60 * 60 * 36) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function secondsSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}
