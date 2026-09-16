/**
 * The patient shell.
 *
 * Its own route group, and deliberately sharing nothing with `(app)`. That
 * layout calls `requireUser()`, renders a clinician's sidebar and reads
 * `actor.organizationId` — every one of which is wrong for somebody who is not
 * a member of an organisation. Reusing it with conditionals would put "is this
 * a patient?" into a component whose whole job is to assume it is not.
 *
 * The chrome itself lives in `components/patient/chrome.tsx` rather than here,
 * because two screens a patient must never fall out of are not in this route
 * group: the radar and the live session (25.2).
 *
 * ## 🔴 Why the layout asks who is reading. 37R.25, C184, C185
 *
 * Two things the chrome cannot decide on its own, and until the second
 * walkthrough it was deciding both wrongly for everybody signed out:
 *
 *   1. **The navigation bar.** `PatientChrome` has always taken `nav`, and its
 *      own comment says a visitor who is not signed in gets the orb and no
 *      navigation "because every destination in the bar would bounce them to a
 *      login screen". Nothing passed it, so the default won and a person
 *      opening an invite link from WhatsApp got four tabs, all of which threw
 *      them at a sign-in page.
 *   2. **The crisis line.** The orb prints the line for the reader's own
 *      dialling code, which means it needs the reader's number.
 *
 * Both come from the same answer, so the layout asks once. `optionalPatient()`
 * reads the session cookie and returns null rather than redirecting, which is
 * what a layout wrapping both signed-in and signed-out pages needs.
 */
import { PatientChrome } from "@/components/patient/chrome";
import { SessionStarted } from "@/components/patient/session-started";
import { liveSessionForPatient } from "@/lib/data/patient-view";
import { optionalPatient } from "@/lib/patient-auth/guard";
import { LanguageCorner } from "@/components/i18n/language-corner";

/*
 * 🔴 76.17 — asked on every patient page, which is the point.
 *
 * A clinician presses Start and the patient may be anywhere in this app: on
 * their homework, on the radar, on their bill. The alert that leaves the
 * building reaches a phone that may be face down; this is the half that is
 * already in front of them, so it lives in the shell rather than on the
 * sessions page they happen not to be looking at.
 *
 * The cost is one indexed read per patient page render, and it is paid rather
 * than cached: a banner that is thirty seconds stale is a banner that invites
 * somebody into a room that has closed.
 */
export const dynamic = "force-dynamic";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const actor = await optionalPatient();

  /*
   * Only for somebody signed in, and only because there is nothing to ask
   * otherwise: a live session belongs to a person, and a visitor is not one
   * yet. A guest with a join link already arrives holding the door.
   */
  const live = actor?.personId ? await liveSessionForPatient(actor.personId) : null;

  return (
    <PatientChrome nav={actor !== null} phone={actor?.phone ?? null}>
      {/* 🔴 75.3 — the language switch, in the same corner of every screen. */}
      <LanguageCorner />
      {live ? <SessionStarted href={live.href} therapistName={live.therapistName} /> : null}
      {children}
    </PatientChrome>
  );
}
