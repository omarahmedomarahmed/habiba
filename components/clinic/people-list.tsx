"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { cancelInvitation, invite, remove } from "@/app/(clinic)/clinic/people/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * The clinic's clinicians. PLAN.md 54.4, 54.5, 54.11, C261, C266, C267.
 *
 * ## 🔴 C267 — VERIFICATION IS A STATUS HERE, NEVER A CONTROL
 *
 * The status is rendered as a word. There is no button, no toggle, no upload and no
 * "mark as verified": the prop is a string and the component has nowhere to put an
 * action even if somebody added one to the server. The sentence explaining WHY the
 * practice cannot complete it is on the screen, because a hospital onboarding twenty
 * people will otherwise open a support ticket asking for exactly this feature.
 *
 * ## 🔴 WHAT A ROW SHOWS, AND WHAT IT DOES NOT
 *
 * W2-C08 / D2: the founder's decision of 2026-09-23 is that the practice sees each
 * clinician's patients as a first name and a last initial. The list is folded under
 * the row and carries nothing else: no date, no session count, no note, no rating,
 * no earnings. It does say how many patients each clinician has, which D2 accepted,
 * and the homepage sentence saying otherwise went in the same change.
 */

const VERIFY_KEYS: Record<string, MessageKey> = {
  verified: "clinic.verified",
  pending: "clinic.verifyPending",
  unverified: "clinic.verifyNone",
  rejected: "clinic.verifyRejected",
};

export type PersonRow = {
  userId: string;
  name: string;
  email: string;
  verificationStatus: string;
  /**
   * 🔴 62.6 / C355 — when this seat starts costing the practice money, and null
   * once it already does.
   *
   * A formatted string rather than a `Date`, because C84: a date handed to a
   * client component renders one way on the server pass and another after
   * hydration.
   */
  seatBillableFrom: string | null;
  /** 🔴 W2-C08: first name and last initial, or null when this principal may not read names. */
  patients: string[] | null;
};

export type InviteRow = {
  id: string;
  email: string;
  name: string;
  state: string;
};

/** 🔴 W2-C02: the seat an invitation buys, priced by the server before the click. */
export type SeatAdd = {
  fromSeats: number;
  toSeats: number;
  monthlyCents: number;
  todayCents: number;
};
/** 🔴 W2-C02 / C4: the seat a removal releases, and the bill after it. */
export type SeatRelease = { fromSeats: number; monthlyCents: number };

export function ClinicPeopleList({
  people,
  invitations,
  canManage,
  seatAdd = null,
  seatRelease = null,
}: {
  people: PersonRow[];
  invitations: InviteRow[];
  canManage: boolean;
  seatAdd?: SeatAdd | null;
  seatRelease?: SeatRelease | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState(invite, {});
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {t("clinic.peopleTitle")}
        </p>

        {people.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t("clinic.peopleEmpty")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {people.map((person) => (
              <li key={person.userId} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-slate-900">{person.name}</span>
                  <span className="text-xs text-slate-500">{person.email}</span>
                  {/* 🔴 C267 — a word, never a control. */}
                  <span
                    className={
                      person.verificationStatus === "verified"
                        ? "ms-auto rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
                        : "ms-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                    }
                  >
                    {t(VERIFY_KEYS[person.verificationStatus] ?? "clinic.verifyNone")}
                  </span>
                </div>

                {/*
                  🔴 62.6 / C355 — the seat that is not billed yet, and the date.

                  They had already paid for the month when they accepted, so the
                  practice is not charged twice for one person. Rendered only
                  while that is still true, because a line on every row is noise
                  and a line on none is the support ticket it exists to prevent.
                */}
                {person.seatBillableFrom ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("clinic.seatFrom", { date: person.seatBillableFrom })}
                  </p>
                ) : null}

                {/* 🔴 W2-C08 / D2: names only, and not links: there is nowhere for one to go. */}
                {person.patients && person.patients.length > 0 ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                      {t("portal.nav.patients")}
                    </summary>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {person.patients.join(", ")}
                    </p>
                  </details>
                ) : null}

                {canManage ? (
                  confirming === person.userId ? (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {/* 🔴 C266 — what leaving does and what it does not, before the choice. */}
                      <p className="text-xs leading-relaxed text-slate-600">
                        {t("clinic.removeConfirm")}
                      </p>
                      {/* 🔴 W2-C02 / C4: and the bill after it, when a seat comes free. */}
                      {seatRelease ? (
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          {rich(t("clinic.seatReleases", { monthly: slot(0) }), [<Money cents={seatRelease.monthlyCents} />])}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await remove(
                              person.userId,
                              seatRelease?.fromSeats ?? null,
                            );
                            setError(result.error ?? null);
                            if (!result.error) setConfirming(null);
                          })
                        }
                        className="tap-target mt-2 h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {t("clinic.remove")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(person.userId)}
                      className="tap-target mt-1 h-9 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      {t("clinic.remove")}
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* 🔴 C267 — why the practice cannot finish a verification, on the screen. */}
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          {t("clinic.cannotVerify")}
        </p>
      </Card>

      {invitations.length > 0 ? (
        <Card className="p-5">
          <ul className="divide-y divide-slate-100">
            {invitations.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                <span className="text-sm text-slate-800">{row.name || row.email}</span>
                <span className="text-xs text-slate-500">{t("clinic.invitePending")}</span>
                {canManage ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => void (await cancelInvitation(row.id)))
                    }
                    className="tap-target ms-auto h-9 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {t("clinic.revoke")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {canManage ? (
        <Card className="p-5">
          <p className="text-base font-bold tracking-tight text-slate-900">
            {t("clinic.inviteTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("clinic.inviteBody")}</p>

          <form action={formAction} className="mt-4 space-y-4">
            <Field label={t("clinic.firstName")} htmlFor="invite-first">
              <Input id="invite-first" name="firstName" />
            </Field>
            <Field label={t("clinic.lastName")} htmlFor="invite-last">
              <Input id="invite-last" name="lastName" />
            </Field>
            <Field label={t("clinic.email")} htmlFor="invite-email">
              <Input id="invite-email" name="email" type="email" autoCapitalize="none" required />
            </Field>
            <Field label={t("clinic.phone")} htmlFor="invite-phone">
              <Input id="invite-phone" name="phone" type="tel" />
            </Field>

            {/*
              🔴 W2-C02: no free seat, so this invitation buys one. The figure
              is the server's, stated before the button, and the count it was
              quoted against goes with the form so a moved count is refused.
            */}
            {seatAdd ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-700">
                <input type="hidden" name="seatFrom" value={seatAdd.fromSeats} />
                <input type="hidden" name="seatTo" value={seatAdd.toSeats} />
                {rich(t("clinic.seatAdds", { monthly: slot(0), today: slot(1) }), [
                  <Money cents={seatAdd.monthlyCents} />,
                  <Money cents={seatAdd.todayCents} />,
                ])}
              </p>
            ) : null}

            {state.error ? (
              <p role="alert" className="text-xs text-red-600">
                {state.error}
              </p>
            ) : null}

            {state.ok && state.link ? (
              <div className="rounded-xl bg-brand-50 p-3">
                <p className="text-xs font-medium text-brand-900">{t("clinic.inviteSent")}</p>
                {/*
                  🔴 The link is shown as well as sent, and that is honesty rather than
                  convenience: our mail domain is not verified yet, so `notify` reports
                  a failure rather than delivering, and a practice onboarding six people
                  needs a way through that does not depend on us.
                */}
                <p className="mt-1 text-xs text-brand-800">{t("clinic.inviteLink")}</p>
                <p className="mt-1 break-all font-mono text-xs text-brand-900">{state.link}</p>
              </div>
            ) : null}

            <Submit label={t("clinic.invite")} />
          </form>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
