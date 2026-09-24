import { LanguageSwitch } from "@/components/i18n/language-switch";

/**
 * 🔴 75.3 — THE SWITCH, IN THE SAME CORNER OF EVERY SIGNED-IN SCREEN.
 *
 * ## Why this exists rather than one `<LanguageSwitch />` per page
 *
 * The switch lived on the public site and the join page, and nowhere else. So
 * a patient who signed in could not change language again: they could pick
 * Arabic on the way in and were then stuck with whatever they chose, on the
 * payment screen, in the room, on their own record.
 *
 * Most people here read English by choice and some read only Arabic, and the
 * two are **not** a property of the account. They are a property of the
 * afternoon: the same person reads an invoice in English and a consent form in
 * Arabic. So the answer is not a better default, it is a switch that is always
 * within reach and always in the same place.
 *
 * ## 🔴 English is the default and Arabic is a choice
 *
 * `DEFAULT_LOCALE` is `en`, which is what somebody with no cookie gets. That is
 * deliberate for this market rather than an oversight: an Egyptian professional
 * audience overwhelmingly expects an English product interface, and a page that
 * decides on their behalf from a browser header is a page that guesses. The
 * switch is how they say otherwise, and the cookie remembers it everywhere.
 *
 * ## Fixed, not sticky, and out of the way of the content
 *
 * Bottom of the screen on a phone and top on a desk would be two behaviours to
 * learn. It sits in the top corner, flips to the other side under `dir="rtl"`
 * on its own because it is positioned with `end` rather than `right`, and it
 * carries the safe-area inset so it clears a notch.
 */
export function LanguageCorner({ beside = null }: { beside?: React.ReactNode } = {}) {
  return (
    <div
      className="pointer-events-none fixed top-0 end-0 z-50 flex items-center gap-2 p-2"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
    >
      {/* W2-P09: the patient's notice bell shares the corner rather than covering a Back link. */}
      {beside ? <div className="pointer-events-auto">{beside}</div> : null}
      <div className="pointer-events-auto rounded-full bg-white/90 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        <LanguageSwitch />
      </div>
    </div>
  );
}
