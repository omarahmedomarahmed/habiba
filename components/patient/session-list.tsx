"use client";

import Link from "next/link";
import { CalendarClock, FileText, Zap } from "lucide-react";

import { Card } from "@/components/patient/kit";
import type { PatientSession, SessionDoor, SessionGroup } from "@/lib/data/patient-view";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { localeTag } from "@/lib/i18n/config";
import { PatientNoteOriginClient } from "@/components/notes/provenance-client";
import { Money } from "@/components/ui/money";
import { sortForGroup } from "@/lib/sessions/order";

/**
 * A patient's own sessions, in the four groups 15.3 names.
 *
 * ## Why "past instant from the radar" is its own list
 *
 * A booked appointment and a crisis session somebody found at 2am are
 * different kinds of event, and a single "past sessions" list reads as a
 * course of treatment that person never had. Separating them is not tidiness:
 * it is the difference between a history and a list of times somebody needed
 * help suddenly.
 *
 * ## 🔴 What is not here
 *
 * No note, no transcript, no diagnosis. `PatientSession` has no field that
 * could hold one — see `lib/data/patient-view.ts`. The only clinical text on
 * this screen is `brief`, which is written *to* the patient and only appears
 * once their clinician has signed it.
 */
/* 37L.1 — keys, resolved at render. A heading written here in English is a
   heading an Arabic reader meets in English. */
const HEADINGS: Record<SessionGroup, { title: MessageKey; blurb: MessageKey }> = {
  today: { title: "psessions.today", blurb: "psessions.todayBlurb" },
  upcoming: { title: "psessions.booked", blurb: "psessions.bookedBlurb" },
  past_scheduled: { title: "psessions.pastBooked", blurb: "psessions.pastBookedBlurb" },
  past_instant: {
    title: "psessions.radarGroup",
    blurb: "psessions.radarGroupBody",
  },
};

const ORDER: SessionGroup[] = ["today", "upcoming", "past_scheduled", "past_instant"];

/* 🔴 W2-P06: what each door says. Every label is one the app already uses for it. */
const DOOR_LABEL: Record<SessionDoor["kind"], MessageKey> = {
  join: "psessions.join",
  pay: "porb.pay",
  checking: "transfer.checking",
  summary: "home.summary",
};

export function PatientSessionList({
  sessions,
  zone,
  doors = {},
}: {
  sessions: PatientSession[];
  /**
   * 🔴 W2-P06: what each card opens, by session id, from `sessionDoors`. A card
   * with nothing on it was a card a patient could read and do nothing with.
   */
  doors?: Record<string, SessionDoor | null>;
  /** The account's own zone, from the server. 13.13 precedence, C84's rule. */
  zone: string | null;
}) {
  const t = useT();
  /*
   * 37L.9 — the language is asked for, not passed in.
   *
   * It used to be an optional `locale?: string` prop defaulting to `"en-US"`,
   * "because the demo has no reader". The demo is inside the provider like
   * everything else, so the default bought nothing and cost the usual thing:
   * the dates on this screen were the ones a patient reading Arabic met in
   * English, because `formatWhen` was never given anything to be wrong with.
   */
  const locale = useLocale();
  if (sessions.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-navy-700">{t("psessions.none")}</p>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">
          {t("psessions.noneBody")}
        </p>
      </Card>
    );
  }

  const resolved = resolveZone(zone);

  return (
    <div className="space-y-5">
      {ORDER.map((group) => {
        const rows = sortForGroup(
          group,
          sessions.filter((s) => s.group === group),
        );
        if (rows.length === 0) return null;

        return (
          <section key={group}>
            <h2 className="text-[17px] font-bold text-navy-700">{t(HEADINGS[group].title)}</h2>
            <p className="mt-0.5 text-[13px] text-navy-400">{t(HEADINGS[group].blurb)}</p>

            <ul className="mt-3 space-y-2.5">
              {rows.map((session) => (
                <li key={session.id}>
                  <Card className="p-4">
                    <p className="flex items-center gap-2 text-[15px] font-bold text-navy-700">
                      {group === "past_instant" ? (
                        <Zap className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                      ) : (
                        <CalendarClock className="h-4 w-4 shrink-0 text-navy-400" aria-hidden />
                      )}
                      {session.therapistName}
                      {/* 🔴 W3 / P3: the summary below carries its signer's credentials. */}
                      {session.therapistCredentials ? (
                        <span className="font-normal text-navy-400">, {session.therapistCredentials}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-navy-400">
                      {formatWhen(session.at, resolved, locale)}
                      {session.covered
                        ? /* 🔴 Board 418: the benefit paid it; the price printed alone read as money they paid. */
                          ` · ${t("psessions.coveredByBenefit")}`
                        : session.priceCents > 0
                        ? /*
                           * 🔴 THE CURRENCY THE SESSION WAS PRICED IN, not USD for everybody.
                           *
                           * This read `"USD"` as a literal. Every past session on a patient's own
                           * record was labelled in dollars whatever they had actually been charged,
                           * so somebody in Cairo who paid 450 EGP saw "$450" against their name —
                           * roughly twenty times what they paid, on the screen where they check
                           * what they paid.
                           *
                           * Found the moment sprint 52 seeded a session with a real price on it,
                           * which is the argument for seeding content rather than filming empty
                           * states: the defect was reachable from the first frame of the patient
                           * cut and invisible while the list was empty.
                           */
                          <> · <Money cents={session.owedCents ?? session.priceCents} currency={session.owedCents !== null ? "USD" : session.priceCurrency} /></>
                        : ` · ${t("psessions.free")}`}
                      {session.cancelled ? (
                        <span className="ms-1 font-semibold text-rose-600">· {t("psessions.cancelled")}</span>
                      ) : null}
                    </p>

                    {/*
                      🔴 47.4 — the patient sees which of their own sessions
                      were transcribed. It is their record and their choice
                      that produced it, so it is shown on the past ones whether
                      or not a brief has been written yet.
                    */}
                    {group.startsWith("past") && session.provenance ? (
                      <p className="mt-2">
                        <PatientNoteOriginClient provenance={session.provenance} />
                      </p>
                    ) : null}

                    {session.brief ? (
                      <p className="mt-3 rounded-2xl bg-navy-50 p-3.5 text-sm leading-relaxed text-navy-600">
                        {session.brief}
                      </p>
                    ) : null}

                    {/* 🔴 W1-03: what their clinician added after releasing it. */}
                    {session.briefAddenda.map((line, index) => (
                      <div key={index} className="mt-3 rounded-2xl bg-navy-50 p-3.5">
                        <p className="text-xs text-navy-400">
                          {t("psessions.addedLater", { name: line.by })} ·{" "}
                          {formatWhen(line.at, resolved, locale)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-600">
                          {line.body}
                        </p>
                      </div>
                    ))}

                    {/* 🔴 Board 729: said plainly, instead of a door into an hour that is over. */}
                    {session.missed ? (
                      <p className="mt-2 text-xs text-navy-400">{t("psessions.missed")}</p>
                    ) : null}

                    {session.briefPending ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-navy-400">
                        <FileText className="h-3 w-3" aria-hidden />
                        {t("psessions.writing")}
                      </p>
                    ) : null}

                    {doors[session.id] ? (
                      <Link
                        href={doors[session.id]!.href}
                        className="mt-3 inline-flex h-11 items-center rounded-2xl bg-brand-500 px-4 text-sm font-semibold text-navy-700 shadow-[0_8px_24px_-10px_rgba(46,196,182,0.7)] hover:bg-brand-400"
                      >
                        {t(DOOR_LABEL[doors[session.id]!.kind])}
                      </Link>
                    ) : null}

                    {/* 🔴 Ruling 16: cancel or move, free up to the window (a setting). */}
                    {session.changeable ? (
                      <Link
                        href={`/patient/sessions/${session.id}/change`}
                        className="ms-2 mt-3 inline-flex h-11 items-center rounded-2xl border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-600 hover:bg-navy-50"
                      >
                        {t("pchange.open")}
                      </Link>
                    ) : null}

                    {/* 🔴 W3: `auth.patient.p3` promised a way back to the same therapist. */}
                    {group.startsWith("past") ? (
                      <Link
                        href={`/t/${session.therapistId}`}
                        className="mt-3 ms-3 inline-flex h-10 items-center text-sm font-semibold text-brand-700"
                      >
                        {t("psessions.bookAgain")}
                      </Link>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
