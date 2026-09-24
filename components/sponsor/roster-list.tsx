"use client";

import { useState, useTransition } from "react";

import {
  endBenefit,
  pauseTheirBenefit,
  resumeTheirBenefit,
} from "@/app/(sponsor)/sponsor/people/actions";
import { Card } from "@/components/ui";
import { REMOVAL_REASONS } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

import { ConfirmAct } from "./confirm-act";

/**
 * The roster. PLAN.md 53.17b, 53.22, C227, C234, C240, C244.
 *
 * ## 🔴 WHAT IS NOT ON THIS COMPONENT
 *
 * No join date, no session, no booking, no therapist, no rejection, no approval.
 * Not filtered out here — never fetched: `roster()` in `lib/data/sponsors.ts` has
 * a select list with four columns in it, and `verify:sprint53` asserts what is
 * absent from that list AND, as a control, that it still returns the name and the
 * last-verified date. An absence assertion on its own passes against a function
 * that returns nothing at all.
 *
 * A join date is the one that looks harmless. It is the week somebody decided they
 * needed therapy, and set beside a restructure announcement it is a name.
 *
 * ## 🔴 Ordered by name, and that is load-bearing
 *
 * `roster()` orders by name and never by `created_at`. A list ordered by creation
 * IS the join date, recoverable by anybody who reads the list twice a month and
 * notices who appeared at the bottom. Alphabetical throws it away.
 *
 * ## 🔴 The removal confirmation says what removal does NOT do
 *
 * C234: *their badge, their funding and their record are three different things
 * and a build that treats them as one will take the record.* So the sentence
 * before the button says the funding ends and the record does not, and the same
 * promise is made to the PERSON before they enrol rather than only to the payer
 * here.
 */

const REASON_KEYS: Record<string, MessageKey> = {
  left: "sponsor.reason.left",
  graduated: "sponsor.reason.graduated",
  ended: "sponsor.reason.ended",
  administrative: "sponsor.reason.administrative",
};

export type RosterRow = {
  enrolmentId: string;
  name: string;
  /** W2-S11: paused by this company. Never a re-verification pause (E2). */
  held: boolean;
};

export function RosterList({ people, canRemove }: { people: RosterRow[]; canRemove: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (people.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.rosterEmpty")}</p>
      </Card>
    );
  }

  /*
   * 🔴 W2-S04: a reason CHOOSES, and a separate red button ends it.
   *
   * One tap on a reason used to end the benefit on the spot, with no Cancel once
   * the panel was open and nothing said afterwards: the row just vanished.
   */
  const close = () => {
    setOpenFor(null);
    setReason(null);
    setError(null);
  };

  const remove = (person: RosterRow, chosen: string) =>
    startTransition(async () => {
      const result = await endBenefit(person.enrolmentId, chosen);
      setError(result.error ?? null);
      if (!result.error) {
        close();
        setEnded(person.name);
      }
    });

  return (
    <div className="space-y-2">
      {ended ? (
        <p role="status" className="text-xs font-semibold text-brand-700">
          {t("sponsor.benefitEnded", { name: ended })}
        </p>
      ) : null}
      {people.map((person) => (
        <Card key={person.enrolmentId} className="p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">{person.name}</p>
            {person.held ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
                {t("sponsor.pausedLabel")}
              </span>
            ) : null}
            {/*
              W2-S11: pause and resume, beside end. The person is told in the
              app, with no employer and no reason; the record is untouched.
            */}
            {canRemove && openFor !== person.enrolmentId ? (
              <ConfirmAct
                className="ms-auto"
                label={person.held ? t("sponsor.resume") : t("sponsor.pause")}
                body={person.held ? t("sponsor.resumeBody") : t("sponsor.pauseBody")}
                done={person.held ? t("sponsor.resumed") : t("sponsor.pausedLabel")}
                act={() =>
                  person.held
                    ? resumeTheirBenefit(person.enrolmentId)
                    : pauseTheirBenefit(person.enrolmentId)
                }
              />
            ) : null}
          </div>

          {canRemove ? (
            openFor === person.enrolmentId ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                {/* 🔴 C234 — what ends and what does not, before the choice. */}
                <p className="text-xs leading-relaxed text-slate-600">
                  {t("sponsor.removeConfirm")}
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-700">
                  {t("sponsor.removeReason")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {REMOVAL_REASONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={pending}
                      aria-pressed={reason === value}
                      onClick={() => setReason(value)}
                      className={
                        reason === value
                          ? "tap-target h-9 rounded-xl bg-navy-500 px-3 text-xs font-semibold text-white disabled:opacity-50"
                          : "tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      }
                    >
                      {t(REASON_KEYS[value]!)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || reason === null}
                    onClick={() => reason && remove(person, reason)}
                    className="tap-target h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {t("sponsor.remove")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={close}
                    className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    {t("sponsor.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  close();
                  setOpenFor(person.enrolmentId);
                }}
                className="tap-target mt-2 h-9 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                {t("sponsor.remove")}
              </button>
            )
          ) : null}
        </Card>
      ))}

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
