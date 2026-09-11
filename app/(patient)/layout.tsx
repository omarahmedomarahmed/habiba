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
 */
import { PatientChrome } from "@/components/patient/chrome";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <PatientChrome>{children}</PatientChrome>;
}
