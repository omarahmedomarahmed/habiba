"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle } from "lucide-react";

import {
  addSponsorDomain,
  checkDnsRecord,
  resendDomainProof,
  type DomainState,
} from "@/app/(sponsor)/sponsor/domains/actions";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { ADMIN_MAILBOXES, type AdminMailbox } from "@/lib/sponsor/domain-mailboxes";

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
/** A domain is the same in every language, so the example is not a message. */
const DOMAIN_EXAMPLE = "acme.com";

export function DomainList({
  rows,
  canEdit,
  recordName,
}: {
  rows: DomainRow[];
  canEdit: boolean;
  recordName: string;
}) {
  const t = useT();
  const [state, action] = useActionState(addSponsorDomain, INITIAL);
  const [pending, start] = useTransition();
  const [checking, setChecking] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={t("sponsor.domain.none")}
            body={t("sponsor.domain.noneBody")}
          />
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-slate-900">{row.domain}</p>
              {row.byAgreement ? (
                <span className="text-xs font-medium text-brand-700">
                  {t("sponsor.domain.byAgreement")}
                </span>
              ) : null}
            </div>

            {!row.byAgreement ? (
              <ul className="mt-3 space-y-1.5">
                <Step done={row.mailboxProved} label={t("sponsor.domain.stepMailbox")} />
                <Step done={row.dnsProved} label={t("sponsor.domain.stepDns")} />
              </ul>
            ) : null}

            {canEdit && !row.mailboxProved && !row.byAgreement ? (
              <ProofMail domainId={row.id} domain={row.domain} />
            ) : null}

            {row.problem ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                {row.problem}
              </p>
            ) : (
              <p className="mt-3 text-sm font-medium text-brand-700">
                {t("sponsor.domain.proved")}
              </p>
            )}

            {/*
              🔴 The record stays visible after it is proved, because IT teams
              audit their zone files and a record with no explanation gets
              deleted by whoever inherits it.
            */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {t("sponsor.domain.txt")}
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
                          [row.id]: result.error ?? t("sponsor.domain.found"),
                        }));
                        setChecking(null);
                      });
                    }}
                  >
                    {pending && checking === row.id ? t("sponsor.domain.looking") : t("sponsor.domain.check")}
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
          <p className="text-sm font-semibold text-slate-900">{t("sponsor.domain.add")}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {t("sponsor.domain.addBody")}
          </p>
          <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
            <Input name="domain" placeholder={DOMAIN_EXAMPLE} className="max-w-xs" />
            {/* 🔴 C18: where the first code goes, from the admin names only. */}
            <MailboxSelect name="mailbox" suffix="@" />
            <Add />
          </form>
          {state.error ? (
            <p className="mt-2 text-sm font-semibold text-red-700">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="mt-2 text-sm font-semibold text-brand-700">
              {t("sponsor.domain.added")}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

/**
 * 🔴 C18: the admin mailboxes, and only them. Postmaster first-selected, as the
 * one address every mail domain is required to have; the others are the names
 * hosted mail more often routes to a person.
 */
function MailboxSelect({
  name,
  suffix,
  value,
  onChange,
}: {
  name?: string;
  suffix: string;
  value?: AdminMailbox;
  onChange?: (mailbox: AdminMailbox) => void;
}) {
  const t = useT();
  return (
    <select
      name={name}
      aria-label={t("sponsor.domain.sendTo")}
      value={value}
      defaultValue={value === undefined ? "postmaster" : undefined}
      onChange={onChange ? (event) => onChange(event.target.value as AdminMailbox) : undefined}
      className="h-12 rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900"
    >
      {ADMIN_MAILBOXES.map((mailbox) => (
        <option key={mailbox} value={mailbox}>
          {mailbox}
          {suffix}
        </option>
      ))}
    </select>
  );
}

/** 🔴 C18: send the confirm link again, to the mailbox the company picks. */
function ProofMail({ domainId, domain }: { domainId: string; domain: string }) {
  const t = useT();
  const [mailbox, setMailbox] = useState<AdminMailbox>("postmaster");
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-600">{t("sponsor.domain.sendTo")}</span>
      <MailboxSelect suffix={`@${domain}`} value={mailbox} onChange={setMailbox} />
      <Button
        type="button"
        variant="secondary"
        className="h-12 px-3 text-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await resendDomainProof(domainId, mailbox);
            setSaid(
              result.sent
                ? t("sponsor.domain.sent", { address: result.sent })
                : t(result.error ?? "common.somethingWrong"),
            );
          })
        }
      >
        {pending ? t("common.sending") : t("sponsor.domain.send")}
      </Button>
      {said ? (
        <p role="status" className="w-full text-xs leading-relaxed text-slate-600">
          {said}
        </p>
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
  const t = useT();
  return (
    <Button type="submit" disabled={pending} className="h-12">
      {pending ? t("sponsor.domain.adding") : t("sponsor.domain.addButton")}
    </Button>
  );
}
