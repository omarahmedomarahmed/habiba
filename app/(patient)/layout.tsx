/**
 * The patient shell.
 *
 * Its own route group, and deliberately sharing nothing with `(app)`. That
 * layout calls `requireUser()`, renders a clinician's sidebar and reads
 * `actor.organizationId` — every one of which is wrong for somebody who is not
 * a member of an organisation. Reusing it with conditionals would put "is this
 * a patient?" into a component whose whole job is to assume it is not.
 *
 * The bottom navigation and the globe arrive in sprint 13; this is the shell
 * they hang from.
 */
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-slate-50">{children}</div>;
}
