"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  activate,
  addPortalUser,
  mintCode,
  openTheirPot,
  setEntity,
} from "@/app/(admin)/admin/sponsors/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { ENTITIES, SPONSOR_STATES } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * Managing sponsors. PLAN.md 53.6, C233, C237.
 *
 * ## 🔴 Company and university are ONE type with two faces (§3e)
 *
 * There is one list here, one set of controls and one state machine. The kind is a
 * column, shown as a word. Two tabs with two forms would be two code paths that
 * drift, and the drift would be in the wall.
 *
 * ## 🔴 This screen does not show who is enrolled, and that is not squeamishness
 *
 * Staff have `break_glass` and an audit trail for the clinical record; an
 * operational screen about a commercial account has no business listing the people
 * an employer funds, because the first thing that happens to such a list is that
 * somebody screenshots it for a customer who asked.
 *
 * ## 🔴 KEYS, even though the rest of the operator console is not
 *
 * The console carries 294 English literals and the ratchet counts them, which is a
 * debt taken on before sprint 45. These are NEW strings written after it, and the
 * rule from 45 on is that every word a person reads is a MessageKey with both
 * languages and an admin override. So they are keys, and the ratchet does not rise
 * on this sprint's account.
 *
 * Under `asponsor.` rather than `sponsor.` so an admin rewording the operator's
 * own screen cannot accidentally reword a paying customer's.
 */

export type AdminSponsorRow = {
  id: string;
  name: string;
  kind: string;
  state: string;
  listedPublicly: boolean;
  /** 🔴 74.5 — which of our companies bills them, which decides their rail. */
  entity: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactBestTime: string | null;
  code: string | null;
  potOpen: boolean;
  potBalanceLabel: string;
  /** 🔴 53.19 — attempts on their code this week. A number, never names. */
  attempts: number;
  spike: boolean;
  users: { id: string; email: string; role: string }[];
};

export function SponsorManager({ sponsors }: { sponsors: AdminSponsorRow[] }) {
  const t = useT();

  if (sponsors.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-600">{t("asponsor.none")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sponsors.map((sponsor) => (
        <SponsorRow key={sponsor.id} sponsor={sponsor} />
      ))}
    </div>
  );
}

function SponsorRow({ sponsor }: { sponsor: AdminSponsorRow }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [entityState, setEntityState] = useState<{ error?: string }>({});
  const [potState, potAction] = useActionState(openTheirPot, {});
  const [userState, userAction] = useActionState(addPortalUser, {});

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-slate-900">{sponsor.name}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {sponsor.kind}
        </span>
        <span
          className={
            sponsor.state === "active"
              ? "rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
          }
        >
          {sponsor.state}
        </span>
        {/*
          🔴 74.5 — THE ENTITY, ON THE ROW RATHER THAN BEHIND THE FOLD.
          It decides whether this customer is shown a card form or a bank
          account, so an operator looking at a list of accounts needs to see it
          without opening each one.
        */}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 uppercase">
          {sponsor.entity}
        </span>
        {sponsor.listedPublicly ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {t("asponsor.listed")}
          </span>
        ) : null}
        <span className="ms-auto text-xs text-slate-500">{sponsor.potBalanceLabel}</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="tap-target h-9 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {open ? t("asponsor.close") : t("asponsor.open")}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          {/* 53.5 — the contact and the best time to call, which is the point. */}
          <dl className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">{t("asponsor.contact")}</dt>
              <dd>{sponsor.contactName ?? t("asponsor.notGiven")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("asponsor.email")}</dt>
              <dd>{sponsor.contactEmail ?? t("asponsor.notGiven")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("asponsor.phone")}</dt>
              <dd>{sponsor.contactPhone ?? t("asponsor.notGiven")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("asponsor.bestTime")}</dt>
              <dd>{sponsor.contactBestTime ?? t("asponsor.any")}</dd>
            </div>
          </dl>

          {/* The state machine, as buttons. Held, active, suspended, closed. */}
          <div className="flex flex-wrap gap-2">
            {SPONSOR_STATES.filter((state) => state !== sponsor.state).map((state) => (
              <button
                key={state}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => void (await activate(sponsor.id, state)))
                }
                className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {state}
              </button>
            ))}
          </div>

          {/*
            🔴 74.5 — WHICH ENTITY BILLS THEM. An Egyptian customer moved here
            is on the bank transfer rail from their next page load, because
            `sponsorNeedsTransfer` reads this same column. Refused once their pot
            holds money: that would move a balance we have already invoiced into
            another company's books.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">{t("asponsor.billedFrom")}</span>
            {ENTITIES.filter((entity) => entity !== sponsor.entity).map((entity) => (
              <button
                key={entity}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => setEntityState(await setEntity(sponsor.id, entity)))
                }
                className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 uppercase hover:bg-slate-200 disabled:opacity-50"
              >
                {entity}
              </button>
            ))}
            {entityState.error ? (
              <p className="w-full text-xs text-rose-600">{entityState.error}</p>
            ) : null}
          </div>

          {/* 53.9 — the joining code. Rotating it kills every printed poster. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm tracking-widest text-slate-800">
              {sponsor.code ?? t("asponsor.noCode")}
            </span>
            <span
              className={
                sponsor.spike
                  ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                  : "text-xs text-slate-500"
              }
            >
              {t("sponsor.attempts", { count: sponsor.attempts })}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => void (await mintCode(sponsor.id)))}
              className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {sponsor.code ? t("asponsor.rotate") : t("asponsor.mint")}
            </button>
          </div>

          {/*
            🔴 53.13 / C233 — the pot is opened WITH its terms. Both fields are
            required and the database refuses a balance above zero without them, so
            there is no order of operations that takes $5,000 first.
          */}
          {sponsor.potOpen ? (
            <p className="text-xs text-slate-500">{t("asponsor.potOpen")}</p>
          ) : (
            <form action={potAction} className="space-y-3 rounded-xl bg-slate-50 p-3">
              <input type="hidden" name="sponsorId" value={sponsor.id} />
              <p className="text-xs font-semibold text-slate-700">
                {t("asponsor.openPot")}
              </p>
              <Field label={t("asponsor.terms")} htmlFor={`terms-${sponsor.id}`}>
                <Textarea id={`terms-${sponsor.id}`} name="refundPolicy" rows={4} required />
              </Field>
              <Field label={t("asponsor.expires")} htmlFor={`expires-${sponsor.id}`}>
                <Input id={`expires-${sponsor.id}`} name="expiresAt" type="date" required />
              </Field>
              <Field
                label={t("asponsor.overdraft")}
                htmlFor={`overdraft-${sponsor.id}`}
              >
                <Input
                  id={`overdraft-${sponsor.id}`}
                  name="overdraft"
                  inputMode="decimal"
                  defaultValue="0"
                />
              </Field>
              {/*
                🔴 THE WELCOME CREDIT, and until this sprint there was nowhere to
                put it. Both ways money reaches a pot enforce a $5,000 minimum,
                so the $100 the plan promises every company was unreachable by
                any screen. A minimum is the right rule for a purchase and the
                wrong rule for a gift.
              */}
              <Field
                label={t("asponsor.welcomeCredit")}
                htmlFor={`welcome-${sponsor.id}`}
                hint={t("asponsor.welcomeCreditHint")}
              >
                <Input
                  id={`welcome-${sponsor.id}`}
                  name="welcomeCredit"
                  inputMode="decimal"
                  defaultValue="0"
                />
              </Field>
              {potState.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {potState.error}
                </p>
              ) : null}
              <Submit label={t("asponsor.openPotButton")} />
            </form>
          )}

          {/* 53.6 — portal users. Admin can remove somebody; viewer cannot. */}
          <div className="space-y-2">
            {sponsor.users.map((user) => (
              <p key={user.id} className="text-xs text-slate-600">
                {user.email} · {user.role}
              </p>
            ))}

            <form action={userAction} className="space-y-3 rounded-xl bg-slate-50 p-3">
              <input type="hidden" name="sponsorId" value={sponsor.id} />
              <p className="text-xs font-semibold text-slate-700">{t("asponsor.addUser")}</p>
              <Field label={t("asponsor.email")} htmlFor={`email-${sponsor.id}`}>
                <Input id={`email-${sponsor.id}`} name="email" type="email" required />
              </Field>
              <Field label={t("asponsor.name")} htmlFor={`name-${sponsor.id}`}>
                <Input id={`name-${sponsor.id}`} name="name" />
              </Field>
              <Field label={t("asponsor.password")} htmlFor={`pw-${sponsor.id}`}>
                <Input id={`pw-${sponsor.id}`} name="password" type="text" required />
              </Field>
              <div className="flex gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="viewer" defaultChecked /> viewer
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="admin" /> admin
                </label>
              </div>
              {userState.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {userState.error}
                </p>
              ) : null}
              <Submit label={t("asponsor.create")} />
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
