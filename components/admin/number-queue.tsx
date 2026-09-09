"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PhoneCall, ShieldAlert } from "lucide-react";

import {
  approve,
  refuse,
  sendCode,
  type NumberState,
} from "@/app/(admin)/admin/numbers/actions";
import { Badge, Button, Card, Input } from "@/components/ui";

const INITIAL: NumberState = {};

/**
 * Changing the number an identity hangs on. PLAN.md 20.13–20.17.
 *
 * ## 🔴 What a staff member sees, and what they do not
 *
 * The two numbers, the patient's own words, and how long it has waited. Not
 * the account, not the record, not who the person is (20.9). Everything needed
 * to decide "is this a real request from the person who owns it" and nothing
 * that would answer "who is this".
 *
 * The old number is shown in full because staff have to call it; the reason is
 * shown verbatim because §6 forbids editing what a patient wrote, and a
 * summarised reason is an edited one.
 */

export type ChangeRow = {
  id: string;
  oldPhone: string;
  newPhone: string;
  reason: string;
  status: string;
  ageHours: number;
  approved: boolean;
  createdAtLabel: string;
  codeExpiresLabel: string | null;
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

export function NumberQueue({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-5 text-sm text-slate-500">
        No number changes waiting.
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </ul>
  );
}

function Row({ row }: { row: ChangeRow }) {
  const [approveState, approveAction] = useActionState(approve, INITIAL);
  const [codeState, codeAction] = useActionState(sendCode, INITIAL);
  const [refuseState, refuseAction] = useActionState(refuse, INITIAL);

  const error = approveState.error ?? codeState.error ?? refuseState.error;
  const note = approveState.note ?? codeState.note;

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {row.ageHours}h old
          </span>
          <Badge>{row.status}</Badge>
          {row.codeExpiresLabel ? (
            <span className="text-xs text-slate-500">code expires {row.codeExpiresLabel}</span>
          ) : null}
        </div>

        <p className="mt-2 flex items-center gap-2 text-sm text-slate-900">
          <PhoneCall className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="font-mono">{row.oldPhone}</span>
          <span className="text-slate-400">→</span>
          <span className="font-mono font-semibold">{row.newPhone}</span>
        </p>

        {/* Their words, unedited. §6. */}
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {row.reason}
        </p>

        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden />
          Call or message the <strong>new</strong> number and satisfy yourself it is them before
          approving. Approving does not move the account. The code does, and only they can enter
          it.
        </p>

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {note ? <p className="mt-2 text-sm text-teal-700">{note}</p> : null}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!row.approved ? (
            <form action={approveAction} className="flex items-end gap-2">
              <input type="hidden" name="requestId" value={row.id} />
              <Input
                name="note"
                placeholder="How did you check?"
                required
                className="h-8 w-56 text-xs"
              />
              <Go label="Approve" />
            </form>
          ) : (
            <form action={codeAction}>
              <input type="hidden" name="requestId" value={row.id} />
              <Go label="Send the code to the new number" />
            </form>
          )}

          <form action={refuseAction} className="flex items-end gap-2">
            <input type="hidden" name="requestId" value={row.id} />
            <Input
              name="reason"
              placeholder="Why not. They read this"
              required
              className="h-8 w-56 text-xs"
            />
            <Go label="Refuse" quiet />
          </form>
        </div>
      </Card>
    </li>
  );
}
