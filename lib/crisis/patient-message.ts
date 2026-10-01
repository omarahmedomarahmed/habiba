import { EMERGENCY_LINES, SUPPORT_LINES, crisisLine, lineOpenAt } from "@/lib/crisis/line";
import { ar, en, type MessageKey } from "@/lib/i18n/messages";

/**
 * What a patient is told after writing something that raised the crisis path.
 *
 * Pure, and kept apart from `alerts.ts` (which needs the database) so the
 * branches are tested as arithmetic. `alerts.ts` re-exports it.
 *
 * ## 🔴 F2 / F5: TRUTHFUL, AND IN THEIR LANGUAGE
 *
 * This said "Your therapist has been notified and is here with you" to every
 * patient, in English, including somebody who wrote in Arabic and somebody with
 * no clinician at all, for whom nothing had been sent to anybody. It now says
 * the therapist was told only when the caller says a notification to a
 * clinician was actually created, and otherwise says plainly that nobody has
 * been told yet, then the numbers. "Is here with you" is gone: a check-in
 * reply arrives with nobody in the room.
 *
 * What a patient on a join link is allowed to see stays the same: no level, no
 * indicators, no clinical detail, only support and a number to call. That shape
 * is asserted by a test so it cannot quietly grow a `level` field.
 */
export function patientFacingCrisisMessage(
  country?: string | null,
  /*
   * 🔴 0088: the operator's own entry for this country, when the caller has it.
   *
   * Passed rather than read, because this function is pure and is called from
   * paths with no database in hand. A configured line wins; without one the
   * verified fallback table answers; without that the sentence that is true
   * everywhere.
   */
  configured?: { label: string | null; tel: string | null } | null,
  now: Date = new Date(),
  options: {
    /** True only when a notification to a clinician was actually created or sent. */
    notified?: boolean;
    /** The patient's language. Arabic for `ar*`, English otherwise. */
    locale?: string | null;
  } = {},
): {
  message: string;
  helpline: string | null;
} {
  const words = options.locale?.trim().toLowerCase().startsWith("ar") ? ar : en;
  const say = (key: MessageKey, values: Record<string, string> = {}) =>
    words[key].replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);

  const lead = say(options.notified === true ? "crisis.reply.notified" : "crisis.reply.notNotified");
  const code = (country ?? "").trim().toUpperCase();
  const support = SUPPORT_LINES[code] ?? [];
  const tail = support.length > 0 ? ` ${say("crisis.reply.support", { lines: support.map((l) => l.label).join(", ") })}` : "";

  /*
   * 🔴 21R.8 / C98: the number depends on where they are, and is null when we
   * do not know a verified one. Where there is no verified line the message
   * names the local emergency number, which is true from any phone anywhere.
   */
  const line = crisisLine(country, configured);
  if (!line) {
    return { message: `${lead} ${say("crisis.reply.callLocal")}${tail}`, helpline: null };
  }

  /*
   * 🔴 W1-29: "at any time" only for a line that answers at any time. Egypt's
   * 105 keeps office hours (RESEARCH-2 section 1), so a line that may be closed
   * is named with an always-open emergency number, and the open one comes first.
   */
  if (line.hours === "always") {
    return { message: `${lead} ${say("crisis.reply.anyTime", { line: line.label })}${tail}`, helpline: line.label };
  }
  const always = (EMERGENCY_LINES[code] ?? [])[0] ?? null;
  if (!always) {
    return {
      message: `${lead} ${say("crisis.reply.lineOrLocal", { line: line.label })}${tail}`,
      helpline: line.label,
    };
  }
  const open = lineOpenAt(line, now);
  return {
    message:
      open === true
        ? `${lead} ${say("crisis.reply.openNow", { line: line.label, always: always.label })}${tail}`
        : `${lead} ${say("crisis.reply.closed", { line: line.label, always: always.label })}${tail}`,
    helpline: open === true ? line.label : always.label,
  };
}
