"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";

import { liftPause } from "@/app/(admin)/admin/benefits/actions";
import { Badge, Button, Card, EmptyState } from "@/components/ui";

export type PausedRow = {
  enrolmentId: string;
  name: string;
  email: string | null;
  sponsorName: string;
  identifierKind: string;
  pausedLabel: string;
  daysPaused: number;
};

/**
 * 🔴 C247's remedy, with a button on it. PLAN.md 53.19b.
 *
 * ## The sentence this screen exists for
 *
 * *"A person on extended leave who cannot reach their work inbox has their
 * benefit pause, which is a real and unfair outcome, so the pause must be
 * reversible by us in one step and must never touch their record."*
 *
 * `unpause` has been that one step since sprint 53 and had no caller, so the
 * remedy existed in a comment and nowhere a person could reach. This is the
 * screen that makes the sentence true.
 *
 * ## 🔴 WHY AN `id_number` ROW IS CALLED OUT
 *
 * There is nothing for that person to re-verify: C247 says an ID number has no
 * proof to re-collect, so answering is not something they CAN do. An operator
 * looking at one of those rows is looking at somebody who cannot fix it
 * themselves, which is a different decision from somebody who simply has not
 * replied yet, and the badge says which.
 *
 * ## What is deliberately not here
 *
 * No sessions, no notes, no spend, no pot. Enrolment is eligibility and never
 * therapy (53.2), and the query behind this screen cannot reach a clinical
 * table. A paused benefit means an unanswered re-verification and nothing more.
 */
export function PausedBenefits({ rows }: { rows: PausedRow[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Nobody is waiting"
          body="Every benefit is either live or removed. Paused ones appear here the moment a re-verification goes unanswered."
        />
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-slate-100">
      {error ? (
        <p className="px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      {rows.map((row) => (
        <div
          key={row.enrolmentId}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
            <p className="truncate text-xs text-slate-500">
              {row.sponsorName}
              {row.email ? ` · ${row.email}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/*
              🔴 The number of days is the whole point of ordering this list.
              A benefit paused for eleven weeks is a person who has been paying
              for their own therapy for eleven weeks.
            */}
            <Badge tone={row.daysPaused >= 30 ? "red" : "amber"}>
              {row.pausedLabel}
            </Badge>

            {row.identifierKind === "id_number" ? (
              <Badge tone="slate">Cannot self-serve</Badge>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2.5 text-xs"
              disabled={pending && busy === row.enrolmentId}
              onClick={() => {
                setBusy(row.enrolmentId);
                setError(null);
                start(async () => {
                  const result = await liftPause(row.enrolmentId);
                  if (result.error) setError(result.error);
                  setBusy(null);
                });
              }}
            >
              {pending && busy === row.enrolmentId ? "…" : "Lift the pause"}
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
