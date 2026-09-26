import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, CalendarClock, FileText, MapPin, Radio, Route, UserRound, Video } from "lucide-react";

import { PatientBack } from "@/components/patient/back";
import { BookingChange, CancelledCard } from "@/components/patient/booking-change";
import { Card, Face, Glow, ghostButton, primaryButton } from "@/components/patient/kit";
import { PatientNoteOriginClient } from "@/components/notes/provenance-client";
import { cancelledView, changeView } from "@/lib/data/booking-change";
import {
  sessionDoors,
  sessionFactsForPatient,
  sessionsForPatient,
  type PaidBy,
  type SessionFacts,
} from "@/lib/data/patient-view";
import { localeTag } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { freeUntil } from "@/lib/scheduling/cancel-window";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("psession.meta"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/** 🔴 Founder, 26 Sep: the room is offered from five minutes before the start. */
const ROOM_OPENS_MS = 5 * 60_000;

const PAID_BY: Record<PaidBy, MessageKey> = {
  free: "psessions.free",
  benefit: "psession.payBenefit",
  benefit_part: "psession.payBenefitPart",
  wallet: "psession.payWallet",
  transfer: "psession.payTransfer",
  card: "psession.payCard",
  checking: "transfer.checking",
  unpaid: "psession.payUnpaid",
  refunded: "psession.payRefunded",
};

const BOOKED_HOW: Record<SessionFacts["sessionType"], MessageKey> = {
  scheduled: "psession.srcScheduled",
  radar: "psession.srcRadar",
  paid_link: "psession.srcPaidLink",
  direct: "psession.srcDirect",
};

/**
 * 🔴 ONE SESSION, ON ITS OWN PAGE. Founder, 26 Sep.
 *
 * "Session starting in N hours", then everything a person checks before an
 * appointment: with whom, when, how, who paid, and how it was booked. Then
 * what they can do about it: go into the room when it is open, pay when it is
 * owed, and move or cancel it under ruling 16's window, through the same
 * `changeView` and `BookingChange` the change page uses, so the policy is one
 * piece of code in two places rather than two policies.
 *
 * The session orb opens this page for the next session, and every card on the
 * sessions list opens it for its own.
 *
 * 🔴 §6: nothing clinical. The rows come from `sessionsForPatient`, whose
 * select list is the enforcement, and `sessionFactsForPatient`, which carries
 * enums, dates and a card's last four. The only prose is the brief written TO
 * the patient, once signed.
 */
export default async function PatientSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePatient();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { t, locale } = await getI18n();

  const [facts, all, doors] = await Promise.all([
    sessionFactsForPatient(actor.personId, id),
    sessionsForPatient(actor.personId),
    sessionDoors(actor.personId),
  ]);
  const session = all.find((row) => row.id === id);
  if (!facts || !session) notFound();

  const door = doors.find((row) => row.sessionId === id)?.door ?? null;
  const [change, gone] = await Promise.all([
    session.changeable ? changeView(actor.personId, id) : Promise.resolve(null),
    session.cancelled ? cancelledView(actor.personId, id) : Promise.resolve(null),
  ]);

  const zone = resolveZone(actor.timezone, change?.therapistTimezone ?? gone?.therapistTimezone ?? null);
  const now = Date.now();
  const startsAt = session.at.getTime();
  const ended = !session.live && (facts.endedAt !== null || facts.status === "completed");
  const future = !session.live && !ended && !session.cancelled && !session.missed && facts.scheduled && startsAt > now;

  /* "in 3 hours", "in 2 days", in the reader's language. */
  const relative = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  const startsIn = () => {
    const minutes = Math.max(1, Math.round((startsAt - now) / 60_000));
    if (minutes < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (hours < 48) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };

  const status = session.cancelled
    ? t("psessions.cancelled")
    : session.live
      ? t("psessions.now")
      : session.missed
        ? t("psessions.missed")
        : ended
          ? t("psession.ended")
          : future
            ? t("psession.startsIn", { when: startsIn() })
            : t("porb.ready");

  /*
   * 🔴 THE WAY BACK INTO THE ROOM: while the session runs, or from five
   * minutes before its start. A session with no booked hour (an invitation, a
   * radar session) is open as soon as its door is.
   */
  const roomOpen =
    door?.kind === "join" && (session.live || !facts.scheduled || startsAt - now <= ROOM_OPENS_MS);

  const paidBy =
    facts.paidBy === "card" && facts.cardLast4
      ? t("psession.payCardEnding", { last4: facts.cardLast4 })
      : t(PAID_BY[facts.paidBy]);

  const rows: { icon: typeof Video; label: string; value: React.ReactNode }[] = [
    {
      icon: UserRound,
      label: t("psession.with"),
      value: (
        <Link href={`/patient/t/${session.therapistId}`} className="font-semibold text-navy-700 underline-offset-2 hover:underline">
          {session.therapistName}
          {session.therapistCredentials ? (
            <span className="font-normal text-navy-400">, {session.therapistCredentials}</span>
          ) : null}
        </Link>
      ),
    },
    {
      icon: CalendarClock,
      label: t("psession.when"),
      value: (
        <>
          {formatWhen(session.at, zone, locale)}
          {facts.rescheduled ? <span className="block text-[13px] text-navy-400">{t("psession.rescheduled")}</span> : null}
        </>
      ),
    },
    {
      icon: session.modality === "in_person" ? MapPin : Video,
      label: t("psession.how"),
      value: session.modality === "in_person" ? t("psession.inPerson") : t("psession.video"),
    },
    {
      icon: Banknote,
      label: t("psession.paidBy"),
      value: paidBy,
    },
    {
      icon: Route,
      label: t("psession.bookedHow"),
      value: t(BOOKED_HOW[facts.sessionType], { name: session.therapistName }),
    },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 pt-4 pb-10">
      <PatientBack fallback="/patient/sessions" />

      {/* ------------------------------------------------ the headline card */}
      <section className="relative overflow-hidden rounded-[28px] bg-navy-900 p-5 text-white">
        <Glow className="-end-20 -top-20 h-56 w-56" />
        <div className="relative">
          <p
            className={cn(
              "flex items-center gap-2 text-[13px] font-semibold tracking-wide uppercase",
              session.live ? "text-red-300" : session.cancelled || session.missed ? "text-white/60" : "text-brand-300",
            )}
          >
            {session.live ? <span className="live-dot h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden /> : null}
            {session.live ? <Radio className="h-4 w-4" aria-hidden /> : null}
            {status}
          </p>
          <h1 className="mt-2 text-[24px] leading-tight font-bold tracking-tight text-balance">
            {formatWhen(session.at, zone, locale)}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <Face name={session.therapistName} photoUrl={facts.therapistPhoto} size={44} />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold">{session.therapistName}</p>
              <p className="truncate text-[13px] text-white/65">
                {session.modality === "in_person" ? t("psession.inPerson") : t("psession.video")}
              </p>
            </div>
          </div>

          {/* The one thing to do now, when there is one. */}
          {roomOpen && door ? (
            <Link href={door.href} className={`${primaryButton} mt-5 w-full`}>
              <Video className="h-4 w-4" aria-hidden />
              {session.live ? t("psessions.backIn") : t("psessions.enterRoom")}
            </Link>
          ) : door && (door.kind === "pay" || door.kind === "checking") ? (
            <Link
              href={door.href}
              className={cn(
                "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold",
                door.kind === "pay" ? "bg-amber-400 text-navy-700" : "bg-white/10 text-white ring-1 ring-white/15",
              )}
            >
              <Banknote className="h-4 w-4" aria-hidden />
              {door.kind === "pay" ? t("porb.pay") : t("transfer.checking")}
            </Link>
          ) : door?.kind === "join" && future ? (
            <p className="mt-5 rounded-2xl bg-white/[0.07] px-4 py-3 text-[14px] text-white/80 ring-1 ring-white/10">
              {t("psession.roomOpens")}
            </p>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ the facts */}
      <Card className="p-0">
        <dl className="divide-y divide-navy-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500">
                <row.icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-[12px] font-semibold tracking-wide text-navy-400 uppercase">{row.label}</dt>
                <dd className="mt-0.5 text-[15px] leading-snug text-navy-700">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      {/* ------------------------------------------------ move or cancel */}
      {change ? (
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-navy-700">{t("psession.change")}</h2>
          <p className={cn("text-[14px] leading-relaxed", change.free ? "text-emerald-700" : "text-amber-700")}>
            {/* The same sentences the change page says, from the same view. */}
            {change.covered
              ? t("pchange.covered")
              : change.transferWaiting && !change.paid
                ? t("pchange.transferWaiting")
                : !change.paid
                  ? t("pchange.unpaid")
                  : change.free
                    ? t("pchange.freeUntil", { date: formatWhen(freeUntil(change.at, change.windowHours), zone, locale) })
                    : t("pchange.late", { hours: change.windowHours })}
          </p>
          <BookingChange
            sessionId={change.sessionId}
            windowHours={change.windowHours}
            canMove={change.free}
            slots={change.slots.map((slot) => ({ id: slot.id, label: formatWhen(slot.startsAt, zone, locale) }))}
          />
        </section>
      ) : null}

      {/* ------------------------------------------------- a cancelled one */}
      {gone ? (
        <>
          {facts.cancelledBy ? (
            <p className="text-[14px] text-navy-500">
              {facts.cancelledBy === "patient" ? t("psession.cancelledByYou") : t("psession.cancelledByThem")}
            </p>
          ) : null}
          <CancelledCard money={gone.money} windowHours={gone.windowHours} />
        </>
      ) : null}

      {/* ---------------------------------------------- after it happened */}
      {session.provenance && (ended || session.missed) ? (
        <p>
          <PatientNoteOriginClient provenance={session.provenance} />
        </p>
      ) : null}

      {session.brief ? (
        <Card className="p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-navy-600">{session.brief}</p>
          {session.briefAddenda.map((line, index) => (
            <div key={index} className="mt-3 rounded-2xl bg-navy-50 p-3.5">
              <p className="text-xs text-navy-400">
                {t("psessions.addedLater", { name: line.by })} · {formatWhen(line.at, zone, locale)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-600">{line.body}</p>
            </div>
          ))}
        </Card>
      ) : session.briefPending ? (
        <p className="flex items-center gap-1.5 text-[14px] text-navy-400">
          <FileText className="h-4 w-4" aria-hidden />
          {t("psessions.writing")}
        </p>
      ) : null}

      {door?.kind === "summary" ? (
        <Link href={door.href} className={`${ghostButton} w-full`}>
          <FileText className="h-4 w-4" aria-hidden />
          {t("home.summary")}
        </Link>
      ) : null}

      {ended || session.missed || session.cancelled ? (
        <Link href={`/patient/t/${session.therapistId}`} className={`${primaryButton} w-full`}>
          {t("psessions.bookAgain")}
        </Link>
      ) : null}
    </main>
  );
}
