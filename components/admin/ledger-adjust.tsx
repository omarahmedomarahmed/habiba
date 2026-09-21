"use client";

import { useState, useTransition } from "react";

import { adjustLedger } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { LEDGER_ACCOUNTS, type LedgerAccount } from "@/lib/db/schema";

/**
 * 🔴 58.1 — the screen `adjustLedger` never had.
 *
 * ## What was wrong
 *
 * `adjustLedger` is the accounting escape hatch. Its own header calls it
 * "deliberately an uncomfortable one": it demands a reason, records who, and
 * posts a **balanced pair** rather than editing a balance, so there is no way
 * to make the ledger disagree with itself from here.
 *
 * All of that was written, typed and exported, and **no screen called it**. The
 * hatch existed in the sense that a function existed. Nobody could open it.
 *
 * `verify:reachable` found it on its first run, alongside a patient who could
 * not sign out and a therapist who could not cancel a session. None of the
 * three was visible to any test, type or verifier in this repository, because
 * every one of them asks whether code is correct rather than whether a person
 * can reach it.
 *
 * ## Why a signed amount rather than a debit and a credit
 *
 * `postAdjustment` takes one account and one signed amount and raises the
 * balancing leg itself. Asking an operator at 3am to name both legs is asking
 * them to get a sign convention right under pressure, which is how a correction
 * becomes a second error. One number, one account, and the machinery balances.
 *
 * ## The reason field is not optional and not cosmetic
 *
 * It goes into the audit row. An adjustment without a reason is indistinguishable
 * from a mistake six months later, and the person reading it will not be the
 * person who made it.
 */
export function LedgerAdjust({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});

  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [account, setAccount] = useState<LedgerAccount>("platform_expense");
  const [dollars, setDollars] = useState("");
  const [reason, setReason] = useState("");

  const cents = Math.round(Number(dollars) * 100);
  const valid =
    organizationId !== "" &&
    Number.isFinite(cents) &&
    cents !== 0 &&
    reason.trim().length >= 8;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Adjust the books by hand</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        The escape hatch. A balanced pair, never an edited balance. Audited with your name and
        your reason.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Organisation" htmlFor="adj-org">
          <select
            id="adj-org"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Account" htmlFor="adj-account">
          <select
            id="adj-account"
            value={account}
            onChange={(e) => setAccount(e.target.value as LedgerAccount)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {LEDGER_ACCOUNTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Amount ($)"
          htmlFor="adj-amount"
          hint="Negative is allowed. The balancing leg is posted for you."
        >
          <Input
            id="adj-amount"
            type="number"
            step="0.01"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
          />
        </Field>

        <Field label="Reason" htmlFor="adj-reason" hint="At least a sentence. It is audited.">
          <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>

      {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="mt-3 text-sm text-brand-700">Posted and audited.</p> : null}

      <Button
        className="mt-4"
        variant="secondary"
        disabled={pending || !valid}
        onClick={() =>
          start(async () => {
            setState({});
            const result = await adjustLedger({
              organizationId,
              therapistId: null,
              account,
              amountCents: cents,
              reason: reason.trim(),
            });
            setState(result.error ? { error: result.error } : { ok: true });
            if (!result.error) {
              setDollars("");
              setReason("");
            }
          })
        }
      >
        {pending ? "Posting…" : "Post the adjustment"}
      </Button>
    </Card>
  );
}
