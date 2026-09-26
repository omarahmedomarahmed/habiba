"use client";

import { useMemo, useState, useTransition } from "react";

import {
  closeHour,
  invitePatient,
  moveBookedHour,
  openHoursOn,
  type BookingState,
} from "@/app/(app)/bookings/actions";
import { Card } from "@/components/clinician/kit";
import { useLocale, useT } from "@/lib/i18n/client";
import { dayKey, formatTime, formatWeekday, zoneLabel } from "@/lib/scheduling/tz";

/**
 * The clinician's calendar. PLAN.md 51.7.
 *
 * ## What was here before
 *
 * Fourteen day chips and a flat list of hours. That is a form for publishing
 * availability, not a calendar, and a clinician looking at it could not answer
 * "what does my Thursday look like" without counting rows. 51.7 calls the
 * bookings page a third built and this is the two thirds.
 *
 * ## Three views, one selection
 *
 * Day, week and month all render the SAME selected set of `YYYY-MM-DD` keys
 * and the same slot list, so switching view never loses what somebody picked.
 * A month view whose selection resets when you look at a week is a month view
 * nobody uses twice.
 *
 * ## 🔴 Every day key is computed in the clinician's own zone
 *
 * `dayKey(at, zone)` rather than `at.toISOString().slice(0, 10)`. At 23:30 in
 * Cairo the UTC date is still yesterday, so a naive key puts the evening's
 * hours on the wrong day and the clinician publishes Tuesday thinking they
 * published Wednesday. The same rule 11R.2 fixed in `publishHours`, on the
 * other side of the wire.
 *
 * ## What this screen does NOT let you do
 *
 * Close a booked hour. `withdrawHour` is conditional on `status = 'open'` and
 * this component does not render the control for anything else: an appointment
 * somebody is planning their week around is cancelled with a message, through
 * `cancelBooking`, rather than deleted out from under them.
 */

export type CalendarSlot = {
  id: string;
  /** ISO. Rendered through the clinician's zone, never the runtime's. */
  startsAt: string;
  status: "open" | "held" | "booked" | "blocked";
  note: string | null;
  patientName: string | null;
};

type View = "day" | "week" | "month";

export function Calendar({
  zone,
  slots,
  patients,
}: {
  zone: string;
  slots: CalendarSlot[];
  patients: { id: string; name: string }[];
}) {
  const t = useT();
  const locale = useLocale();

  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<string[]>([]);
  const [fromHour, setFromHour] = useState(9);
  const [toHour, setToHour] = useState(17);
  /* 🔴 Ruling 5c: where these hours can be booked for. */
  const [place, setPlace] = useState<"online" | "in_person" | "either">("online");
  const [invitee, setInvitee] = useState(patients[0]?.id ?? "");
  const [state, setState] = useState<BookingState>({});
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () => slots.map((slot) => ({ ...slot, at: new Date(slot.startsAt) })),
    [slots],
  );

  /* Slots grouped by the clinician's own calendar day. */
  const byDay = useMemo(() => {
    const map = new Map<string, (CalendarSlot & { at: Date })[]>();
    for (const slot of parsed) {
      const key = dayKey(slot.at, zone);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    for (const list of map.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime());
    return map;
  }, [parsed, zone]);

  const days = useMemo(() => visibleDays(anchor, view, zone), [anchor, view, zone]);

  const step = (direction: 1 | -1) => {
    const size = view === "day" ? 1 : view === "week" ? 7 : 30;
    setAnchor(new Date(anchor.getTime() + direction * size * 24 * 3_600_000));
  };

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const publish = () =>
    startTransition(async () => {
      setState({});
      const result = await openHoursOn({ days: selected, fromHour, toHour, zone, place });
      setState(result);
      if (result.ok) setSelected([]);
    });

  const close = (slotId: string) =>
    startTransition(async () => {
      setState({});
      setState(await closeHour(slotId));
    });

  /* 🔴 Ruling 16: a booked hour moves to an open one; never charged again. */
  const [moveTo, setMoveTo] = useState("");
  const openAhead = parsed.filter((slot) => slot.status === "open" && slot.at.getTime() > Date.now());
  const move = (fromSlotId: string) =>
    startTransition(async () => {
      setState({});
      const target = moveTo || openAhead[0]?.id || "";
      const result = await moveBookedHour({ fromSlotId, toSlotId: target });
      setState(result.ok ? { ok: true, message: t("tchange.moved") } : { error: t(result.errorKey ?? "pchange.errGone") });
    });

  const invite = (slotId: string) =>
    startTransition(async () => {
      setState({});
      setState(await invitePatient({ slotId, patientId: invitee }));
    });

  /*
   * 🔴 37L.9 / C84 — through the helper, not an `Intl.DateTimeFormat` built
   * here.
   *
   * The first draft constructed one with `dateTag(locale)` and `timeZone:
   * zone`, which is correct on both axes and still wrong: the rule is that
   * formatting lives in one place, because a component that builds its own
   * formatter is one `timeZone` away from rendering a Vercel server's idea of
   * Thursday and nothing would catch it. `verify:sprint12` and
   * `verify:sprint37l2` both refused it, which is the rule working.
   */
  const dayLabel = (at: Date) => formatWeekday(at, zone, locale);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ the controls */}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl bg-navy-50 p-0.5">
          {(["day", "week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={
                view === option
                  ? "tap-target h-9 rounded-lg bg-white px-3 text-xs font-semibold text-navy-700 shadow-sm"
                  : "tap-target h-9 rounded-lg px-3 text-xs font-medium text-navy-400"
              }
            >
              {t(`portal.book.${option}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            className="tap-target h-9 rounded-lg px-2.5 text-xs font-medium text-navy-400 hover:bg-navy-50"
          >
            {t("portal.book.previous")}
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="tap-target h-9 rounded-lg px-2.5 text-xs font-semibold text-navy-700 hover:bg-navy-50"
          >
            {t("portal.book.today")}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="tap-target h-9 rounded-lg px-2.5 text-xs font-medium text-navy-400 hover:bg-navy-50"
          >
            {t("portal.book.next")}
          </button>
        </div>
      </div>

      {/*
        🔴 The zone, said out loud, on the screen where hours are published.

        11R.2's defect was a clinician in Cairo publishing "18:00" and getting
        a different wall-clock hour half the year. The hours here ARE their
        wall clock, and saying which clock removes the only ambiguity left.
      */}
      <p className="text-xs text-navy-400">
        {t("portal.book.zone", { zone: zoneLabel(zone, locale) })}
      </p>

      {/* ---------------------------------------------------------- the grid */}

      <div
        className={
          view === "month"
            ? "grid grid-cols-7 gap-1"
            : view === "week"
              ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
              : "grid grid-cols-1 gap-2"
        }
      >
        {days.map((day) => {
          const hours = byDay.get(day.key) ?? [];
          const picked = selected.includes(day.key);
          const booked = hours.filter((slot) => slot.status === "booked").length;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => toggle(day.key)}
              aria-pressed={picked}
              className={
                picked
                  ? "rounded-xl border border-brand-400 bg-brand-50 p-2 text-start"
                  : "rounded-xl border border-navy-100 p-2 text-start hover:border-navy-200"
              }
            >
              <span className="block text-xs font-medium text-navy-700">
                {dayLabel(day.at)}
              </span>
              {/*
                A count, not a list, in month view. Nine hours rendered inside
                a 40px cell is a smear; the number is the thing somebody scans
                a month for, and the day view is one tap away.
              */}
              <span className="mt-0.5 block text-[11px] text-navy-400">
                {hours.length === 0
                  ? ""
                  : booked > 0
                    ? `${hours.length} · ${booked} ${t("portal.book.statusBooked")}`
                    : `${hours.length}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------- publishing into the pick */}

      {selected.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-navy-700">{t("portal.book.openHours")}</p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs text-navy-400">
              <span className="block">{t("portal.book.from")}</span>
              <select
                value={fromHour}
                onChange={(event) => setFromHour(Number(event.target.value))}
                className="mt-1 h-11 rounded-xl border border-navy-100 px-2 text-sm"
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-navy-400">
              <span className="block">{t("portal.book.to")}</span>
              <select
                value={toHour}
                onChange={(event) => setToHour(Number(event.target.value))}
                className="mt-1 h-11 rounded-xl border border-navy-100 px-2 text-sm"
              >
                {HOURS.slice(1).concat(24).map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-navy-400">
              <span className="block">{t("portal.book.place")}</span>
              <select
                value={place}
                onChange={(event) => setPlace(event.target.value as typeof place)}
                className="mt-1 h-11 rounded-xl border border-navy-100 px-2 text-sm"
              >
                <option value="online">{t("portal.book.placeOnline")}</option>
                <option value="in_person">{t("portal.book.placeInPerson")}</option>
                <option value="either">{t("portal.book.placeEither")}</option>
              </select>
            </label>

            <button
              type="button"
              disabled={pending}
              onClick={publish}
              className="tap-target h-11 rounded-xl bg-navy-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? t("portal.book.publishing") : t("portal.book.publish")}
            </button>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------- the picked days' hours */}

      {selected.length > 0
        ? selected
            .slice()
            .sort()
            .map((key) => {
              const hours = byDay.get(key) ?? [];
              return (
                <Card key={key} className="p-4">
                  <p className="text-sm font-semibold text-navy-700">{key}</p>

                  {hours.length === 0 ? (
                    <p className="mt-1 text-sm text-navy-400">
                      {t("portal.book.nothingOpen")}
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {hours.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-100 px-3 py-2"
                        >
                          <div>
                            <span className="text-sm font-medium text-navy-700">
                              {formatTime(slot.at, zone)}
                            </span>
                            <span className="ms-2 text-xs text-navy-400">
                              {t(`portal.book.status${cap(slot.status)}` as never)}
                              {slot.patientName ? ` · ${slot.patientName}` : ""}
                            </span>
                          </div>

                          {/*
                            🔴 Only an OPEN hour can be closed here.

                            `withdrawHour` refuses anything else, and rendering
                            a control that the data layer will refuse is how a
                            clinician learns to distrust the screen. A booked
                            hour is cancelled with a message, elsewhere.
                          */}
                          {slot.status === "booked" && slot.at.getTime() > Date.now() ? (
                            openAhead.length === 0 ? (
                              <span className="text-xs text-navy-400">{t("tchange.noOpen")}</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={moveTo || openAhead[0]?.id}
                                  onChange={(event) => setMoveTo(event.target.value)}
                                  aria-label={t("tchange.moveTo")}
                                  className="h-9 rounded-lg border border-navy-100 px-2 text-xs"
                                >
                                  {openAhead.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {dayKey(option.at, zone)} {formatTime(option.at, zone)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => move(slot.id)}
                                  className="tap-target h-9 rounded-lg bg-navy-600 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  {t("tchange.move")}
                                </button>
                              </div>
                            )
                          ) : null}

                          {slot.status === "open" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {patients.length > 0 ? (
                                <>
                                  <select
                                    value={invitee}
                                    onChange={(event) => setInvitee(event.target.value)}
                                    aria-label={t("portal.book.invitePick")}
                                    className="h-9 rounded-lg border border-navy-100 px-2 text-xs"
                                  >
                                    {patients.map((patient) => (
                                      <option key={patient.id} value={patient.id}>
                                        {patient.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => invite(slot.id)}
                                    className="tap-target h-9 rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-navy-600 hover:bg-brand-400 disabled:opacity-50"
                                  >
                                    {pending
                                      ? t("portal.book.inviteSending")
                                      : t("portal.book.inviteSend")}
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => close(slot.id)}
                                className="tap-target h-9 rounded-lg px-2.5 text-xs font-medium text-navy-400 hover:underline disabled:opacity-50"
                              >
                                {t("portal.book.withdraw")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
        : null}

      {state.ok && state.message === t("tchange.moved") ? (
        <p role="status" className="text-xs text-brand-800">
          {state.message}
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}

      {/*
        🔴 Two sentences a clinician needs before they open an hour, and both
        are consequences they cannot see from this screen.
      */}
      <div className="space-y-1.5 text-xs leading-relaxed text-navy-400">
        <p>{t("portal.book.reminder")}</p>
        <p>{t("portal.book.blocksRadar")}</p>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The days this view covers, keyed in the CLINICIAN's zone.
 *
 * Stepping by 24 hours and asking `Intl` which day that lands on, rather than
 * incrementing a UTC date: at 23:30 in Cairo the UTC date is still yesterday,
 * so the first cell would carry a day that has already gone. The same reason
 * `upcomingDays` in the old editor did it this way.
 *
 * A clocks-change boundary can make two steps land on the same day, so the
 * keys are de-duplicated rather than assumed distinct.
 */
function visibleDays(anchor: Date, view: View, zone: string): { key: string; at: Date }[] {
  const count = view === "day" ? 1 : view === "week" ? 7 : 35;
  const out: { key: string; at: Date }[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const at = new Date(anchor.getTime() + index * 24 * 3_600_000);
    const key = dayKey(at, zone);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, at });
  }

  return out;
}
