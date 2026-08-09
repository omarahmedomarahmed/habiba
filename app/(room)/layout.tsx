/**
 * The live room gets its own route group so it can be genuinely full-bleed —
 * no sidebar, no bottom navigation, no page padding. Navigating away mid-session
 * is a way to lose a recording, so the chrome that makes that easy is removed
 * rather than hidden.
 */
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-navy-600">{children}</div>;
}
