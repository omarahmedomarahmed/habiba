import { countryLabel, flagOf, type SosEntry } from "@/lib/crisis/sos";

/**
 * 🔴 F5: THE SOS NUMBERS AS PLAIN HTML, for a reader with no JavaScript.
 *
 * The orb's sheet is a client component: it opens with a state change, so with
 * scripts off, blocked by a data saver, or not yet loaded on a slow phone, it
 * does nothing. This is the same list as server-rendered `tel:` links, with no
 * hooks, no state and no event handler, rendered by `app/sos/page.tsx`.
 *
 * Pure on purpose: the words come in as props, so a test renders it to a
 * string and asserts every number is a `tel:` link.
 */
export type SosListWords = {
  helpLine: string;
  anyTime: string;
  openNow: string;
  closedNow: string;
  checkHours: string;
};

export function SosList({
  entries,
  locale,
  words,
}: {
  entries: SosEntry[];
  locale: string;
  words: SosListWords;
}) {
  const arabic = locale === "ar";
  return (
    <ul className="grid gap-3">
      {entries.map((entry) => (
        <li key={`${entry.country}-${entry.line.tel}`}>
          <a
            href={`tel:${entry.line.tel}`}
            className="flex flex-col gap-1 rounded-2xl bg-red-600 px-4 py-3 text-white no-underline"
          >
            <span className="text-sm font-semibold">
              <span aria-hidden>{flagOf(entry.country)} </span>
              {entry.line.name ? (arabic ? entry.line.name.ar : entry.line.name.en) : words.helpLine}
              {" · "}
              {countryLabel(entry.country, locale) ?? entry.countryName ?? entry.country}
            </span>
            <span className="text-2xl font-bold tracking-wide" dir="ltr">
              {entry.line.label}
            </span>
            {/* Due diligence: hours nobody has confirmed are never invented; the reader is told to check them. */}
            <span className="text-xs font-semibold">
              {entry.open === null
                ? words.checkHours
                : entry.line.hours === "always"
                  ? words.anyTime
                  : entry.open
                    ? words.openNow
                    : words.closedNow}
            </span>
            {entry.line.steps ? (
              <span className="text-xs opacity-90">{arabic ? entry.line.steps.ar : entry.line.steps.en}</span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
