"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { cancelInvitation, invite, remove } from "@/app/(clinic)/clinic/people/actions";
import { BadgeCheck, CheckCircle2, ChevronDown, Mail, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";

import { ClinicHead } from "@/components/clinic/ui";
import { Avatar, Badge, Button, Card, EmptyState, Field, Glow, IconTile, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n/messages";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button full type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
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
    <div>
      <ClinicHead title={t("clinic.peopleTitle")} />

      <div className={cn("grid items-start gap-5", canManage && "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
        <div className="min-w-0 space-y-4">
          {people.length === 0 ? (
            <Card>
              <EmptyState icon={<Users className="h-6 w-6" aria-hidden />} title={t("clinic.peopleEmpty")} />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {people.map((person) => (
                <li key={person.userId}>
                  <Card className="h-full p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={person.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-navy-700">{person.name}</p>
                        <p className="truncate text-[13px] text-navy-400">{person.email}</p>
                      </div>
                    </div>
                    {/* 🔴 C267 — a word, never a control. */}
                    <div className="mt-3">
                      <Badge tone={person.verificationStatus === "verified" ? "green" : "amber"}>
                        {person.verificationStatus === "verified" ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> : null}
                        {t(VERIFY_KEYS[person.verificationStatus] ?? "clinic.verifyNone")}
                      </Badge>
                    </div>

                    {/*
                      🔴 62.6 / C355 — the seat that is not billed yet, and the date.

                      They had already paid for the month when they accepted, so the
                      practice is not charged twice for one person. Rendered only
                      while that is still true, because a line on every row is noise
                      and a line on none is the support ticket it exists to prevent.
                    */}
                    {person.seatBillableFrom ? (
                      <p className="mt-2 text-[13px] text-navy-400">
                        {t("clinic.seatFrom", { date: person.seatBillableFrom })}
                      </p>
                    ) : null}

                    {/* 🔴 W2-C08 / D2: names only, and not links: there is nowhere for one to go. */}
                    {person.patients && person.patients.length > 0 ? (
                      <details className="group mt-3 rounded-2xl bg-navy-50 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-navy-600">
                          <span>
                            {t("portal.nav.patients")} · <span className="tabular-nums">{person.patients.length}</span>
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-navy-500">{person.patients.join(", ")}</p>
                      </details>
                    ) : null}

                    {canManage ? (
                      confirming === person.userId ? (
                        <div className="mt-3 rounded-2xl bg-red-50 p-3 ring-1 ring-red-200">
                          {/* 🔴 C266 — what leaving does and what it does not, before the choice. */}
                          <p className="text-[13px] leading-relaxed text-navy-600">{t("clinic.removeConfirm")}</p>
                          {/* 🔴 W2-C02 / C4: and the bill after it, when a seat comes free. */}
                          {seatRelease ? (
                            <p className="mt-1 text-[13px] font-semibold text-navy-700">
                              {rich(t("clinic.seatReleases", { monthly: slot(0) }), [<Money cents={seatRelease.monthlyCents} />])}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
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
                            >
                              {t("clinic.remove")}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                              {t("clinic.team.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirming(person.userId)}
                          className="mt-2 -ms-2"
                        >
                          <UserMinus className="h-4 w-4" aria-hidden />
                          {t("clinic.remove")}
                        </Button>
                      )
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {invitations.length > 0 ? (
            <Card className="p-2">
              <ul className="divide-y divide-navy-100/70">
                {invitations.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
                    <IconTile tone="amber" className="h-10 w-10">
                      <Mail className="h-4 w-4" aria-hidden />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-navy-700">{row.name || row.email}</p>
                      <p className="text-[12px] text-navy-400">{t("clinic.invitePending")}</p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => void (await cancelInvitation(row.id)))
                        }
                      >
                        {t("clinic.revoke")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* 🔴 C267 — why the practice cannot finish a verification, on the screen. */}
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-navy-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            {t("clinic.cannotVerify")}
          </p>

          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <Card className="p-5 lg:sticky lg:top-6">
            <div className="flex items-center gap-3">
              <IconTile tone="brand">
                <UserPlus className="h-5 w-5" aria-hidden />
              </IconTile>
              <h2 className="text-[17px] font-bold text-navy-700">{t("clinic.inviteTitle")}</h2>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-navy-400">{t("clinic.inviteBody")}</p>

            <form action={formAction} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field label={t("clinic.firstName")} htmlFor="invite-first">
                  <Input id="invite-first" name="firstName" />
                </Field>
                <Field label={t("clinic.lastName")} htmlFor="invite-last">
                  <Input id="invite-last" name="lastName" />
                </Field>
              </div>
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
                <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-4 text-white">
                  <Glow className="-end-12 -top-12 h-32 w-32 opacity-60" />
                  <input type="hidden" name="seatFrom" value={seatAdd.fromSeats} />
                  <input type="hidden" name="seatTo" value={seatAdd.toSeats} />
                  <p className="relative text-[14px] leading-relaxed text-white/85 [&_span]:font-bold [&_span]:text-white">
                    {rich(t("clinic.seatAdds", { monthly: slot(0), today: slot(1) }), [
                      <Money cents={seatAdd.monthlyCents} />,
                      <Money cents={seatAdd.todayCents} />,
                    ])}
                  </p>
                  <div aria-hidden className="relative mt-3 flex gap-1">
                    {Array.from({ length: Math.min(seatAdd.toSeats, 12) }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-6 flex-1 rounded-md",
                          index < Math.min(seatAdd.fromSeats, 12) ? "bg-brand-500" : "bg-brand-200",
                        )}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {state.error ? (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {state.error}
                </p>
              ) : null}

              {state.ok && state.link ? (
                <div className="rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-100">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-800">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {t("clinic.inviteSent")}
                  </p>
                  {/*
                    🔴 The link is shown as well as sent, and that is honesty rather than
                    convenience: our mail domain is not verified yet, so `notify` reports
                    a failure rather than delivering, and a practice onboarding six people
                    needs a way through that does not depend on us.
                  */}
                  <p className="mt-1 text-[13px] text-brand-800">{t("clinic.inviteLink")}</p>
                  <p className="mt-1 break-all font-mono text-xs text-navy-700" dir="ltr">{state.link}</p>
                </div>
              ) : null}

              <Submit label={t("clinic.invite")} />
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
