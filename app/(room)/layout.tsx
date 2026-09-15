import { LanguageCorner } from "@/components/i18n/language-corner";

/**
 * The live room gets its own route group so it can be genuinely full-bleed —
 * no sidebar, no bottom navigation, no page padding. Navigating away mid-session
 * is a way to lose a recording, so the chrome that makes that easy is removed
 * rather than hidden.
 *
 * 🔴 75.3 — AND THE LANGUAGE SWITCH IS THE ONE PIECE OF CHROME THAT STAYS.
 *
 * Everything else was taken out because pressing it loses a recording. This one
 * navigates nowhere: it sets a cookie and re-renders the words. A patient who
 * realises halfway through a session that they would rather read Arabic should
 * not have to leave the room to get it, and the room is the single screen in
 * this product where leaving costs the most.
 */
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-navy-600">
      <LanguageCorner />
      {children}
    </div>
  );
}
