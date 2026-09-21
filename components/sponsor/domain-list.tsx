"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle } from "lucide-react";

import {
  addSponsorDomain,
  checkDnsRecord,
  type DomainState,
} from "@/app/(sponsor)/sponsor/domains/actions";
import { Button, Card, EmptyState, Input } from "@/components/ui";

const INITIAL: DomainState = {};

export type DomainRow = {
  id: string;
  domain: string;
  mailboxProved: boolean;
  dnsProved: boolean;
  byAgreement: boolean;
  dnsToken: string;
  problem: string | null;
};

/**
 * The domains, and the two proofs each one needs. 61.1 to 61.4, C318, C320.
 *
 * ## 🔴 TWO TICKS, NOT A BADGE
 *
 * A single "verified" badge would let somebody read one proof as the whole
 * thing. The state of this screen is two separate rows per domain, each either
 * done or not, because they are two different facts: a mailbox proves a person
 * is there, a DNS record proves whoever runs the domain agreed.
 *
 * ## 🔴 C320 — SETUP IS NOT COMPLETE UNTIL A CODE HAS BEEN RECEIVED
 *
 * So an unfinished domain says what is still missing, in words IT can act on,
 * rather than showing a grey pill that says pending.
 */
export function DomainList({
  rows,
  canEdit,
  recordName,
}: {
  rows: DomainRow[];
  canEdit: boolean;
  recordName: string;
}) {
  const [state, action] = useActionState(addSponsorDomain, INITIAL);
  const [pending, start] = useTransition();
  const [checking, setChecking] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No domains yet"
            body="Add the domain your people's email addresses end in. We will give you a record for your IT team to publish, and email a code to somebody at that domain."
          />
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-slate-900">{row.domain}</p>
              {row.byAgreement ? (
                <span className="text-xs font-medium text-brand-700">
                  Proved by signed agreement
                </span>
              ) : null}
            </div>

            {!row.byAgreement ? (
              <ul className="mt-3 space-y-1.5">
                <Step done={row.mailboxProved} label="Somebody at this domain answered our code" />
                <Step done={row.dnsProved} label="The DNS record is published and we can see it" />
              </ul>
            ) : null}

            {row.problem ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                {row.problem}
              </p>
            ) : (
              <p className="mt-3 text-sm font-medium text-brand-700">
                Proved. This domain can issue joining codes.
              </p>
            )}

            {/*
              🔴 The record stays visible after it is proved, because IT teams
              audit their zone files and a record with no explanation gets
              deleted by whoever inherits it.
            */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                TXT record
              </p>
              <p className="mt-1 font-mono text-xs break-all text-slate-700">
                {recordName}.{row.domain}
              </p>
              <p className="mt-1 font-mono text-xs break-all text-slate-700">{row.dnsToken}</p>

              {/*
                🔴 61.4 — "check it now", because IT publishes a record and then
                wants to know it worked. A page saying "we will check within an
                hour" is a page somebody reloads for an hour.
              */}
              {canEdit && !row.dnsProved && !row.byAgreement ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-2.5 text-xs"
                    disabled={pending && checking === row.id}
                    onClick={() => {
                      setChecking(row.id);
                      start(async () => {
                        const result = await checkDnsRecord(row.id);
                        setCheckResult((prev) => ({
                          ...prev,
                          [row.id]: result.error ?? "Found it. This half is proved.",
                        }));
                        setChecking(null);
                      });
                    }}
                  >
                    {pending && checking === row.id ? "Looking…" : "Check the record now"}
                  </Button>
                  {checkResult[row.id] ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {checkResult[row.id]}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>
        ))
      )}

      {canEdit ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Add a domain</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            One organisation often has several. Each is proved on its own.
          </p>
          <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
            <Input name="domain" placeholder="acme.com" className="max-w-xs" />
            <Add />
          </form>
          {state.error ? (
            <p className="mt-2 text-sm font-semibold text-red-700">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="mt-2 text-sm font-semibold text-brand-700">
              Added. Publish the record above, and we will email a code to an address at that
              domain.
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
      )}
      <span className={done ? "text-slate-700" : "text-slate-500"}>{label}</span>
    </li>
  );
}

function Add() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-12">
      {pending ? "Adding…" : "Add"}
    </Button>
  );
}
