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
import { optionalPatient } from "@/lib/patient-auth/guard";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const actor = await optionalPatient();

  return (
    <PatientChrome nav={actor !== null} phone={actor?.phone ?? null}>
      {children}
    </PatientChrome>
  );
}
