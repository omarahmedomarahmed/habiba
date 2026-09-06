/**
 * The patient shell.
 *
 * Its own route group, and deliberately sharing nothing with `(app)`. That
 * layout calls `requireUser()`, renders a clinician's sidebar and reads
 * `actor.organizationId` — every one of which is wrong for somebody who is not
 * a member of an organisation. Reusing it with conditionals would put "is this
 * a patient?" into a component whose whole job is to assume it is not.
 *
 * The bottom navigation and its centred globe arrive here in sprint 15.1. The
 * padding under `children` is the height of the bar plus the safe area — a
 * fixed bar with no matching padding hides the last item of every list, which
 * on this app is somebody's most recent session.
 */
import { PatientBottomNav } from "@/components/patient/bottom-nav";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="pb-24">{children}</div>
      <PatientBottomNav />
    </div>
  );
}
