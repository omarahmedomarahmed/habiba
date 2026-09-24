"use client";

import { MIN_REASON } from "@/lib/admin/reason";
import { useState, useTransition } from "react";

import { adjustLedger } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import {
  CLINICIAN_ALLOWED_ACCOUNTS,
  CLINICIAN_REQUIRED_ACCOUNTS,
  LEDGER_ACCOUNTS,
  type LedgerAccount,
} from "@/lib/db/schema";

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
  clinicians,
}: {
  organizations: { id: string; name: string }[];
  clinicians: { id: string; name: string; organizationId: string }[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});

  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [account, setAccount] = useState<LedgerAccount>("platform_expense");
  const [therapistId, setTherapistId] = useState("");
  const [dollars, setDollars] = useState("");
  const [reason, setReason] = useState("");
  /*
   * 🔴 A12: ONE KEY PER FORM, minted when it renders and replaced only after a
   * post succeeds. It becomes the ledger transaction's id, so the same form
   * arriving twice (a retry after a dropped answer, a second press) finds its
   * own transaction and posts nothing. A second TAB mints its own key, and
   * `postAdjustment` catches that one by its figures instead.
   */
  const [key, setKey] = useState(mintKey);

  /*
   * 🔴 A12: this used to post `therapistId: null` whatever the account, so a
   * correction to `therapist_payable` belonged to nobody and `heldBalances`,
   * which groups by clinician, never showed it. The server refuses the same
   * combinations; the screen only saves the round trip.
   */
  const needsClinician = (CLINICIAN_REQUIRED_ACCOUNTS as readonly LedgerAccount[]).includes(account);
  const takesClinician = (CLINICIAN_ALLOWED_ACCOUNTS as readonly LedgerAccount[]).includes(account);
  const theirs = clinicians.filter((c) => c.organizationId === organizationId);

  const cents = Math.round(Number(dollars) * 100);
  const valid =
    organizationId !== "" &&
    (!needsClinician || therapistId !== "") &&
    Number.isFinite(cents) &&
    cents !== 0 &&
    reason.trim().length >= MIN_REASON;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Adjust the books</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        A balanced pair, audited with your name.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Organisation" htmlFor="adj-org">
          <select
            id="adj-org"
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              // A clinician belongs to one practice; a new practice means choosing again.
              setTherapistId("");
            }}
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
            onChange={(e) => {
              setAccount(e.target.value as LedgerAccount);
              setTherapistId("");
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {LEDGER_ACCOUNTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        {takesClinician ? (
          <Field label="Clinician" htmlFor="adj-clinician">
            <select
              id="adj-clinician"
              value={therapistId}
              onChange={(e) => setTherapistId(e.target.value)}
              required={needsClinician}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {/* Empty is a choice only where the practice itself can hold the balance. */}
              <option value="">{needsClinician ? "…" : "None"}</option>
              {theirs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field
          label="Amount ($)"
          htmlFor="adj-amount"
          hint="Negative is fine."
        >
          <Input
            id="adj-amount"
            type="number"
            step="0.01"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
          />
        </Field>

        <Field label="Reason" htmlFor="adj-reason" hint="A sentence. It is audited.">
          <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>

      {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="mt-3 text-sm text-brand-700">Posted.</p> : null}

      <Button
        className="mt-4"
        variant="secondary"
        disabled={pending || !valid}
        onClick={() =>
          start(async () => {
            setState({});
            const result = await adjustLedger({
              organizationId,
              therapistId: takesClinician && therapistId ? therapistId : null,
              account,
              amountCents: cents,
              reason: reason.trim(),
              idempotencyKey: key,
            });
            setState(result.error ? { error: result.error } : { ok: true });
            if (!result.error) {
              setDollars("");
              setReason("");
              setKey(mintKey());
            }
          })
        }
      >
        {pending ? "Posting…" : "Post the adjustment"}
      </Button>
    </Card>
  );
}

/**
 * A v4 UUID for the form's key. `crypto.randomUUID` exists only in a secure
 * context, and the console is also opened over plain http on a LAN in
 * development, where the fallback builds the same shape from random bytes.
 */
function mintKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
