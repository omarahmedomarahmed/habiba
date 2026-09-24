/**
 * Which crisis number to print, and when to print none. PLAN.md 21R.8, C98.
 *
 * ## 🔴 The defect this exists to fix
 *
 * `988` was hardcoded into the risk banner, the patient's support notice, the
 * radar console and the booking sheet. It is the United States lifeline. This
 * product's first market is Egypt, and `tel:988` dialled from Cairo reaches
 * nothing — so a person in crisis got a button that looks like help, presses
 * like help, and does nothing. The interface dictionary already says this in
 * as many words about `urgent.footer` ("988 means nothing in Abu Dhabi") and
 * then five components printed it anyway.
 *
 * ## Why the table has one entry
 *
 * Because one is what we actually know. Egypt's ambulance is 123 and its
 * police 122, and I am not putting a number a person in crisis will dial into
 * a product on the strength of a recollection — a **wrong** crisis number is
 * worse than none, in the same way and for the same reason that the wrong
 * country's number is. Where there is no verified line the copy says "your
 * local emergency number", which is always true and always actionable.
 *
 * ## 🔴 0088 — THE WARNING THIS FILE WROTE ABOUT ITSELF IS NOW BUILT
 *
 * It used to end: *"incomplete until the lines are configured. Each country the
 * platform opens in needs its crisis line entered and checked by a person, it
 * belongs in `country_settings` beside the payment rail, and adding it there is
 * the fix rather than growing this list from memory."*
 *
 * That was written in sprint 21R and nothing acted on it, so the table still
 * had one entry — the United States — while the first market was Egypt.
 *
 * `country_settings.crisis_line_tel` is now that column, entered by an operator
 * with a phone in their hand and stamped with their name and the date. The
 * table below stays as the **fallback**, not as the source: a configured line
 * wins, an unconfigured country falls back to a verified entry here, and a
 * country in neither renders the sentence that is true everywhere.
 *
 * 🔴 The seed writes NOTHING into those columns, including for the United
 * States. A number recalled by whoever wrote a migration is the exact thing the
 * paragraph above forbids, and stating 988 in two places is how two places come
 * to disagree.
 */

import { DIALLING_CODES } from "@/lib/phone/e164";

export type CrisisLine = {
  /** What the reader sees. A number, as they would say it. */
  label: string;
  /** What `tel:` dials. Digits only. */
  tel: string;
  /**
   * 🔴 C350 — WHAT TO PRESS ONCE IT ANSWERS.
   *
   * Egypt's line is one number for the whole ministry. Dial it and a menu
   * answers; the mental health service is two choices in. A person in the
   * minute this file exists for does not explore a phone menu, so a correct
   * number with no route through it fails in the same way a wrong number does,
   * only more slowly.
   *
   * Both languages, because the first choice on that menu IS the language and a
   * reader who needs the Arabic branch is the reader least likely to be handed
   * English instructions. Stored beside the number rather than in the interface
   * dictionary on purpose: this is a fact about one country's phone system that
   * whoever verified the number verified at the same time, and splitting the two
   * across two files is how a number gets updated and its menu does not.
   *
   * Absent for a line that answers directly. Never guessed.
   */
  steps?: { en: string; ar: string };
  /**
   * 🔴 W1-09 — WHEN SOMEBODY ANSWERS, where a source says so.
   *
   * `"always"` for an emergency number. Days (0 is Sunday) and hours in the
   * line's own time zone for a line that closes. Absent means unknown, and
   * unknown is never shown as open or closed. Never guessed.
   */
  hours?: "always" | { timeZone: string; days: number[]; from: number; to: number };
  /** What the number is, for a line that is not a crisis line: "Ambulance". */
  name?: { en: string; ar: string };
};

/**
 * Verified lines, by ISO country.
 *
 * Adding to this is a decision somebody makes with a phone in their hand, not
 * a translation task.
 *
 * 🔴 C350 — EGYPT HAS A NUMBER NOW, AND WHO SAID SO IS PART OF THE ENTRY.
 *
 * Every paragraph above this asked for one thing before Egypt could be listed:
 * a person who has actually dialled it, rather than a recollection turned into
 * a `tel:` href. On 2026-09-14 the product's owner gave it directly — the
 * Ministry of Health and Population line, 105, the only one of the published
 * Egyptian numbers that answers, and the two menu choices that reach the mental
 * health service from it.
 *
 * That is the standard this table was waiting for and it is written down here
 * so the next reader knows the entry has a source. It is still correctable from
 * `/admin/settings`, which stamps the operator's name and the date over the top
 * of it: a configured line wins over this table, and this table wins over
 * silence.
 *
 * The seed stays null for Egypt, as it does for the United States, and for the
 * reason `lib/settings/defs.ts` gives in as many words: stating a number in two
 * places is how two places come to disagree.
 */
export const CRISIS_LINES: Record<string, CrisisLine> = {
  US: { label: "988", tel: "988" },
  EG: {
    label: "105",
    tel: "105",
    steps: {
      en: "Press 1 for Arabic, then 1 for mental health.",
      ar: "اضغط ١ للعربية، ثم ١ للصحة النفسية.",
    },
    /*
     * 🔴 W1-09 — 105 IS NOT A 24 HOUR LINE. Ahram Online gives Monday to
     * Thursday, 9am to 5pm (takeover/design/RESEARCH-2.md section 1). So it is
     * never offered alone: `EMERGENCY_LINES` below always sits beside it, and
     * leads outside these hours.
     */
    hours: { timeZone: "Africa/Cairo", days: [1, 2, 3, 4], from: 9, to: 17 },
  },
};

/**
 * 🔴 W1-09 — the numbers that always answer, per country, from the same source
 * (RESEARCH-2 section 1: U.S. Embassy Egypt, and 112 since 2022). Shown beside
 * the crisis line, never instead of it, and first whenever that line is likely
 * closed. A country with none here still gets "your local emergency number".
 */
export const EMERGENCY_LINES: Record<string, CrisisLine[]> = {
  EG: [
    { label: "123", tel: "123", hours: "always", name: { en: "Ambulance", ar: "الإسعاف" } },
    { label: "112", tel: "112", hours: "always", name: { en: "Emergency", ar: "الطوارئ" } },
  ],
};

/** Whether a line is likely answering at `now`: null when nobody has told us its hours. */
export function lineOpenAt(line: CrisisLine, now: Date = new Date()): boolean | null {
  if (!line.hours) return null;
  if (line.hours === "always") return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: line.hours.timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((part) => part.type === "weekday")?.value ?? "",
  );
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return line.hours.days.includes(weekday) && hour >= line.hours.from && hour < line.hours.to;
}

/**
 * The line for a country, or null when we do not know one.
 *
 * Null is not a failure — it is the honest state for a country nobody has
 * configured, and the components render "call your local emergency number" for
 * it, which is what somebody should do anyway.
 *
 * 🔴 PURE, AND THAT IS WHY THE CONFIGURED LINE COMES IN AS AN ARGUMENT.
 *
 * The obvious build reads `country_settings` in here. It cannot: this function
 * is called from the SOS orb, which is a client component, and from
 * `lib/crisis/alerts.ts`, and a crisis affordance that needs a database round
 * trip to know what to print is a crisis affordance that renders nothing while
 * the query is in flight. So the caller passes what it already loaded, and
 * `configured` wins when it is there.
 */
/**
 * 🔴 WHICH COUNTRY'S LINE TO PRINT FOR SOMEBODY WE HAVE NO NUMBER FOR.
 *
 * A guest has no account and therefore no phone, and until this sprint that
 * meant the SOS orb printed no number at all on the join page, the payment
 * screen, the public profile and the radar. Egypt's 105 was in the table the
 * whole time; nothing asked for it.
 *
 * Two signals, in this order, and no default:
 *
 *   1. The practice's own REGION, which is a fact somebody typed on
 *      `/admin/clinics` with paperwork in hand.
 *   2. The language they are reading, which is weaker but is not nothing:
 *      Arabic is served in exactly one market.
 *
 * Returning null is still a real answer, and the orb renders "call your local
 * emergency number" for it. The wrong country's number is worse than none: it
 * looks like help and reaches nothing.
 */
export function crisisCountryFor(input: {
  region?: string | null;
  locale?: string | null;
}): string | null {
  const region = input.region?.trim().toLowerCase();
  if (region === "eg") return "EG";
  if (region === "us") return "US";

  const locale = input.locale?.trim().toLowerCase();
  if (locale?.startsWith("ar")) return "EG";

  return null;
}

export function crisisLine(
  country?: string | null,
  configured?: { label: string | null; tel: string | null } | null,
): CrisisLine | null {
  const built = country ? (CRISIS_LINES[country.trim().toUpperCase()] ?? null) : null;

  if (configured?.label && configured.tel) {
    /*
     * 🔴 AND THE MENU STEPS SURVIVE, WHICH THEY DID NOT.
     *
     * This returned `{ label, tel }` and dropped `steps`, so the moment an
     * operator typed Egypt's line into `country_settings` the product stopped
     * telling an Egyptian caller to **press 1 for Arabic, then 1 for mental
     * health**.
     *
     * 105 answers with a menu in a language the caller may not read. A number
     * with no menu instruction beside it is not a working crisis line, it is a
     * slower failure, and the failure arrives at the worst moment there is.
     *
     * The steps are carried only when the configured number IS the one we have
     * verified steps for. An operator who configures a different line has a
     * menu we know nothing about, and inventing one would be worse than silence.
     */
    const sameNumber = built?.tel === configured.tel;
    return {
      label: configured.label,
      tel: configured.tel,
      ...(sameNumber && built?.steps ? { steps: built.steps } : {}),
      /* W1-09 — and its hours, on the same rule: known for that number only. */
      ...(sameNumber && built?.hours ? { hours: built.hours } : {}),
    };
  }

  return built;
}

/**
 * 🔴 Which enabled countries still have nobody's verified number.
 *
 * Read by the admin country screen, so the gap is a list somebody is looking at
 * rather than a paragraph in this file that went unread for four sprints. An
 * enabled country is one we take money in and let clinicians work in; a person
 * in crisis there currently gets a sentence rather than a number.
 */
export function countriesMissingACrisisLine(
  countries: { code: string; name: string; enabled: boolean; crisisLineTel: string | null }[],
): { code: string; name: string }[] {
  return countries
    .filter((row) => row.enabled)
    .filter((row) => !row.crisisLineTel && !CRISIS_LINES[row.code.trim().toUpperCase()])
    .map((row) => ({ code: row.code, name: row.name }));
}

/**
 * 🔴 The line for a person we know only by their number. 37R.25, C184.
 *
 * The walkthrough found the orb printing `988 · United States` to a patient
 * whose number begins `+20`, because it rendered **every** entry in the table
 * rather than the one for the reader — `crisisLine`, written for exactly this,
 * was never called by it. One entry in the table is what made the bug
 * invisible: the list and the correct answer looked identical from Delaware
 * and only differed in Cairo, which is the market.
 *
 * Matching is longest-prefix over the dialling codes, and a tie is resolved
 * only when the tied countries leave exactly one verified line between them:
 * `+1` is the United States and Canada, and there is one line for the pair.
 * Anything else returns null, and null means the sentence that is true
 * everywhere.
 */
export function lineForNumber(e164: string | null | undefined): CrisisLine | null {
  const digits = (e164 ?? "").replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  const national = digits.slice(1);

  let best = 0;
  let candidates: string[] = [];
  for (const [country, code] of Object.entries(DIALLING_CODES)) {
    if (!national.startsWith(code)) continue;
    if (code.length > best) {
      best = code.length;
      candidates = [country];
    } else if (code.length === best) {
      candidates.push(country);
    }
  }

  const lines = candidates
    .map((country) => CRISIS_LINES[country])
    .filter((line): line is CrisisLine => Boolean(line));
  const distinct = new Set(lines.map((line) => line.tel));

  return distinct.size === 1 ? lines[0]! : null;
}

/** The country label for a number, when there is a line to label. */
export function countryForNumber(e164: string | null | undefined): string | null {
  const line = lineForNumber(e164);
  if (!line) return null;
  return Object.keys(CRISIS_LINES).find((country) => CRISIS_LINES[country]!.tel === line.tel) ?? null;
}
