"use client";

import { CalendarClock, FileText, Zap } from "lucide-react";

import { Card } from "@/components/ui";
import type { PatientSession, SessionGroup } from "@/lib/data/patient-view";
import { formatMoney } from "@/lib/billing/plans";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

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

export function PatientSessionList({
  sessions,
  zone,
  locale = "en-US",
}: {
  sessions: PatientSession[];
  /** The account's own zone, from the server. 13.13 precedence, C84's rule. */
  zone: string | null;
  /**
   * 19.4 — the reader's language, from the server, for the same reason as the
   * zone. Defaulted only because the public demo renders this component with
   * invented rows and no reader; every real screen passes it.
   */
  locale?: string;
}) {
  const t = useT();
  if (sessions.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("psessions.none")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("psessions.noneBody")}
        </p>
      </Card>
    );
  }

  const resolved = resolveZone(zone);

  return (
    <div className="space-y-5">
      {ORDER.map((group) => {
        const rows = sessions.filter((s) => s.group === group);
        if (rows.length === 0) return null;

        return (
          <section key={group}>
            <h2 className="text-sm font-semibold text-slate-900">{t(HEADINGS[group].title)}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t(HEADINGS[group].blurb)}</p>

            <ul className="mt-2 space-y-2">
              {rows.map((session) => (
                <li key={session.id}>
                  <Card className="p-3.5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {group === "past_instant" ? (
                        <Zap className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                      ) : (
                        <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      )}
                      {session.therapistName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatWhen(session.at, resolved)}
                      {session.priceCents > 0
                        ? ` · ${formatMoney(session.priceCents, "USD", locale)}`
                        : ` · ${t("psessions.free")}`}
                    </p>

                    {session.brief ? (
                      <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                        {session.brief}
                      </p>
                    ) : null}

                    {session.briefPending ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <FileText className="h-3 w-3" aria-hidden />
                        {t("psessions.writing")}
                      </p>
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
