"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Clock, MessageSquare, PauseCircle, UserCheck } from "lucide-react";

import {
  close,
  extend,
  moveToWhatsapp,
  openTicket,
  reply,
  takeTicket,
  waitOnThem,
  type OpenedTicket,
  type SupportState,
} from "@/app/(admin)/admin/support/actions";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

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
  const [replyState, replyAction] = useActionState(reply, INITIAL);
  const t = useT();
  /*
   * 🔴 W2-A02: the audited read, on a button. `openTicket` existed and nothing
   * called it, so nobody on the queue could read what anybody wrote.
   */
  const [opened, setOpened] = useState<OpenedTicket | null>(null);
  const [opening, startOpening] = useTransition();

  const error =
    takeState.error ??
    waitState.error ??
    extendState.error ??
    moveState.error ??
    closeState.error ??
    replyState.error;
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
                  ? "inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                  : "inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            }
          >
            {row.overdue ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
            {row.waiting ? <PauseCircle className="h-3 w-3" aria-hidden /> : null}
            {row.waiting ? "waiting on them" : `${row.ageHours}h old`}
          </span>

          <span className="font-mono text-xs text-slate-500">{row.reference}</span>
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
          Arrived {row.createdAtLabel}. Reading it is logged.
        </p>

        {opened ? (
          <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
            <p className="whitespace-pre-wrap">{opened.message}</p>
            {opened.events
              .filter((event) => event.note)
              .map((event, index) => (
                <p key={index} className="text-xs text-slate-500">
                  {event.at} · {event.kind} · {event.note}
                </p>
              ))}
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            disabled={opening}
            onClick={() => startOpening(async () => setOpened(await openTicket(row.id)))}
          >
            {t("asupport.open")}
          </Button>
        )}

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {note ? <p className="mt-2 text-sm text-brand-700">{note}</p> : null}

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

        {/* 🔴 W2-A02: a reply that does not close, behind the same link and code. */}
        <form action={replyAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="ticketId" value={row.id} />
          <Textarea name="reply" rows={2} placeholder={t("asupport.replyHint")} required minLength={10} />
          <Go label={t("asupport.reply")} quiet />
        </form>

        <form action={closeAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="ticketId" value={row.id} />
          <Textarea name="summary" rows={2} placeholder={t("asupport.replyHint")} required minLength={10} />
          {/*
            🔴 W2-A02: a ticket moved to WhatsApp could never close, because the
            CHECK wants what was agreed there and nothing wrote it. It is
            written here, at the close.
          */}
          {row.movedToWhatsapp ? (
            <Textarea
              name="whatsappSummary"
              rows={2}
              placeholder={t("asupport.whatsapp")}
              required
              minLength={20}
            />
          ) : null}
          <Go label="Close and send the link" />
        </form>
      </Card>
    </li>
  );
}
