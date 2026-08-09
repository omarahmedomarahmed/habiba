"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, VolumeX } from "lucide-react";

import { radarPing } from "@/app/(app)/on-call/actions";

/** Slow enough not to be chatty, fast enough that the alarm is not late. */
const PING_MS = 8_000;

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
export function RadarPresence({ initialStatus }: { initialStatus: string }) {
  const [active, setActive] = useState(initialStatus !== "offline");
  const [booking, setBooking] = useState<{ sessionId: string; paid: boolean } | null>(null);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const alarmRef = useRef<number | null>(null);
  const announcedRef = useRef<string | null>(null);

  useEffect(() => setActive(initialStatus !== "offline"), [initialStatus]);

  /*
   * Browsers refuse to make noise until the user has interacted with the page,
   * and a suspended AudioContext fails silently — which for an alarm is the
   * worst possible failure. So it is built on the first pointer event anywhere
   * in the portal, long before anyone books.
   */
  useEffect(() => {
    if (!active || audioRef.current) return;

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
  }, [active]);

  const beep = useCallback(() => {
    const context = audioRef.current;
    if (!context || muted) return;
    void context.resume();

    const now = context.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.22, 1174],
      [0.44, 880],
    ] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.19);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.2);
    }
  }, [muted]);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current !== null) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
  }, []);

  // One request does the heartbeat and the booking check together. Splitting
  // them would allow a state where we keep advertising someone while failing to
  // tell them anybody is knocking.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const result = await radarPing();
        if (!cancelled) setBooking(result.booking);
      } catch {
        // The next ping is eight seconds away, and the sweep takes them offline
        // if the tab is genuinely gone.
      }
    };

    void tick();
    const timer = setInterval(tick, PING_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  // Ring until acknowledged. A single beep is missable and someone is waiting.
  useEffect(() => {
    if (!booking) {
      announcedRef.current = null;
      stopAlarm();
      return;
    }
    if (announcedRef.current === booking.sessionId) return;

    announcedRef.current = booking.sessionId;
    beep();
    stopAlarm();
    alarmRef.current = window.setInterval(beep, 3_000);
  }, [booking, beep, stopAlarm]);

  useEffect(() => stopAlarm, [stopAlarm]);

  if (!booking) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-3 pb-3 lg:bottom-4 lg:left-auto lg:w-96 lg:pr-4">
      <div className="animate-fade-rise rounded-2xl bg-navy-500 px-4 py-3.5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start gap-2.5">
          <BellRing className="live-dot mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {booking.paid ? "Your patient is joining" : "Someone is booking you"}
            </p>
            <p className="mt-0.5 text-xs text-white/70">
              {booking.paid
                ? "They have paid and are on their way into the room."
                : "They are paying now. Open the room and be there when they arrive."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMuted(true)}
            aria-label="Silence the alarm"
            className="tap-target flex items-center justify-center text-white/50 hover:text-white"
          >
            <VolumeX className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <Link
          href={`/sessions/${booking.sessionId}/room`}
          onClick={stopAlarm}
          className="mt-3 flex h-11 items-center justify-center rounded-xl bg-teal-500 text-sm font-semibold text-white"
        >
          Open the room
        </Link>
      </div>
    </div>
  );
}
