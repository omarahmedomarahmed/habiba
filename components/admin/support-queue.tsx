"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Clock, MessageSquare, PauseCircle, UserCheck } from "lucide-react";

import {
  close,
  extend,
  moveToWhatsapp,
  takeTicket,
  waitOnThem,
  type SupportState,
} from "@/app/(admin)/admin/support/actions";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";

const INITIAL: SupportState = {};

/**
 * The two support queues. PLAN.md 20.18–20.26, §3d.
 *
 * ## 🔴 Two lists, not one filtered list
 *
 * 20.24: *"A therapist chasing a payout and a patient in distress are
 * different jobs with different clocks, and one list sorted by age puts them
 * in the wrong order."* They are separate tabs over separate queries, and the
 * patient queue is the one that opens by default.
 *
 * ## What is not on this screen
 *
 * The message. A queue is triage — topic, age, owner — and a list view that
 * renders every body puts a hundred people's health information on one screen
 * (18R.4). Opening one is a separate, audited read.
 *
 * ## Overdue is our delay, never theirs
 *
 * A ticket parked on *waiting* shows as waiting, not as late, however long the
 * other person takes (20.20 / C83).
 */

export type TicketRow = {
  id: string;
  reference: string;
  name: string;
  topic: string;
  status: string;
  locale: string;
  ownerName: string | null;
  ageHours: number;
  overdue: boolean;
  waiting: boolean;
  extended: boolean;
  movedToWhatsapp: boolean;
  hasContext: boolean;
  createdAtLabel: string;
};

const TOPIC_LABELS: Record<string, string> = {
  account: "Account",
  billing: "Billing",
  my_record: "Their record",
  a_session: "A session",
  a_therapist: "A therapist",
  joining_as_a_therapist: "Joining",
  something_else: "Other",
};

function Go({ label, quiet }: { label: string; quiet?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={quiet ? "secondary" : undefined}
      disabled={pending}
      className="h-8 px-2.5 text-xs"
    >
      {pending ? "…" : label}
    </Button>
  );
}

export function SupportQueue({
  patient,
  therapist,
  canSeeHealth,
  health,
}: {
  patient: TicketRow[];
  therapist: TicketRow[];
  /** 20.8 — managers only. Staff work the queue; they do not watch it. */
  canSeeHealth: boolean;
  health: { audience: string; open: number; waiting: number; overdue: number; unowned: number }[];
}) {
  const [tab, setTab] = useState<"patient" | "therapist">("patient");
  const rows = tab === "patient" ? patient : therapist;

  return (
    <div className="space-y-4">
      {canSeeHealth ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">How the queues are doing</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {health.map((row) => (
              <div key={row.audience} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-medium capitalize text-slate-900">{row.audience}</p>
                <p className="mt-1 text-slate-600">
                  {row.open} open · {row.waiting} waiting on them ·{" "}
                  <span className={row.overdue > 0 ? "font-semibold text-rose-600" : ""}>
                    {row.overdue} overdue
                  </span>{" "}
                  · {row.unowned} nobody owns
                </p>
              </div>
            ))}
            {health.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing in either queue.</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Tab active={tab === "patient"} onClick={() => setTab("patient")}>
          Patients · {patient.length}
        </Tab>
        <Tab active={tab === "therapist"} onClick={() => setTab("therapist")}>
          Therapists · {therapist.length}
        </Tab>
      </div>

      {rows.length === 0 ? (
        <Card className="p-5 text-sm text-slate-500">
          Nothing waiting. Everybody who wrote in has had an answer.
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <TicketCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600"
      }
    >
      {children}
    </button>
  );
}

function TicketCard({ row }: { row: TicketRow }) {
  const [takeState, takeAction] = useActionState(takeTicket, INITIAL);
  const [waitState, waitAction] = useActionState(waitOnThem, INITIAL);
  const [extendState, extendAction] = useActionState(extend, INITIAL);
  const [moveState, moveAction] = useActionState(moveToWhatsapp, INITIAL);
  const [closeState, closeAction] = useActionState(close, INITIAL);

  const error =
    takeState.error ?? waitState.error ?? extendState.error ?? moveState.error ?? closeState.error;
  const note = moveState.note ?? closeState.note;

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              row.overdue
                ? "inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                : row.waiting
                  ? "inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                  : "inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            }
          >
            {row.overdue ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
            {row.waiting ? <PauseCircle className="h-3 w-3" aria-hidden /> : null}
            {row.waiting ? "waiting on them" : `${row.ageHours}h old`}
          </span>

          <span className="font-mono text-xs text-slate-400">{row.reference}</span>
          <span className="text-sm font-semibold text-slate-900">{row.name}</span>
          <Badge>{TOPIC_LABELS[row.topic] ?? row.topic}</Badge>
          {row.locale !== "en" ? <Badge>{row.locale}</Badge> : null}
          {row.extended ? <Badge tone="amber">extended</Badge> : null}
          {row.movedToWhatsapp ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MessageSquare className="h-3 w-3" aria-hidden />
              on WhatsApp
            </span>
          ) : null}
          {row.hasContext ? <Badge>has context</Badge> : null}
          {row.ownerName ? (
            <span className="ms-auto inline-flex items-center gap-1 text-xs text-slate-500">
              <UserCheck className="h-3 w-3" aria-hidden />
              {row.ownerName}
            </span>
          ) : (
            <span className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
              <Clock className="h-3 w-3" aria-hidden />
              nobody owns this
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Arrived {row.createdAtLabel}. Open it to read what they wrote — that read is logged.
        </p>

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {note ? <p className="mt-2 text-sm text-teal-700">{note}</p> : null}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!row.ownerName ? (
            <form action={takeAction}>
              <input type="hidden" name="ticketId" value={row.id} />
              <Go label="Take it on" quiet />
            </form>
          ) : null}

          {!row.waiting ? (
            <form action={waitAction} className="flex items-end gap-2">
              <input type="hidden" name="ticketId" value={row.id} />
              <Input
                name="note"
                placeholder="What did you ask them?"
                required
                className="h-8 w-56 text-xs"
              />
              <Go label="Waiting on them" quiet />
            </form>
          ) : null}

          {!row.extended ? (
            <form action={extendAction} className="flex items-end gap-2">
              <input type="hidden" name="ticketId" value={row.id} />
              <Input
                name="reason"
                placeholder="Why another day?"
                required
                className="h-8 w-48 text-xs"
              />
              <Go label="Extend once" quiet />
            </form>
          ) : null}

          {!row.movedToWhatsapp ? (
            <form action={moveAction}>
              <input type="hidden" name="ticketId" value={row.id} />
              <Go label="Moved to WhatsApp" quiet />
            </form>
          ) : null}
        </div>

        <form action={closeAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="ticketId" value={row.id} />
          <Textarea
            name="summary"
            rows={2}
            placeholder="What was done. They will read this on a page that authenticates — never in an email."
            required
          />
          <Go label="Close and send the link" />
        </form>
      </Card>
    </li>
  );
}
