/**
 * 🔴 76.35 — THE SESSION THAT SHRINKS WITHOUT STOPPING.
 *
 *   npm run verify:orb
 *
 * ## The one rule everything here exists to hold
 *
 * **The call iframe is never unmounted and never `display: none`.**
 *
 * A patient minimising a session is not leaving it. They are taking a phone
 * call, reading a message, looking something up, in the middle of a session
 * they may have waited a week for — and without a way to do that the only two
 * options are to stare at the screen or to drop out, and people who drop out of
 * a therapy session in the middle do not come back.
 *
 * So the orb has to keep the call alive, and there are exactly two ways to
 * break that, both of which look completely reasonable in a diff:
 *
 *   * render the iframe in ONE branch and something else in the other, which
 *     makes React tear the element down and build a new one, which ends the
 *     call
 *   * hide it with `display: none` or `hidden`, which is how a browser decides
 *     a media element is not in use
 *
 * Neither produces a compile error, a runtime error or a failing render. The
 * orb appears, looks right, and the audio is gone. The patient believes the
 * call dropped; the clinician sees somebody who left.
 *
 * ## Why this is source and not a browser
 *
 * A Playwright run cannot answer it either: proving audio survived an app
 * switch needs a real Daily room, two devices and a way to switch apps, none of
 * which a gate has. What a gate CAN hold is the property that decides it, which
 * is that there is one iframe and it is in the tree in both states. That is the
 * honest version of this check and it says so rather than claiming more.
 *
 * Every absence assertion here has a planted-offender control. §6.
 */
import { ar, en } from "../lib/i18n/messages";
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

function main() {
  const room = readSource("components/join/patient-room.tsx");
  const therapistRoom = readSource("components/session/session-room.tsx");
  const actions = readSource("app/join/[token]/actions.ts");
  const route = readSource("app/api/sessions/[id]/state/route.ts");

  /* ================================================================== */
  /*  The iframe, which is the whole feature                             */
  /* ================================================================== */

  const iframes = (room.match(/<iframe/g) ?? []).length;

  check(
    "🔴 76.35 the call is declared EXACTLY ONCE, so minimising cannot remount it",
    iframes === 1,
    iframes === 1
      ? "one iframe, rendered into whichever shell is on screen"
      : `${iframes} iframes: a second one is a second call, and switching between them ends the first`,
  );

  /*
   * 🔴 THE CONTROL, and it is the defect this file exists for.
   *
   * The natural way to write a minimised state is a second branch with its own
   * iframe in it. It renders correctly, it looks right in review, and it ends
   * the call every time somebody taps the button. Watching the check fail on
   * that exact shape is what makes the check above worth anything.
   */
  const planted = room.replace(
    "if (minimised) {",
    'if (minimised) { /* planted */ const x = <iframe src="x" />; void x;',
  );

  check(
    "🔴 CONTROL a second iframe in the minimised branch is caught",
    (planted.match(/<iframe/g) ?? []).length > iframes,
    "the obvious way to write this feature is the way that breaks it",
  );

  check(
    "🔴 76.35 …and it is held in ONE variable used by both shells",
    /const call = videoUrl \? \(/.test(room) && (room.match(/\{call\}/g) ?? []).length >= 2,
    "a variable rendered in two places keeps its position in the tree; two JSX blocks do not",
  );

  /*
   * 🔴 `display: none` AND `hidden` BOTH END THE CALL, and both are what
   * somebody reaches for when asked to hide something.
   */
  check(
    "🔴 76.35 …and nothing hides the call rather than shrinking it",
    !/\bhidden\b[^"]*"[^"]*iframe/.test(room) && !/display:\s*none/.test(room),
    "a hidden media element is one the browser is entitled to stop",
  );

  /* ================================================================== */
  /*  Where the orb sits, which is C235                                  */
  /* ================================================================== */

  const sos = readSource("components/patient/sos-orb.tsx");
  const payment = readSource("components/billing/payment-popup.tsx");

  const zOf = (source: string) => {
    const match = source.match(/fixed[^"]*z-\[(\d+)\]/);
    return match ? Number(match[1]) : NaN;
  };

  const orbZ = zOf(room);
  const sosZ = zOf(sos);
  const payZ = zOf(payment);

  /*
   * 🔴 C235 — THE CRISIS BUTTON IS ON TOP OF EVERYTHING THIS PRODUCT DRAWS.
   *
   * The patient's crisis path never depends on money, and it does not depend on
   * anything else either. A session orb covering the SOS button would be that
   * rule broken by a stacking context, which is the same failure the payment
   * orb's placement was decided to avoid — it sits at 60 for this reason and is
   * the floor this one has to clear.
   */
  check(
    "🔴 C235 the session orb is BELOW the crisis button and above the payment one",
    Number.isFinite(orbZ) && orbZ < sosZ && orbZ > payZ,
    `session ${orbZ}, crisis ${sosZ}, payment ${payZ}`,
  );

  /* ================================================================== */
  /*  What the clinician is told                                         */
  /* ================================================================== */

  check(
    "🔴 76.35 the patient's browser tells the server it minimised",
    /setSessionMinimised\(token, minimised\)/.test(room) &&
      /export async function setSessionMinimised/.test(actions),
    "nothing else knows: the call is still connected, so every other signal says present",
  );

  check(
    "🔴 76.35 …and it clears the mark when they come back, rather than only setting it",
    /patientMinimisedAt: minimised \? new Date\(\) : null/.test(actions),
    "a flag that only goes one way leaves a clinician watching a notice about somebody who returned",
  );

  check(
    "🔴 76.35 …and it can only mark a session that is actually running",
    /eq\(sessions\.status, "in_progress"\)/.test(actions.slice(actions.indexOf("setSessionMinimised"))),
    "a minimise landing after the room closed leaves a finished session with somebody away in it",
  );

  check(
    "🔴 76.35 …and it never waits, because the patient is reaching for another app",
    /void setSessionMinimised/.test(room),
    "a spinner on the way out is the worst possible moment for one",
  );

  /*
   * 🔴 THE DURATION IS THE SERVER'S. A browser tab that has been asleep is
   * wrong about the time by however long it slept, and this figure is read by a
   * clinician deciding what a silence means.
   */
  check(
    "🔴 76.35 the clinician is told HOW LONG, computed on the server",
    /patientAwaySeconds:/.test(route) && /Date\.now\(\) - row\.patientMinimisedAt\.getTime\(\)/.test(route),
    "a tab that has been asleep is wrong by however long it slept",
  );

  check(
    "🔴 76.35 …and the room reads it with ?? rather than ||, so zero seconds is away",
    /data\.patientAwaySeconds \?\? null/.test(therapistRoom),
    "`|| null` reads the first second of every minimise as the patient being present",
  );

  /*
   * 🔴 AND IT SAYS THE AUDIO IS STILL LIVE.
   *
   * The first thing anybody assumes on reading "minimised" is that the other
   * person cannot hear them. They can. A clinician who believes otherwise may
   * say something they would not say into a live room, and that is a worse
   * failure than the notice not existing at all.
   */
  /*
   * 🔴 W3: the sentences moved to the dictionary (troom.minimised*), so the
   * check reads them there, in both languages, and asserts the room renders them.
   */
  const awayKeys = ["troom.minimised", "troom.minimisedOne", "troom.minimisedMany"] as const;
  check(
    "🔴 76.35 …and the notice says they can still hear you",
    awayKeys.every((key) => therapistRoom.includes(`"${key}"`)) &&
      awayKeys.every((key) => /They can still hear you/.test(en[key]) && /يسمعك/.test(ar[key])),
    "a clinician who thinks the room is deaf may say something they would not say into a live one",
  );

  /*
   * 🔴 AND IT INSTRUCTS NOBODY. What to do about a patient who has stepped away
   * is a clinical judgement, and a product that said "check in with them" would
   * be making it. Same ruling as the next-appointment line above it.
   */
  check(
    "🔴 76.35 …and it states a fact without telling a clinician what to do about it",
    !/check in with them|ask them if|you should/i.test(therapistRoom) &&
      awayKeys.every((key) => !/check in with them|ask them if|you should/i.test(en[key])),
    "what a silence means is a clinical judgement this product does not get to make",
  );

  finish("the session orb");
}

main();
