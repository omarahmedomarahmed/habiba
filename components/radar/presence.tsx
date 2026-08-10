"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Eye, VolumeX } from "lucide-react";

import { radarPing } from "@/app/(app)/on-call/actions";
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
}: {
  initialStatus: string;
  alertOnView: boolean;
  alertOnBooking: boolean;
}) {
  const [status, setStatus] = useState<Status>(initialStatus as Status);
  const active = status !== "offline";
  const [attention, setAttention] = useState<RadarAttention | null>(null);
  const [suspended, setSuspended] = useState<{ until: string; reason: string | null } | null>(null);
  const [muted, setMuted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  const audioRef = useRef<AudioContext | null>(null);
  const alarmRef = useRef<number | null>(null);
  const announcedRef = useRef<string | null>(null);
  const lastBookingRef = useRef<string | null>(null);

  /* ------------------------------------------------------------- audio -- */

  /*
   * Browsers refuse to make noise until the user has interacted with the page,
   * and a suspended AudioContext fails silently — which for an alarm is the
   * worst possible failure. So it is built on the first pointer event anywhere
   * in the portal, long before anyone books.
   */
  useEffect(() => {
    if (audioRef.current) return;

    const unlock = () => {
      const Ctor =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor && !audioRef.current) audioRef.current = new Ctor();
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  /**
   * Three sounds, because they mean three different things.
   *
   * A soft single tone when someone opens your profile — a heads-up, easy to
   * ignore. A ringing two-tone pattern, repeated, when they have paid and are
   * walking in: it is meant to sound like a phone, because that is what it is.
   * A falling pair when a booking evaporates, so a clinician who stood up to
   * take a session knows to sit back down.
   */
  const beep = useCallback(
    (tone: "soft" | "ring" | "cancel") => {
      const context = audioRef.current;
      if (!context || muted) return;
      void context.resume();

      const pattern =
        tone === "soft"
          ? ([[0, 660, 0.14]] as const)
          : tone === "cancel"
            ? ([
                [0, 520, 0.16],
                [0.18, 392, 0.16],
              ] as const)
            : ([
                [0, 880, 0.34],
                [0.16, 1174, 0.34],
                [0.5, 880, 0.34],
                [0.66, 1174, 0.34],
              ] as const);

      const now = context.currentTime;
      for (const [offset, frequency, volume] of pattern) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.16);
      }
    },
    [muted],
  );

  const stopAlarm = useCallback(() => {
    if (alarmRef.current !== null) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
  }, []);

  /* ------------------------------------------------------ notifications -- */

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
  }, []);

  /**
   * Ask once, when they go on the radar.
   *
   * Not on page load: a permission prompt on arrival is the thing everyone
   * dismisses reflexively, and once dismissed it cannot be asked again. At the
   * moment somebody switches themselves on to take crisis calls, "can we tell
   * you when one arrives" is a question with an obvious answer.
   */
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
    (title: string, body: string, sticky: boolean) => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      try {
        const notification = new Notification(title, {
          body,
          tag: "24therapy-radar",
          requireInteraction: sticky,
          silent: true, // We make our own noise, and it carries more meaning.
        });
        notification.onclick = () => {
          window.focus();
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
        beep("cancel");
        notify("Booking cancelled", "They did not go through with it. You are back on the radar.", false);
      }
      announcedRef.current = null;
      stopAlarm();
      return;
    }

    const signature =
      attention.kind === "viewing" ? "viewing" : `${attention.kind}:${attention.sessionId}`;
    if (attention.kind !== "viewing") lastBookingRef.current = signature;

    if (announcedRef.current === signature) return;
    announcedRef.current = signature;

    stopAlarm();

    if (attention.kind === "viewing") {
      if (alertOnView) {
        beep("soft");
        notify("Someone is looking at your profile", "You are showing as busy to everyone else.", false);
      }
      return;
    }

    if (alertOnBooking) {
      beep("ring");
      notify(
        attention.kind === "confirmed" ? "Your patient is joining" : "Someone is booking you",
        attention.kind === "confirmed"
          ? "They have paid. Open the room now."
          : "They are paying. Be in the room when they arrive.",
        true,
      );
      alarmRef.current = window.setInterval(() => beep("ring"), 3_000);
    }
  }, [attention, alertOnView, alertOnBooking, beep, notify, stopAlarm]);

  useEffect(() => stopAlarm, [stopAlarm]);

  /* ------------------------------------------------------------ render -- */

  if (!active) return null;

  return (
    <>
      <StatusPill
        status={status}
        suspended={suspended}
        permission={permission}
        onAskPermission={askPermission}
      />

      {attention?.kind === "viewing" ? (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 lg:bottom-4 lg:justify-end lg:pr-4">
          <p className="animate-fade-rise flex items-center gap-2 rounded-full bg-navy-500/95 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">
            <Eye className="h-3.5 w-3.5 text-teal-300" aria-hidden />
            Someone is looking at your profile — you are showing as busy to others
          </p>
        </div>
      ) : null}

      {attention && attention.kind !== "viewing" ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-3 pb-3 lg:bottom-4 lg:left-auto lg:w-96 lg:pr-4">
          <div className="animate-fade-rise rounded-2xl bg-navy-500 px-4 py-3.5 text-white shadow-2xl shadow-black/40">
            <div className="flex items-start gap-2.5">
              <BellRing className="live-dot mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {attention.kind === "confirmed"
                    ? "Your patient is joining"
                    : "Someone is booking you"}
                </p>
                <p className="mt-0.5 text-xs text-white/70">
                  {attention.kind === "confirmed"
                    ? "They have paid and are on their way into the room."
                    : "They are paying now. Open the room and be there when they arrive."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMuted(true);
                  stopAlarm();
                }}
                aria-label="Silence the alarm"
                className="tap-target flex items-center justify-center text-white/50 hover:text-white"
              >
                <VolumeX className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <Link
              href={`/sessions/${attention.sessionId}/room`}
              onClick={stopAlarm}
              className="mt-3 flex h-11 items-center justify-center rounded-xl bg-teal-500 text-sm font-semibold text-white"
            >
              Open the room
            </Link>
          </div>
        </div>
      ) : null}
    </>
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
  onAskPermission,
}: {
  status: Status;
  suspended: { until: string; reason: string | null } | null;
  permission: NotificationPermission | "unsupported";
  onAskPermission: () => void;
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
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy-500/90 py-1.5 pr-2 pl-3 text-xs font-medium text-white shadow-lg backdrop-blur">
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
          Offered here rather than on a settings page, because this pill is the
          only thing on screen that is about being reachable — and a clinician
          who has just read "Live on the radar" is the one person who wants to
          be asked whether we may tell them when somebody arrives.
        */}
        {permission === "default" ? (
          <button
            type="button"
            onClick={onAskPermission}
            className="ml-1 flex items-center gap-1 rounded-full bg-teal-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-teal-400"
          >
            <Bell className="h-3 w-3" aria-hidden />
            Alert me
          </button>
        ) : permission === "denied" ? (
          <span className="ml-1 rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/60">
            notifications blocked
          </span>
        ) : null}
      </div>
    </div>
  );
}
