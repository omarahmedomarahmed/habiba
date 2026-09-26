"use client";

import { MIN_REASON } from "@/lib/admin/reason";
import { useEffect, useState, useTransition } from "react";

import { adjustLedger, adjustmentPreview } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import {
  CLINICIAN_ALLOWED_ACCOUNTS,
  CLINICIAN_REQUIRED_ACCOUNTS,
  LEDGER_ACCOUNTS,
  type LedgerAccount,
} from "@/lib/db/schema";
import {
  adjustmentEffect,
  effectLines,
  effectSentence,
  ledgerAmountFor,
  type AdjustDirection,
} from "@/lib/billing/adjust-effect";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

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
 * 🔴 Board 593: and the one number was still a sign convention. It was the
 * ledger's (debit positive), so "+2" on a clinician's held balance took $2 off
 * it. The operator now says "add to it" or "take it off" on the balance as the
 * screens read it, sees each balance before and after, and the screen works
 * out the sign (`lib/billing/adjust-effect.ts`).
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
  const t = useT();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; posted?: string; proposed?: boolean }>({});

  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [account, setAccount] = useState<LedgerAccount>("platform_expense");
  const [therapistId, setTherapistId] = useState("");
  /*
   * 🔴 Board 593: a direction on the balance as every screen reads it, and a
   * positive amount. The ledger's sign is worked out in `ledgerAmountFor`, so
   * "add $2 to Dr Amira's held balance" can no longer post as a $2 deduction.
   */
  const [direction, setDirection] = useState<AdjustDirection>("up");
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

  const magnitude = Math.round(Math.abs(Number(dollars)) * 100);
  const ledgerCents = Number.isFinite(magnitude) ? ledgerAmountFor(account, direction, magnitude) : 0;
  const valid =
    organizationId !== "" &&
    (!needsClinician || therapistId !== "") &&
    Number.isFinite(magnitude) &&
    magnitude !== 0 &&
    reason.trim().length >= MIN_REASON;

  /* 🔴 Board 593: the balances this would move, read when the choice changes. */
  const [sums, setSums] = useState<Partial<Record<LedgerAccount, number>> | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const scopeReady = organizationId !== "" && (!needsClinician || therapistId !== "");
  useEffect(() => {
    if (!scopeReady) return;
    let live = true;
    adjustmentPreview({ organizationId, therapistId: therapistId || null, account })
      .then((result) => {
        if (!live) return;
        setSums(result.sums ?? null);
        setPreviewFailed(!result.sums);
      })
      .catch(() => {
        if (live) setPreviewFailed(true);
      });
    return () => {
      live = false;
    };
  }, [scopeReady, organizationId, therapistId, account, state.posted]);

  const names = {
    clinician: clinicians.find((c) => c.id === therapistId)?.name ?? null,
    org: organizations.find((o) => o.id === organizationId)?.name ?? null,
  };
  const effect = scopeReady && sums && magnitude > 0 ? adjustmentEffect({ account, ledgerCents, sums }) : null;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">{t("adj.title")}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{t("adj.sub")}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label={t("adj.org")} htmlFor="adj-org">
          <select
            id="adj-org"
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              // A clinician belongs to one practice; a new practice means choosing again.
              setTherapistId("");
              setSums(null);
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

        <Field label={t("adj.account")} htmlFor="adj-account">
          <select
            id="adj-account"
            value={account}
            onChange={(e) => {
              setAccount(e.target.value as LedgerAccount);
              setTherapistId("");
              setSums(null);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {LEDGER_ACCOUNTS.map((name) => (
              <option key={name} value={name}>
                {t(`adj.acct.${name}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>

        {takesClinician ? (
          <Field label={t("adj.clinician")} htmlFor="adj-clinician">
            <select
              id="adj-clinician"
              value={therapistId}
              onChange={(e) => {
                setTherapistId(e.target.value);
                setSums(null);
              }}
              required={needsClinician}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {/* Empty is a choice only where the practice itself can hold the balance. */}
              <option value="">{needsClinician ? t("adj.choose") : t("adj.none")}</option>
              {theirs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <fieldset className="space-y-1.5">
          <legend className="block text-sm font-medium text-slate-700">{t("adj.direction")}</legend>
          <div className="flex flex-wrap gap-3 pt-1">
            {(["up", "down"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name="adj-direction"
                  value={value}
                  checked={direction === value}
                  onChange={() => setDirection(value)}
                />
                {t(value === "up" ? "adj.up" : "adj.down")}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t("adj.amount")} htmlFor="adj-amount">
          <Input
            id="adj-amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={dollars}
            onChange={(e) => setDollars(e.target.value.replace(/^-/, ""))}
          />
        </Field>

        <Field label={t("adj.reason")} htmlFor="adj-reason" hint={t("adj.reasonHint")}>
          <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>

      {effect ? (
        <ul
          className="mt-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-900 ring-1 ring-slate-200"
          data-testid="adjust-preview"
        >
          {effectLines(t, effect, names).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : previewFailed && magnitude > 0 ? (
        <p className="mt-3 text-sm text-amber-800">{t("adj.previewFailed")}</p>
      ) : null}

      {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
      {state.proposed ? <p className="mt-3 text-sm text-brand-700">{t("appr.yours")}</p> : null}
      {state.posted ? (
        <p className="mt-3 text-sm text-brand-700" role="status">
          {t("adj.posted", { effect: state.posted })}
        </p>
      ) : null}

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
              amountCents: ledgerCents,
              reason: reason.trim(),
              idempotencyKey: key,
            });
            if (result.error) {
              setState({ error: result.error });
              return;
            }
            setState(
              result.proposed
                ? { proposed: true }
                : { posted: result.effect ? effectSentence(t, result.effect, names) : " " },
            );
            setDollars("");
            setReason("");
            setKey(mintKey());
          })
        }
      >
        {pending ? t("adj.posting") : t("adj.post")}
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
