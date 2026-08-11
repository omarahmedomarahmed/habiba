"use client";

/**
 * The alarm.
 *
 * This is a module and not a hook because there must be exactly one of it. Two
 * React components each holding their own AudioContext means two overlapping
 * rings, two silences, and a mute button that only silences half the noise.
 *
 * It exists at all because the previous version did not work, and the way it
 * failed is worth writing down so it is not rebuilt:
 *
 *   1. It created the AudioContext on an ambient `pointerdown` listener
 *      somewhere in the portal. Whether that had happened before a patient
 *      arrived was luck, and nobody could tell which way the coin had landed.
 *   2. It called `context.resume()` without awaiting it, then immediately
 *      scheduled oscillators at `context.currentTime`. A suspended context's
 *      clock does not advance, so every note was scheduled at t≈0 — in the
 *      past by the time the context actually started. The browser dropped
 *      them. The banner appeared, the notification appeared, and the room was
 *      silent.
 *
 * Both are the same underlying mistake: treating "can we make noise" as
 * something to hope for rather than something to establish, prove, and show.
 * So the context is created inside a real user gesture, `resume()` is awaited
 * before a single note is scheduled, every note is scheduled a hair *ahead* of
 * now, and the resulting state is published so the UI can say out loud whether
 * the alarm is armed.
 */

export type AlarmState =
  /** No context yet, or it exists and is not running. Needs a gesture. */
  | "locked"
  /** Context is running. Sound will come out. */
  | "ready"
  /** We asked inside a gesture and the browser still would not play. */
  | "blocked";

export type AlarmTone = "soft" | "cancel" | "ring" | "urgent";

/**
 * Remembered across visits.
 *
 * Once a clinician has armed the alarm on this origin, Chrome and Firefox
 * grant the origin autoplay, so a later page load can bring the context up
 * without asking again. Safari will still want the gesture; the prompt comes
 * back for them and that is correct.
 */
const REMEMBER_KEY = "24t.alarm.armed";

let context: AudioContext | null = null;
let master: GainNode | null = null;
let state: AlarmState = "locked";
let loop: number | null = null;
let looping: AlarmTone | null = null;

const listeners = new Set<() => void>();

/* ------------------------------------------------------------- plumbing -- */

function constructor_() {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

function setState(next: AlarmState) {
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
}

export function alarmSnapshot(): AlarmState {
  return state;
}

/** Server render has no audio and no gesture; the client corrects it on mount. */
export function alarmServerSnapshot(): AlarmState {
  return "locked";
}

export function subscribeAlarm(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function alarmRemembered(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- arming -- */

/**
 * Turn the alarm on. **Must be called from a real user gesture.**
 *
 * `fromGesture` is not decoration. Called from a click we are entitled to a
 * definitive answer, so a context that will not start means the browser has
 * refused and the clinician needs telling — "blocked". Called speculatively on
 * page load we are not entitled to anything, so a refusal is simply "not yet"
 * and the UI keeps offering the button.
 */
/**
 * One context per tab, built once.
 *
 * Idempotent on purpose: `armAlarm` is called speculatively from several
 * places — mount, every gesture, the tab coming back to the foreground — and
 * a second AudioContext would mean a second set of oscillators and a mute
 * button that only silenced half of them.
 */
function ensureContext(): boolean {
  if (context) return true;

  const Ctor = constructor_();
  if (!Ctor) return false;

  context = new Ctor();
  master = context.createGain();
  master.gain.value = 1;
  master.connect(context.destination);

  /*
   * The browser is the authority on whether we can make a noise, so let it
   * tell us instead of us inferring it from a promise.
   *
   * This matters for the case a promise cannot cover: a context created on
   * page load, before any gesture, whose `resume()` sits pending until the
   * clinician touches something. Whenever that finally flips, the pill and the
   * console update themselves — no polling, no stale "sound off" badge sitting
   * over a perfectly working alarm.
   */
  context.addEventListener("statechange", () => {
    if (!context) return;
    if (context.state === "running") {
      setState("ready");
      remember();
    } else if (state === "ready") {
      setState("locked");
    }
  });

  /*
   * iOS unlocks on the first node that actually *sounds*, not on the
   * construction of the context. One sample of silence, played inside the
   * gesture, is the standard price of admission.
   */
  try {
    const silence = context.createBufferSource();
    silence.buffer = context.createBuffer(1, 1, context.sampleRate);
    silence.connect(master);
    silence.start(0);
  } catch {
    /* Nothing depends on this working — it only helps Safari. */
  }

  return true;
}

function remember() {
  try {
    window.localStorage.setItem(REMEMBER_KEY, "1");
  } catch {
    /* Private mode. They will be asked again next visit. */
  }
}

export async function armAlarm({ fromGesture = true } = {}): Promise<AlarmState> {
  if (!ensureContext() || !context) {
    setState("blocked");
    return state;
  }

  if (context.state !== "running") {
    /*
     * `resume()` is called again on every attempt, and that is deliberate.
     *
     * An earlier version cached the in-flight promise so that repeated
     * speculative calls could share one. That was wrong, and the app proved
     * it: Chrome leaves `resume()` pending on a context it will not start, and
     * a pending call made *before* the user interacted does not retroactively
     * become permitted when they do. Handing that stale promise back to the
     * click handler meant the one call that had a user gesture behind it never
     * reached the browser, so a clinician who reloaded the page could click
     * forever and stay silent.
     *
     * Raced against a timer so a caller is never left hanging on a promise the
     * browser has no intention of settling. The `statechange` listener above
     * catches the late transition if one comes.
     */
    await Promise.race([
      context.resume().catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, fromGesture ? 1_500 : 300)),
    ]);
  }

  const running = context.state === "running";
  setState(running ? "ready" : fromGesture ? "blocked" : "locked");
  if (running) remember();

  return state;
}

/**
 * Bring the context back without asking, for a clinician who already armed it.
 *
 * Two things suspend a running context underneath us: the tab going to the
 * background, and the OS sleeping. Neither should cost somebody their alarm,
 * and neither produces a gesture to hang a re-arm on.
 */
export async function nudgeAlarm(): Promise<AlarmState> {
  if (!context) {
    if (!alarmRemembered()) return state;
    return armAlarm({ fromGesture: false });
  }
  if (context.state === "running") {
    setState("ready");
    return state;
  }
  return armAlarm({ fromGesture: false });
}

/**
 * Arm the sound *and* ask for notifications, from one click.
 *
 * Both in the same gesture, and both started before the first `await`. This is
 * fussier than it looks: a browser considers the gesture spent once the task
 * that handled the click yields, so `await armAlarm()` followed by
 * `Notification.requestPermission()` gets the second one silently ignored in
 * Safari. Kicking both off synchronously and awaiting them afterwards is the
 * difference between one prompt and none.
 */
export async function armAlarmAndAlerts(): Promise<{
  sound: AlarmState;
  notifications: NotificationPermission | "unsupported";
}> {
  const supported = typeof Notification !== "undefined";

  const sounding = armAlarm();
  const asking =
    supported && Notification.permission === "default"
      ? Notification.requestPermission().catch(() => Notification.permission)
      : Promise.resolve(supported ? Notification.permission : null);

  const sound = await sounding;
  const granted = await asking;

  return { sound, notifications: granted ?? "unsupported" };
}

/* ----------------------------------------------------------------- sound -- */

/**
 * One warbling tone.
 *
 * The warble — the frequency flipping between two pitches twenty times a
 * second — is what makes this read as *ringing* rather than as an app making a
 * noise. A steady sine is a notification; this is a telephone.
 */
function warble(at: number, seconds: number, low: number, high: number, volume: number) {
  if (!context || !master) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";

  const half = 1 / 40; // 20 Hz alternation.
  for (let t = 0; t < seconds; t += half * 2) {
    oscillator.frequency.setValueAtTime(low, at + t);
    oscillator.frequency.setValueAtTime(high, at + Math.min(t + half, seconds));
  }

  // Ramps rather than steps, because a square-edged gain change is an audible
  // click on every note and forty of them a minute is torture.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
  gain.gain.setValueAtTime(volume, at + Math.max(seconds - 0.04, 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

  oscillator.connect(gain).connect(master);
  oscillator.start(at);
  oscillator.stop(at + seconds + 0.02);
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* Desktop, or a browser that does not do this. */
  }
}

/**
 * Four sounds, because they mean four different things.
 *
 * soft   — somebody opened your profile. A heads-up, easy to ignore.
 * ring   — they have paid. A telephone, deliberately, twice per burst.
 * urgent — they are in the room looking at an empty screen. Three rising
 *          bursts, higher and louder, and it does not sound like anything
 *          else in the product.
 * cancel — it evaporated. A falling pair, so a clinician who stood up knows
 *          to sit back down.
 */
function burst(tone: AlarmTone): number {
  if (!context || !master) return 0;

  // A hair ahead of now. Scheduling *at* `currentTime` races the audio thread
  // and loses often enough to matter.
  const at = context.currentTime + 0.02;

  switch (tone) {
    case "soft":
      warble(at, 0.13, 640, 660, 0.24);
      warble(at + 0.17, 0.13, 780, 800, 0.24);
      buzz(35);
      return 0.32;

    case "cancel":
      warble(at, 0.15, 520, 520, 0.22);
      warble(at + 0.19, 0.22, 392, 392, 0.22);
      buzz([30, 60, 30]);
      return 0.44;

    case "urgent":
      warble(at, 0.28, 900, 1320, 0.62);
      warble(at + 0.34, 0.28, 980, 1420, 0.62);
      warble(at + 0.68, 0.34, 1050, 1560, 0.66);
      buzz([180, 90, 180, 90, 260]);
      return 1.04;

    case "ring":
    default:
      warble(at, 0.42, 440, 528, 0.52);
      warble(at + 0.6, 0.42, 440, 528, 0.52);
      buzz([420, 180, 420]);
      return 1.04;
  }
}

/** A single sound. Returns false if the alarm is not armed, so callers can say so. */
export function playTone(tone: AlarmTone): boolean {
  if (state !== "ready" || !context) return false;

  /*
   * Play it *after* the resume, not instead of it.
   *
   * The context can be a beat behind us — armed a moment ago, or just back
   * from the background — and dropping the sound on the floor because of that
   * is how the confirmation ring went missing the first time this was driven
   * through the real app. Deferring is safe where scheduling early is not:
   * `burst` reads the clock when it runs, so a note deferred by 30ms is still
   * a note in the future.
   */
  if (context.state !== "running") {
    void context.resume().then(() => burst(tone));
    return true;
  }

  burst(tone);
  return true;
}

/**
 * Ring until somebody stops it.
 *
 * There is no timeout on purpose. It stops when the clinician opens the room
 * or silences it, because those are the only two events that prove a human
 * noticed. A timer proves nothing.
 */
export function startRinging(tone: "ring" | "urgent", everyMs: number): boolean {
  stopRinging();
  if (state !== "ready" || !context) return false;

  looping = tone;
  burst(tone);
  loop = window.setInterval(() => {
    /*
     * The tab in the background is exactly the clinician who needs this, and
     * it is also the tab whose AudioContext the browser has quietly suspended.
     * Nudge it every cycle rather than discovering at the end of the session
     * that the alarm stopped when they switched to their email.
     */
    if (context && context.state !== "running") {
      void context.resume().then(() => burst(tone));
      return;
    }
    burst(tone);
  }, everyMs);

  return true;
}

export function stopRinging() {
  if (loop !== null) {
    clearInterval(loop);
    loop = null;
  }
  looping = null;
  buzz(0);
}

export function isRinging() {
  return looping !== null;
}

/**
 * The audio clock, in seconds.
 *
 * Exported because it is the single number that distinguishes a working alarm
 * from the broken one this replaced. A suspended context reports zero here
 * forever, and every note scheduled against zero is a note the browser throws
 * away. `tests/alarm.test.ts` asserts it has moved.
 */
export function alarmClock(): number {
  return context?.currentTime ?? 0;
}

/* ----------------------------------------------------------------- title -- */

let titleTimer: number | null = null;
let restoreTitle = "";

/**
 * The fallback that needs no permission at all.
 *
 * Sound can be blocked and notifications can be denied, but every browser will
 * still render a tab title. A clinician working in another tab sees
 * "▶ PATIENT WAITING" flashing where "24Therapy" used to be, which is not
 * nothing — and it costs one interval.
 */
export function flashTitle(text: string) {
  if (typeof document === "undefined" || titleTimer !== null) return;
  restoreTitle = document.title;
  let on = false;
  titleTimer = window.setInterval(() => {
    on = !on;
    document.title = on ? text : restoreTitle;
  }, 900);
}

export function stopFlashingTitle() {
  if (titleTimer === null) return;
  clearInterval(titleTimer);
  titleTimer = null;
  if (typeof document !== "undefined") document.title = restoreTitle;
}
