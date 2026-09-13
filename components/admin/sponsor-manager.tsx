"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  activate,
  addPortalUser,
  mintCode,
  openTheirPot,
} from "@/app/(admin)/admin/sponsors/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { SPONSOR_STATES } from "@/lib/db/schema";

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
 * ## 🔴 English, and deliberately not a MessageKey
 *
 * 45.8 covers every word a PATIENT, clinician or sponsor reads. The internal
 * operator console has always been English: it is a tool for a team of three who
 * share a language, and translating it would be four hundred keys nobody reads.
 * `_i18n-coverage.json` counts the admin surface separately for that reason.
 */

export type AdminSponsorRow = {
  id: string;
  name: string;
  kind: string;
  state: string;
  listedPublicly: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactBestTime: string | null;
  code: string | null;
  potOpen: boolean;
  potBalanceLabel: string;
  users: { id: string; email: string; role: string }[];
};

export function SponsorManager({ sponsors }: { sponsors: AdminSponsorRow[] }) {
  if (sponsors.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-600">No corporate enquiries yet.</p>
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
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
              ? "rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
          }
        >
          {sponsor.state}
        </span>
        {sponsor.listedPublicly ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            listed
          </span>
        ) : null}
        <span className="ms-auto text-xs text-slate-500">{sponsor.potBalanceLabel}</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="tap-target h-9 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          {/* 53.5 — the contact and the best time to call, which is the point. */}
          <dl className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">Contact</dt>
              <dd>{sponsor.contactName ?? "not given"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Email</dt>
              <dd>{sponsor.contactEmail ?? "not given"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Phone</dt>
              <dd>{sponsor.contactPhone ?? "not given"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Best time to call</dt>
              <dd>{sponsor.contactBestTime ?? "any"}</dd>
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

          {/* 53.9 — the joining code. Rotating it kills every printed poster. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm tracking-widest text-slate-800">
              {sponsor.code ?? "no code"}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => void (await mintCode(sponsor.id)))}
              className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {sponsor.code ? "Rotate code" : "Mint a code"}
            </button>
          </div>

          {/*
            🔴 53.13 / C233 — the pot is opened WITH its terms. Both fields are
            required and the database refuses a balance above zero without them, so
            there is no order of operations that takes $5,000 first.
          */}
          {sponsor.potOpen ? (
            <p className="text-xs text-slate-500">Pot open, with terms.</p>
          ) : (
            <form action={potAction} className="space-y-3 rounded-xl bg-slate-50 p-3">
              <input type="hidden" name="sponsorId" value={sponsor.id} />
              <p className="text-xs font-semibold text-slate-700">
                Open their pot. The refund terms and the expiry are agreed first.
              </p>
              <Field label="Refund and expiry terms" htmlFor={`terms-${sponsor.id}`}>
                <Textarea id={`terms-${sponsor.id}`} name="refundPolicy" rows={4} required />
              </Field>
              <Field label="Unspent money expires" htmlFor={`expires-${sponsor.id}`}>
                <Input id={`expires-${sponsor.id}`} name="expiresAt" type="date" required />
              </Field>
              <Field
                label="Overdraft allowed, in whole units"
                htmlFor={`overdraft-${sponsor.id}`}
              >
                <Input
                  id={`overdraft-${sponsor.id}`}
                  name="overdraft"
                  inputMode="decimal"
                  defaultValue="0"
                />
              </Field>
              {potState.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {potState.error}
                </p>
              ) : null}
              <Submit label="Open the pot" />
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
              <p className="text-xs font-semibold text-slate-700">Add a portal user</p>
              <Field label="Email" htmlFor={`email-${sponsor.id}`}>
                <Input id={`email-${sponsor.id}`} name="email" type="email" required />
              </Field>
              <Field label="Name" htmlFor={`name-${sponsor.id}`}>
                <Input id={`name-${sponsor.id}`} name="name" />
              </Field>
              <Field label="Password, at least twelve characters" htmlFor={`pw-${sponsor.id}`}>
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
              <Submit label="Create" />
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
