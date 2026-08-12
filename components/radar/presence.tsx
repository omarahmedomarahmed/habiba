"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, BellRing, Eye, Volume2, VolumeX } from "lucide-react";

import { radarPing } from "@/app/(app)/on-call/actions";
import {
  alarmRemembered,
  alarmServerSnapshot,
  alarmSnapshot,
  armAlarmAndAlerts,
  flashTitle,
  nudgeAlarm,
  playTone,
  startRinging,
  stopFlashingTitle,
  stopRinging,
  subscribeAlarm,
  type AlarmState,
} from "@/lib/alarm";
import type { RadarAttention } from "@/lib/data/radar";
import { cn } from "@/lib/utils";

/**
 * Fast while they are on the board, slow while they are not.
 *
 * The loop runs either way, and that is the fix for a bug that has now
 * happened twice in different clothes: the heartbeat used to start only when
 * this component mounted with `status !== offline`, so a clinician who
 * switched themselves on from the console — without navigating — was
 * advertised on the public radar with nothing beating for them, and dropped
 * off ninety seconds later while their own toggle still said "on". Polling
 * unconditionally means the server is the only thing that decides whether
 * somebody is live.
 */
const PING_LIVE_MS = 5_000;
/*
 * A minute when they are off the board, and nothing at all when the tab is
 * hidden.
 *
 * An offline clinician is not being advertised to anybody, so nothing depends
 * on this being fast — it exists only to notice that they switched themselves
 * on somewhere else. It matters because the database bills by the hour it is
 * awake: one portal tab left open overnight on a twenty-second poll keeps it
 * awake until morning, for a person who is not even on the radar.
 */
const PING_IDLE_MS = 60_000;

/** Nearly continuous once somebody is sitting in an empty room. */
const RING_EVERY_WAITING_MS = 1_400;
/** A telephone cadence while they are still paying. */
const RING_EVERY_MS = 2_600;

type Status = "offline" | "online" | "pending" | "in_session";

/**
 * Radar presence, mounted once for the whole portal.
 *
 * It lives in the app shell rather than on the radar page for two reasons, and
 * the first is a bug: the heartbeat that keeps a clinician on the public radar
 * used to run only while the radar page was open, so navigating to the
 * dashboard dropped them off the board ninety seconds later while the toggle
 * still said "on". Presence has to follow the clinician around the product,
 * because that is where they actually are.
 *
 * The second is the alarm. Someone in crisis is trying to reach them; hearing
 * about it only if they happen to be looking at one particular page is not an
 * alarm, it is a notification.
 */
export function RadarPresence({
  initialStatus,
  alertOnView,
  alertOnBooking,
  clinician,
}: {
  initialStatus: string;
  alertOnView: boolean;
  alertOnBooking: boolean;
  /** Only clinicians get asked to arm an alarm; nothing ever rings for an admin. */
  clinician: boolean;
}) {
  const [status, setStatus] = useState<Status>(initialStatus as Status);
  const active = status !== "offline";
  const [attention, setAttention] = useState<RadarAttention | null>(null);
  const [suspended, setSuspended] = useState<{ until: string; reason: string | null } | null>(null);
  /*
   * Silence *this* alarm, not all of them.
   *
   * Muting used to be permanent for the rest of the page's life, which meant a
   * clinician who silenced one ring never heard the next patient either. It
   * resets whenever a new booking arrives.
   */
  const [muted, setMuted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  const announcedRef = useRef<string | null>(null);
  const lastBookingRef = useRef<string | null>(null);

  /* ------------------------------------------------------------- audio -- */

  /*
   * One AudioContext for the whole tab, owned by `lib/alarm`, and this is
   * simply a view of it. See that file for why the previous inline version
   * never made a sound.
   */
  const sound = useSyncExternalStore(subscribeAlarm, alarmSnapshot, alarmServerSnapshot);

  /*
   * Bring the alarm back without asking, for somebody who already armed it.
   *
   * A hard reload is the case that makes this necessary. Client-side
   * navigation keeps the AudioContext — it lives in a module, not in a
   * component — but a full document load throws it away, and Chrome will not
   * resume a new one until this document has seen a gesture of its own. So we
   * try immediately (which succeeds once the browser trusts the origin), and
   * otherwise take the first interaction of any kind as the gesture. Nothing
   * is asked and nothing is shown; the clinician already answered this
   * question and should not be made to answer it again every reload.
   *
   * `visibilitychange` is here for the other half of it: a background tab has
   * its context suspended by the browser, and the tab in the background is
   * precisely the clinician who needs the alarm.
   */
  useEffect(() => {
    if (!clinician) return;
    void nudgeAlarm();

    const wake = () => {
      if (document.visibilityState === "visible") void nudgeAlarm();
    };
    const onGesture = () => void nudgeAlarm();

    document.addEventListener("visibilitychange", wake);
    for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(event, onGesture);
    }
    return () => {
      document.removeEventListener("visibilitychange", wake);
      for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
        window.removeEventListener(event, onGesture);
      }
    };
  }, [clinician]);

  /* ------------------------------------------------------ notifications -- */

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
  }, []);

  /**
   * Sound and notifications together, from one click.
   *
   * They used to be two separate asks in two separate places — a button on the
   * status pill for notifications and nothing at all for sound. A clinician
   * cannot be expected to know that a browser treats "may we make a noise" and
   * "may we show you a box" as different questions; from here it is one
   * decision, "can we reach you", and it is answered once.
   */
  const enableSound = useCallback(async () => {
    const result = await armAlarmAndAlerts();
    setPermission(result.notifications);
    if (result.sound === "ready") playTone("ring");
    return result.sound;
  }, []);

  /** Kept for the pill's notifications-only button when sound is already on. */
  const askPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      /* Some browsers throw on a non-user-gesture call. Nothing to do. */
    }
  }, []);

  /**
   * A notification that survives the tab being in the background.
   *
   * This is the whole point: a clinician with the portal open behind their
   * email client is exactly the person who needs telling. `requireInteraction`
   * keeps a booking on screen until they act on it, because a toast that
   * disappears after four seconds is not how you tell somebody a patient in
   * crisis has paid and is waiting.
   */
  const notify = useCallback(
    (title: string, body: string, sticky: boolean, href?: string) => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      try {
        const notification = new Notification(title, {
          body,
          tag: "24therapy-radar",
          requireInteraction: sticky,
          silent: true, // We make our own noise, and it carries more meaning.
        });
        /*
         * Clicking the notification goes straight into the room.
         *
         * Not to the dashboard, not to the radar page — into the session. A
         * clinician who has just been told a patient is waiting should be one
         * tap from the patient, not one tap from a menu.
         */
        notification.onclick = () => {
          window.focus();
          if (href) window.location.assign(href);
          notification.close();
        };
      } catch {
        /* Safari throws for `new Notification` outside a service worker. */
      }
    },
    [],
  );

  /* -------------------------------------------------------------- ping -- */

  // One request does the heartbeat, the booking check and the status together.
  // Splitting them would allow a state where we keep advertising someone while
  // failing to tell them anybody is knocking.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const result = await radarPing();
        if (cancelled) return;
        setAttention(result.attention);
        setStatus(result.status);
        setSuspended(
          result.suspendedUntil
            ? { until: result.suspendedUntil, reason: result.suspendedReason }
            : null,
        );
      } catch {
        // The next ping is seconds away, and the sweep takes them offline if
        // the tab is genuinely gone.
      }
    };

    void tick();
    const timer = setInterval(tick, active ? PING_LIVE_MS : PING_IDLE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  /*
   * Ring on each *change* of state, not once per session.
   *
   * A visitor opening the sheet and then paying is two events a minute apart,
   * and the clinician should hear both — the first as a heads-up, the second
   * as "go to the room now". Keying the guard on kind+session is what makes
   * the second one sound.
   *
   * Only the confirmed booking repeats. A repeating alarm for someone who is
   * merely reading a profile would be intolerable within a day.
   */
  useEffect(() => {
    if (!attention) {
      /*
       * A booking that was there and is not any more.
       *
       * Almost always the patient closing the page or their payment failing.
       * The clinician has just been told to go to a room, so they have to be
       * told just as clearly that nobody is coming.
       */
      if (lastBookingRef.current) {
        lastBookingRef.current = null;
        playTone("cancel");
        notify("Booking cancelled", "They did not go through with it. You are back on the radar.", false);
      }
      announcedRef.current = null;
      return;
    }

    const signature =
      attention.kind === "viewing" ? "viewing" : `${attention.kind}:${attention.sessionId}`;
    if (attention.kind !== "viewing") lastBookingRef.current = signature;

    if (announcedRef.current === signature) return;
    announcedRef.current = signature;

    if (attention.kind === "viewing") {
      if (alertOnView) {
        playTone("soft");
        notify("Someone is looking at your profile", "You are showing as busy to everyone else.", false);
      }
      return;
    }

    if (alertOnBooking) {
      // A new booking un-mutes. Silencing the last one was about the last one.
      setMuted(false);
      notify(
        attention.waiting
          ? "Your patient is waiting in the room"
          : attention.kind === "confirmed"
            ? "Your patient is joining"
            : "Someone is booking you",
        attention.waiting
          ? `${attention.patientName ?? "They"} has joined and is looking at an empty screen. Tap to go in.`
          : attention.kind === "confirmed"
            ? "They have paid and are on their way in. Tap to open the room."
            : "They are paying now. Be in the room when they arrive.",
        true,
        `/sessions/${attention.sessionId}/room`,
      );
    }
  }, [attention, alertOnView, alertOnBooking, notify]);

  /*
   * The ring, and how fast it goes.
   *
   * Kept in its own effect keyed on `waiting`, because the cadence has to
   * change *during* an alarm rather than only when one starts: the moment the
   * patient actually joins, the same booking becomes twice as urgent and the
   * ringing has to say so without waiting for a new event.
   *
   * `sound` is in the dependency list on purpose. A clinician who arms the
   * alarm while it is already trying to ring — which is precisely what the
   * prompt below is for — must start hearing it immediately, not at the next
   * booking.
   *
   * It does not stop on a timer. It stops when the clinician opens the room or
   * silences it, because that is the only evidence that a human has noticed.
   */
  const booking = Boolean(attention) && attention?.kind !== "viewing";
  const waiting = attention?.kind !== "viewing" && Boolean(attention?.waiting);
  const ringing = booking && alertOnBooking && !muted;

  useEffect(() => {
    if (!ringing || sound !== "ready") {
      stopRinging();
      return;
    }
    startRinging(waiting ? "urgent" : "ring", waiting ? RING_EVERY_WAITING_MS : RING_EVERY_MS);
    return () => stopRinging();
  }, [ringing, waiting, sound]);

  /*
   * The tab title flashes for as long as somebody is waiting, muted or not.
   *
   * It is the one channel that cannot be blocked, denied or muted, and it
   * costs nothing. A clinician who silenced the ring has silenced the ring —
   * they have not stopped having a patient.
   */
  useEffect(() => {
    if (!booking) {
      stopFlashingTitle();
      return;
    }
    flashTitle(waiting ? "🔴 PATIENT WAITING FOR YOU" : "🔔 Patient joining — open the room");
    return () => stopFlashingTitle();
  }, [booking, waiting]);

  useEffect(
    () => () => {
      stopRinging();
      stopFlashingTitle();
    },
    [],
  );

  /* ------------------------------------------------------------ render -- */

  return (
    <>
      {clinician ? (
        <SoundPrompt
          sound={sound}
          onEnable={enableSound}
          /* An unarmed alarm during an actual booking is not a suggestion. */
          forced={ringing}
          online={active}
        />
      ) : null}

      {!active ? null : (
        <>
          <StatusPill
            status={status}
            suspended={suspended}
            permission={permission}
            sound={sound}
            onAskPermission={askPermission}
            onEnableSound={enableSound}
          />

          {attention?.kind === "viewing" ? (
            <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 lg:bottom-4 lg:justify-end lg:pe-4">
              <p className="animate-fade-rise flex items-center gap-2 rounded-full bg-navy-500/95 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
                <Eye className="h-3.5 w-3.5 text-teal-300" aria-hidden />
                Someone is looking at your profile — you are showing as busy to others
              </p>
            </div>
          ) : null}

          {attention && attention.kind !== "viewing" ? (
            <div className="safe-bottom fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 lg:bottom-4 lg:start-auto lg:w-96 lg:pe-4">
              <div
                className={cn(
                  "animate-fade-rise rounded-2xl px-4 py-3.5 text-white shadow-2xl shadow-black/40",
                  attention.waiting ? "bg-red-600" : "bg-navy-500",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <BellRing className="live-dot mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {attention.waiting
                        ? `${attention.patientName ?? "Your patient"} is waiting for you`
                        : attention.kind === "confirmed"
                          ? "Your patient is joining"
                          : "Someone is booking you"}
                    </p>
                    <p className="mt-0.5 text-xs text-white/80">
                      {attention.waiting
                        ? "They are in the room now, looking at an empty screen. Go in."
                        : attention.kind === "confirmed"
                          ? "They have paid and are on their way into the room."
                          : "They are paying now. Open the room and be there when they arrive."}
                    </p>
                  </div>

                  {/*
                    Silence this ring, not every future one.
                    ---------------------------------------
                    It used to mute permanently for the life of the page, so a
                    clinician who quieted one alarm never heard the next patient.
                    The banner stays, because silence must not mean "dismissed" —
                    somebody is still waiting.
                  */}
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute the alarm" : "Silence this alarm"}
                    aria-pressed={muted}
                    className="tap-target flex shrink-0 items-center justify-center rounded-lg text-white/60 hover:text-white"
                  >
                    {muted ? (
                      <Volume2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <VolumeX className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>

                <Link
                  href={`/sessions/${attention.sessionId}/room`}
                  onClick={() => {
                    stopRinging();
                    stopFlashingTitle();
                  }}
                  className={cn(
                    "mt-3 flex h-12 items-center justify-center rounded-xl text-sm font-semibold",
                    attention.waiting ? "bg-white text-red-700" : "bg-teal-500 text-white",
                  )}
                >
                  {attention.waiting ? "Go in now" : "Open the room"}
                </Link>

                {muted ? (
                  <p className="mt-2 text-center text-[11px] text-white/60">
                    Sound off for this one. The next patient will still ring.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- the ask -- */

/** Asked once per browser session, then never again unless it actually matters. */
const ASKED_KEY = "24t.alarm.asked";

/**
 * "Turn your alarm on."
 *
 * A browser will not make a sound until the person has clicked something, and
 * it will not tell you whether it intends to. The old code responded to that
 * by hoping — building the AudioContext on whatever click happened to come
 * along — and the result was a product that showed a banner saying a patient
 * was waiting while making no noise whatsoever. That is worse than having no
 * alarm, because the clinician believes they have one.
 *
 * So we ask, plainly, with a button whose click *is* the gesture the browser
 * wants, and we play the alarm back immediately so the answer to "did that
 * work" is something they heard rather than something we claimed.
 *
 * It portals to the body: the pages this can appear over set `isolate` on
 * their heroes, and no z-index wins against a stacking context.
 */
function SoundPrompt({
  sound,
  onEnable,
  forced,
  online,
}: {
  sound: AlarmState;
  onEnable: () => Promise<AlarmState>;
  forced: boolean;
  online: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      /*
       * Two reasons not to ask, and they are different.
       *
       * `ASKED_KEY` is "you said not now, this session". `alarmRemembered()`
       * is "you already said yes, on this machine" — and after a hard reload
       * that clinician has a suspended context through no fault of their own,
       * which the effect above fixes on their first click. Putting a modal in
       * front of them for the two seconds in between would be asking a
       * question they have already answered, on every single page load.
       */
      setDismissed(window.sessionStorage.getItem(ASKED_KEY) === "1" || alarmRemembered());
    } catch {
      setDismissed(false);
    }
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* Private mode — they get asked again on the next page. */
    }
  };

  if (!mounted || sound === "ready") return null;
  if (dismissed && !forced) return null;

  const blocked = sound === "blocked";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="animate-fade-rise w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50">
          <BellRing className="h-5 w-5 text-teal-600" aria-hidden />
        </span>

        <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">
          {blocked ? "Your browser is blocking the alarm" : "Turn on your alarm"}
        </p>

        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {blocked ? (
            <>
              Sound is switched off for this site. Open the padlock in the address bar, set{" "}
              <strong>Sound</strong> to <em>Allow</em>, and reload — otherwise a patient can be
              waiting in your room with nothing to tell you.
            </>
          ) : (
            <>
              Browsers stay silent until you say otherwise. One tap and 24Therapy can ring you
              anywhere in the portal — including when this tab is in the background.
            </>
          )}
        </p>

        {forced ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Someone is booking you right now and you cannot hear it.
          </p>
        ) : null}

        {!blocked ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const next = await onEnable();
              setBusy(false);
              if (next === "ready") close();
            }}
            className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 text-base font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-400 disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4" aria-hidden />
            {busy ? "Turning it on…" : "Turn the alarm on"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={close}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          {blocked ? "I will fix it in my browser" : online ? "Not now" : "Later"}
        </button>

        <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
          You will hear a short ring so you know it worked.
        </p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * What patients are seeing, right now, on every page.
 *
 * A clinician who has switched themselves on has one question all day — "am I
 * actually showing as available?" — and until this existed the only way to
 * answer it was to open the public radar in another tab. It updates from the
 * same five-second ping that carries the alarm, so it is never more than a few
 * seconds behind the board itself.
 */
function StatusPill({
  status,
  suspended,
  permission,
  sound,
  onAskPermission,
  onEnableSound,
}: {
  status: Status;
  suspended: { until: string; reason: string | null } | null;
  permission: NotificationPermission | "unsupported";
  sound: AlarmState;
  onAskPermission: () => void;
  onEnableSound: () => void;
}) {
  if (suspended) {
    return (
      <div className="safe-top fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-2">
        <p className="rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg">
          Off the radar until {new Date(suspended.until).toLocaleString()}
          {suspended.reason ? ` · ${suspended.reason}` : ""}
        </p>
      </div>
    );
  }

  const label =
    status === "in_session"
      ? "In a session"
      : status === "pending"
        ? "Busy — someone is booking you"
        : status === "online"
          ? "Live on the radar"
          : "Off the radar";

  return (
    <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy-500/90 py-1.5 pe-2 ps-3 text-xs font-medium text-white shadow-lg backdrop-blur">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "online"
              ? "live-dot bg-teal-400"
              : status === "pending"
                ? "bg-amber-400"
                : status === "in_session"
                  ? "bg-brand-400"
                  : "bg-slate-500",
          )}
        />
        {label}

        {/*
          Sound outranks notifications here, because it is the one that wakes a
          person who is not looking at the screen — and because it is the one
          that was silently broken. A clinician showing as live with a muted
          alarm is being advertised as reachable and is not reachable.
        */}
        {sound !== "ready" ? (
          <button
            type="button"
            onClick={onEnableSound}
            className="ms-1 flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-400"
          >
            <VolumeX className="h-3 w-3" aria-hidden />
            sound off — turn on
          </button>
        ) : permission === "default" ? (
          <button
            type="button"
            onClick={onAskPermission}
            className="ms-1 flex items-center gap-1 rounded-full bg-teal-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-teal-400"
          >
            <Bell className="h-3 w-3" aria-hidden />
            Alert me
          </button>
        ) : permission === "denied" ? (
          <span className="ms-1 rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/60">
            notifications blocked
          </span>
        ) : null}
      </div>
    </div>
  );
}
