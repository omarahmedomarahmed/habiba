"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveRules, type SettingsFormState } from "@/app/(admin)/admin/settings/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import type { RulesSettings } from "@/lib/settings/defs";

export type RulesHistoryRow = { when: string; who: string; changes: string[] };

/**
 * 🔴 0161 — THE RULES, ONE FORM (docs/DECISIONS.md).
 *
 * Every rule the founder ruled on and counsel or the accountant may change.
 * Each row says whether the code applies it today or only keeps it until the
 * ruling that gives it effect, so nobody reads a stored switch as a working
 * rule. A save prices what happens next; nothing already charged changes.
 */
export function RulesEditor({ rules, history }: { rules: RulesSettings; history: RulesHistoryRow[] }) {
  const [state, action] = useActionState(saveRules, {} as SettingsFormState);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Rules</p>
      <p className="mt-1 text-xs text-slate-500">
        Changes apply from now on and keep their old value.
      </p>

      <form action={action} className="mt-4 space-y-6">
        <Section title="Tax">
          <Choice
            label="Seller model"
            name="sellerModel"
            value={rules.tax.sellerModel}
            options={[
              ["agent", "Agent"],
              ["principal", "Seller"],
            ]}
            status="stored"
          />
          <Choice
            label="Session VAT"
            name="sessionVat"
            value={rules.tax.sessionVat}
            options={[
              ["exempt", "Exempt"],
              ["standard", "Country rate"],
            ]}
            status="applied"
          />
          <Choice
            label="Top-up VAT"
            name="topUpVat"
            value={rules.tax.topUpVat}
            options={[
              ["standard", "Country rate"],
              ["exempt", "Exempt"],
            ]}
            status="applied"
          />
          <NumberRow
            label="Payout withholding (%)"
            name="payoutWithholdingPercent"
            value={rules.tax.payoutWithholdingBps / 100}
            step="0.01"
            status="stored"
          />
          <Check
            label="Top-up withholding"
            name="topUpWithholding"
            checked={rules.tax.topUpWithholding}
            status="stored"
          />
        </Section>

        <Section title="Documents">
          <Choice
            label="Top-up document"
            name="topUpDocument"
            value={rules.documents.topUpDocument}
            options={[
              ["receipt_and_eta_invoice", "Receipt and ETA invoice"],
              ["deposit_and_monthly_invoice", "Deposit, monthly invoice"],
            ]}
            status="stored"
          />
        </Section>

        <Section title="Two people">
          <Check label="Payouts" name="approvePayouts" checked={rules.approvals.payouts} status="applied" />
          <Check label="Refunds" name="approveRefunds" checked={rules.approvals.refunds} status="applied" />
          <Check label="Company returns" name="approvePotReturns" checked={rules.approvals.potReturns} status="applied" />
          <Check label="Verifications" name="approveVerifications" checked={rules.approvals.verifications} status="applied" />
          <Check
            label="Transfer without proof"
            name="approveTransferWithoutProof"
            checked={rules.approvals.transferWithoutProof}
            status="applied"
          />
          <Check
            label="Ledger adjustment"
            name="approveLedgerAdjustments"
            checked={rules.approvals.ledgerAdjustments}
            status="applied"
          />
          <NumberRow
            label="Payout details wait (hours)"
            name="payoutDetailsCooldownHours"
            value={rules.approvals.payoutDetailsCooldownHours}
            status="applied"
          />
          <p className="text-xs text-slate-500">Nobody approves their own payout.</p>
        </Section>

        <Section title="Providers">
          <Text label="Card gateway" name="cardGateway" value={rules.providers.cardGateway} status="stored" />
          <Text label="Payouts" name="payoutsProvider" value={rules.providers.payouts} status="stored" />
          <Text label="ETA signer" name="etaSigner" value={rules.providers.etaSigner} status="stored" />
          <p className="text-xs text-slate-500">Keys stay in the environment.</p>
        </Section>

        <Section title="Links and refunds">
          <NumberRow label="Session link (hours)" name="sessionLinkHours" value={rules.links.sessionLinkHours} status="applied" />
          <NumberRow label="Radar link (hours)" name="radarLinkHours" value={rules.links.radarLinkHours} status="applied" />
          <NumberRow
            label="Booking link (hours after start)"
            name="bookingLinkHoursAfterStart"
            value={rules.links.bookingLinkHoursAfterStart}
            status="applied"
          />
          <NumberRow
            label="Free cancellation (hours)"
            name="patientCancelWindowHours"
            value={rules.refunds.patientCancelWindowHours}
            status="stored"
          />
        </Section>

        <Section title="In person">
          <Check label="Pay through us" name="inPersonPayThroughUs" checked={rules.inPerson.payThroughUs} status="stored" />
          <Check label="Company cover" name="inPersonPotCover" checked={rules.inPerson.potCover} status="stored" />
          <NumberRow
            label="Company-paid a week"
            name="potSessionsPerWeek"
            value={rules.inPerson.potSessionsPerWeek}
            status="stored"
          />
          <Check label="Above listed price" name="inPersonPriceAboveList" checked={rules.inPerson.priceAboveList} status="stored" />
          <Check
            label="Refund if never started"
            name="inPersonRefundIfNotStarted"
            checked={rules.inPerson.refundIfNotStarted}
            status="stored"
          />
          <Choice
            label="Refund to"
            name="inPersonRefundTo"
            value={rules.inPerson.refundTo}
            options={[
              ["wallet", "Wallet"],
              ["card", "Card"],
            ]}
            status="stored"
          />
        </Section>

        <Section title="Wallet">
          <Check label="Wallet on" name="walletEnabled" checked={rules.wallet.enabled} status="stored" />
          <NumberRow label="Expiry (months, 0 never)" name="walletExpiryMonths" value={rules.wallet.expiryMonths} status="stored" />
        </Section>

        {state.error ? (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        ) : state.ok ? (
          <p className="text-sm text-brand-700">{state.ok}</p>
        ) : null}
        <Save />
      </form>

      {history.length > 0 ? (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">Changes</summary>
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {history.map((row, i) => (
              <li key={i}>
                <span className="font-medium">
                  {row.when}, {row.who}
                </span>
                : {row.changes.length > 0 ? row.changes.join("; ") : "first saved"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

type Status = "applied" | "stored";

function Tag({ status }: { status: Status }) {
  return status === "applied" ? <Badge tone="green">Applied</Badge> : <Badge tone="slate">Stored</Badge>;
}

function Row(props: { label: string; htmlFor: string; status: Status; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={props.htmlFor} className="text-sm font-medium text-slate-700">
          {props.label}
        </label>
        <Tag status={props.status} />
      </div>
      {props.children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-xs font-bold tracking-wide text-slate-500 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function Choice(props: { label: string; name: string; value: string; options: [string, string][]; status: Status }) {
  return (
    <Row label={props.label} htmlFor={props.name} status={props.status}>
      <select
        id={props.name}
        name={props.name}
        defaultValue={props.value}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {props.options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Row>
  );
}

function NumberRow(props: { label: string; name: string; value: number; step?: string; status: Status }) {
  return (
    <Row label={props.label} htmlFor={props.name} status={props.status}>
      <Input id={props.name} name={props.name} type="number" min="0" step={props.step ?? "1"} defaultValue={props.value} />
    </Row>
  );
}

function Text(props: { label: string; name: string; value: string; status: Status }) {
  return (
    <Row label={props.label} htmlFor={props.name} status={props.status}>
      <Input id={props.name} name={props.name} defaultValue={props.value} />
    </Row>
  );
}

function Check(props: { label: string; name: string; checked: boolean; status: Status }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
      <span className="flex items-center gap-2">
        <input type="checkbox" name={props.name} defaultChecked={props.checked} />
        {props.label}
      </span>
      <Tag status={props.status} />
    </label>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save rules"}
    </Button>
  );
}
