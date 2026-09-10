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
import { SosOrb } from "@/components/patient/sos-orb";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="pb-24">{children}</div>
      <PatientBottomNav />
      {/*
        🔴 25.5 / C125 — on every patient screen, including a live session.
        
        In the layout rather than on each page, because "every screen" is the
        requirement and a page that forgets to include it is a page somebody
        reaches on the night they need it. It is a client component with the
        numbers compiled in: no fetch, no session, no account, and it works
        when our API does not.
      */}
      <SosOrb />
    </div>
  );
}
