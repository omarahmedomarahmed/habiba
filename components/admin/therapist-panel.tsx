"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  Bot,
  CalendarDays,
  Mail,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

import {
  applyInvoiceDiscount,
  applyUpcomingDiscount,
  editInvoice,
  emailTherapist,
  suspendUser,
  verifyUser,
  type AdminActionState,
} from "@/app/(admin)/admin/actions";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type Patient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  sessionCount: number;
  copilotMessages: number;
  lastSessionAt: string | null;
};

type SessionRow = {
  id: string;
  when: string;
  status: string;
  modality: string;
  noteStatus: string;
  durationMinutes: number | null;
  segmentCount: number;
  priceCents: number;
  paymentStatus: string;
  reportSent: boolean;
  patient: string;
};

type CopilotRow = {
  threadId: string;
  patient: string;
  asked: number;
  askedThisMonth: number;
  corrections: number;
  lastMessageAt: string | null;
};

type InvoiceRow = {
  id: string;
  kind: string;
  description: string;
  amountCents: number;
  discountCents: number;
  discountReason: string | null;
  status: string;
  issuedAt: string;
  paidAt: string | null;
};

type PaymentRow = {
  id: string;
  payerName: string | null;
  grossCents: number;
  therapistNetCents: number;
  settledInvoiceCents: number;
  status: string;
  when: string;
};

const TABS = [
  { key: "patients", label: "Patients", icon: Users },
  { key: "sessions", label: "Sessions", icon: CalendarDays },
  { key: "copilot", label: "Copilot", icon: Bot },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "manage", label: "Manage", icon: BadgeCheck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TherapistAdminPanel(props: {
  therapistId: string;
  therapistName: string;
  organizationId: string;
  status: string;
  verification: string;
  credentials: string | null;
  licence: string;
  rateCents: number;
  payoutsEnabled: boolean;
  earnings: { lifetimeNetCents: number; platformFeesCents: number; paidSessionCount: number };
  patients: Patient[];
  sessions: SessionRow[];
  copilot: CopilotRow[];
  aiSpend: { kind: string; calls: number; costCents: number; errors: number }[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
}) {
  const [tab, setTab] = useState<TabKey>("patients");

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium",
              tab === item.key
                ? "bg-navy-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100",
            )}
          >
            <item.icon className="h-3.5 w-3.5" aria-hidden />
            {item.label}
            <span className={cn("text-xs", tab === item.key ? "text-white/50" : "text-slate-400")}>
              {item.key === "patients"
                ? props.patients.length
                : item.key === "sessions"
                  ? props.sessions.length
                  : item.key === "copilot"
                    ? props.copilot.length
                    : item.key === "billing"
                      ? props.invoices.length + props.payments.length
                      : ""}
            </span>
          </button>
        ))}
      </div>

      {tab === "patients" ? <Patients rows={props.patients} /> : null}
      {tab === "sessions" ? <Sessions rows={props.sessions} /> : null}
      {tab === "copilot" ? <Copilot rows={props.copilot} spend={props.aiSpend} /> : null}
      {tab === "billing" ? (
        <Billing
          invoices={props.invoices}
          payments={props.payments}
          organizationId={props.organizationId}
          earnings={props.earnings}
          rateCents={props.rateCents}
          payoutsEnabled={props.payoutsEnabled}
        />
      ) : null}
      {tab === "manage" ? (
        <Manage
          therapistId={props.therapistId}
          therapistName={props.therapistName}
          status={props.status}
          verification={props.verification}
          credentials={props.credentials}
          licence={props.licence}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- patients -- */

function Patients({ rows }: { rows: Patient[] }) {
  return (
    <Card>
      <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        Caseload — identifiers only
      </p>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No patients on this account.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs text-slate-400">
              <tr>
                <Th>Patient</Th>
                <Th>Email</Th>
                <Th>Source</Th>
                <Th className="text-right">Sessions</Th>
                <Th className="text-right">Copilot</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium text-slate-900">{row.name}</Td>
                  <Td className="text-slate-600">{row.email ?? "—"}</Td>
                  <Td>
                    <Badge tone={row.source === "join_link" ? "teal" : "slate"}>
                      {row.source === "join_link" ? "self-joined" : "added"}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{row.sessionCount}</Td>
                  <Td className="text-right tabular-nums">{row.copilotMessages}</Td>
                  <Td className="text-slate-500">{row.lastSessionAt ?? "never"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- sessions -- */

function Sessions({ rows }: { rows: SessionRow[] }) {
  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Session history</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Metadata only. &ldquo;Lines&rdquo; is the transcript segment count — the number, not the
          text.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No sessions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs text-slate-400">
              <tr>
                <Th>When</Th>
                <Th>Patient</Th>
                <Th>Type</Th>
                <Th className="text-right">Mins</Th>
                <Th className="text-right">Lines</Th>
                <Th>Note</Th>
                <Th>Payment</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap text-slate-600">{row.when}</Td>
                  <Td className="font-medium text-slate-900">{row.patient}</Td>
                  <Td className="text-slate-500">
                    {row.modality === "video" ? "Video" : "In person"}
                  </Td>
                  <Td className="text-right tabular-nums">{row.durationMinutes ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{row.segmentCount}</Td>
                  <Td>
                    <Badge
                      tone={
                        row.noteStatus === "ready"
                          ? "green"
                          : row.noteStatus === "failed"
                            ? "red"
                            : row.noteStatus === "generating"
                              ? "amber"
                              : "slate"
                      }
                    >
                      {row.noteStatus}
                    </Badge>
                  </Td>
                  <Td>
                    {row.priceCents > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <span className="tabular-nums">{formatUsd(row.priceCents)}</span>
                        <Badge tone={row.paymentStatus === "paid" ? "green" : "amber"}>
                          {row.paymentStatus}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-slate-400">free</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- copilot -- */

function Copilot({
  rows,
  spend,
}: {
  rows: CopilotRow[];
  spend: { kind: string; calls: number; costCents: number; errors: number }[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Model usage, by purpose
        </p>
        {spend.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No AI calls on this account.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {spend.map((row) => (
              <li key={row.kind} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm font-medium capitalize text-slate-800">
                  {row.kind}
                </span>
                <span className="text-xs text-slate-500">{row.calls} calls</span>
                {row.errors > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {row.errors}
                  </span>
                ) : null}
                <span className="w-20 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatUsd(row.costCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Copilot threads</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Volume and recency. Message content is not selected by this query.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No copilot conversations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-400">
                <tr>
                  <Th>Patient</Th>
                  <Th className="text-right">Asked</Th>
                  <Th className="text-right">This month</Th>
                  <Th className="text-right">Corrections</Th>
                  <Th>Last active</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.threadId}>
                    <Td className="font-medium text-slate-900">{row.patient}</Td>
                    <Td className="text-right tabular-nums">{row.asked}</Td>
                    <Td className="text-right tabular-nums">
                      <span className={row.askedThisMonth >= 10 ? "font-semibold text-amber-600" : ""}>
                        {row.askedThisMonth}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{row.corrections}</Td>
                    <Td className="text-slate-500">{row.lastMessageAt ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- billing -- */

function Billing({
  invoices,
  payments,
  organizationId,
  earnings,
  rateCents,
  payoutsEnabled,
}: {
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  organizationId: string;
  earnings: { lifetimeNetCents: number; platformFeesCents: number; paidSessionCount: number };
  rateCents: number;
  payoutsEnabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Wallet className="h-4 w-4 text-teal-600" aria-hidden />
          Money they have received
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Mini label="Earned (net)" value={formatUsd(earnings.lifetimeNetCents)} />
          <Mini label="Our fees" value={formatUsd(earnings.platformFeesCents)} />
          <Mini label="Paid sessions" value={String(earnings.paidSessionCount)} />
          <Mini
            label="Rate · 30 min"
            value={rateCents > 0 ? formatUsd(rateCents) : "Free"}
            sub={payoutsEnabled ? "payouts on" : "payouts off"}
          />
        </dl>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Invoices — what they owe us</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Open a row to discount, re-price or void it.
          </p>
        </div>
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No invoices raised.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <AdminInvoiceRow
                key={invoice.id}
                invoice={invoice}
                organizationId={organizationId}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Patient payments — what they received
        </p>
        {payments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nobody has paid them yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {payment.payerName ?? "Patient"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {payment.when}
                    {payment.settledInvoiceCents > 0
                      ? ` · ${formatUsd(payment.settledInvoiceCents)} of their bill settled`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-slate-900">
                    {formatUsd(payment.therapistNetCents)}
                  </span>
                  <span className="block text-xs tabular-nums text-slate-400">
                    of {formatUsd(payment.grossCents)}
                  </span>
                </span>
                <Badge tone={payment.status === "paid" ? "green" : "amber"}>{payment.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** One invoice, expandable into the full set of admin edits. */
function AdminInvoiceRow({
  invoice,
  organizationId,
}: {
  invoice: InvoiceRow;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [discount, setDiscount] = useState("");
  const [amount, setAmount] = useState((invoice.amountCents / 100).toFixed(2));
  const [description, setDescription] = useState(invoice.description);
  const [reason, setReason] = useState("");

  const payable = Math.max(0, invoice.amountCents - invoice.discountCents);

  const run = (fn: () => Promise<AdminActionState>, message: string) =>
    startTransition(async () => {
      setError(null);
      setDone(null);
      const result = await fn();
      if (result?.error) setError(result.error);
      else setDone(message);
    });

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {invoice.description}
          </span>
          <span className="block text-xs text-slate-500">
            {invoice.kind} · {invoice.issuedAt}
            {invoice.discountCents > 0 ? ` · ${formatUsd(invoice.discountCents)} discounted` : ""}
            {invoice.discountReason ? ` (${invoice.discountReason})` : ""}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
          {formatUsd(payable)}
        </span>
        <Badge
          tone={
            invoice.status === "paid"
              ? "green"
              : invoice.status === "due"
                ? "amber"
                : invoice.status === "void"
                  ? "slate"
                  : "teal"
          }
        >
          {invoice.status}
        </Badge>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {done ? <p className="text-sm text-emerald-700">{done}</p> : null}

          <Field label="Reason (goes in the audit log)" htmlFor={`reason-${invoice.id}`}>
            <Input
              id={`reason-${invoice.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Goodwill after the outage on the 12th"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Discount ($)" htmlFor={`disc-${invoice.id}`}>
              <div className="flex gap-2">
                <Input
                  id={`disc-${invoice.id}`}
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={(payable / 100).toFixed(2)}
                />
                <Button
                  size="sm"
                  disabled={pending || invoice.status === "paid"}
                  onClick={() =>
                    run(
                      () =>
                        applyInvoiceDiscount(
                          invoice.id,
                          Math.round(Number(discount || 0) * 100),
                          reason,
                        ),
                      "Discount applied",
                    )
                  }
                >
                  Apply
                </Button>
              </div>
            </Field>

            <Field label="Re-price ($)" htmlFor={`amt-${invoice.id}`}>
              <div className="flex gap-2">
                <Input
                  id={`amt-${invoice.id}`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || invoice.status === "paid"}
                  onClick={() =>
                    run(
                      () =>
                        editInvoice(
                          invoice.id,
                          { amountCents: Math.round(Number(amount || 0) * 100) },
                          reason,
                        ),
                      "Amount changed",
                    )
                  }
                >
                  Set
                </Button>
              </div>
            </Field>
          </div>

          <Field label="Description" htmlFor={`desc-${invoice.id}`}>
            <div className="flex gap-2">
              <Input
                id={`desc-${invoice.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => editInvoice(invoice.id, { description }, reason), "Renamed")}
              >
                Save
              </Button>
            </div>
          </Field>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    applyUpcomingDiscount(
                      organizationId,
                      Math.round(Number(discount || 0) * 100),
                      reason,
                    ),
                  "Credit queued for their next renewal",
                )
              }
            >
              Credit next renewal
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending || invoice.status === "void"}
              onClick={() => run(() => editInvoice(invoice.id, { status: "void" }, reason), "Voided")}
            >
              <Ban className="h-3.5 w-3.5" aria-hidden />
              Void
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* --------------------------------------------------------------- manage -- */

function Manage({
  therapistId,
  therapistName,
  status,
  verification,
  credentials,
  licence,
}: {
  therapistId: string;
  therapistName: string;
  status: string;
  verification: string;
  credentials: string | null;
  licence: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const run = (fn: () => Promise<AdminActionState>, message: string) =>
    startTransition(async () => {
      setError(null);
      setDone(null);
      const result = await fn();
      if (result?.error) setError(result.error);
      else setDone(message);
    });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Licence &amp; verification</p>
        <p className="mt-1 text-sm text-slate-600">
          {credentials || "No credentials given"}
          {licence ? ` · ${licence}` : ""}
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {done ? <p className="mt-3 text-sm text-emerald-700">{done}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || verification === "verified"}
            onClick={() => run(() => verifyUser(therapistId, "verified"), "Marked verified")}
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Verify
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || verification === "rejected"}
            onClick={() => run(() => verifyUser(therapistId, "rejected"), "Marked rejected")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant={status === "active" ? "danger" : "teal"}
            disabled={pending}
            onClick={() =>
              run(
                () => suspendUser(therapistId, status === "active"),
                status === "active" ? "Account suspended" : "Account reinstated",
              )
            }
          >
            <Ban className="h-3.5 w-3.5" aria-hidden />
            {status === "active" ? "Suspend account" : "Reinstate"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Mail className="h-4 w-4 text-brand-600" aria-hidden />
          Email {therapistName}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          Plain text. It goes out from 24Therapy, not from a patient — no links are rendered, so it
          cannot be turned into a phishing template.
        </p>

        <div className="mt-3 space-y-3">
          <Field label="Subject" htmlFor="email-subject">
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="About your invoice this month"
            />
          </Field>
          <Field label="Message" htmlFor="email-body">
            <Textarea
              id="email-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Hi — quick note about…\n\nBlank lines become paragraphs."}
            />
          </Field>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => emailTherapist(therapistId, subject, body), "Sent")
            }
          >
            {pending ? "Sending…" : "Send email"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- atoms -- */

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 font-medium whitespace-nowrap", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 whitespace-nowrap", className)}>{children}</td>;
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</dd>
      {sub ? <p className="text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}
