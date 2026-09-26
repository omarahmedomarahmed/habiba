"use client";

import { useMemo, useRef } from "react";
import { Globe2, MapPin, X } from "lucide-react";

import type { GlobeEntry } from "@/components/radar/types";
import { countryFlag, countryName, languageFlag } from "@/lib/geo";
import { placeOf } from "@/lib/radar-places";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/i18n/client";

export type RadarFilter = {
  /** Any of these. Empty is everyone. */
  languages: string[];
  /** Any of these. Empty is everyone. */
  specialties: string[];
  /** ISO alpha-2. Set by the globe's markers and the country chips. */
  country: string;
  /** Only meaningful with a country set. */
  region: string;
  /** 🔴 Ruling 5c: only clinicians who see people at a confirmed practice address. */
  inPerson?: boolean;
};

export const NO_FILTER: RadarFilter = { languages: [], specialties: [], country: "", region: "", inPerson: false };

type Matchable = Pick<GlobeEntry, "languages" | "specialties" | "country" | "region" | "city" | "practice">;

/**
 * The country a clinician is counted in: the one they gave, or Egypt when they
 * gave none, because that is where the globe draws them (`lib/radar-places.ts`).
 * The chip and the marker must agree, or a chip says eleven and the map says ten.
 */
export function countryOf(entry: Matchable): string {
  return entry.country?.toUpperCase() || placeOf(entry).country;
}

/**
 * One place where "does this clinician match" is decided.
 *
 * Any of the chosen languages AND any of the chosen specialties: somebody who
 * picks Arabic and French wants a clinician who speaks either, and somebody who
 * also picks Anxiety wants that clinician to work with it.
 */
export function matches(entry: Matchable, filter: RadarFilter): boolean {
  if (filter.languages.length > 0 && !filter.languages.some((l) => entry.languages.includes(l))) return false;
  if (filter.specialties.length > 0 && !filter.specialties.some((s) => entry.specialties.includes(s))) return false;
  if (filter.country && countryOf(entry) !== filter.country) return false;
  if (filter.region && entry.region !== filter.region) return false;
  if (filter.inPerson && !entry.practice) return false;
  return true;
}

/** How many filters are on, for a summary line. */
export function activeCount(filter: RadarFilter): number {
  return (
    filter.languages.length +
    filter.specialties.length +
    (filter.country ? 1 : 0) +
    (filter.region ? 1 : 0) +
    (filter.inPerson ? 1 : 0)
  );
}

/**
 * The chips above the globe.
 *
 * Persistent: they are always there, on every radar (the public page, the
 * homepage hero and the patient app), because the questions they answer are the
 * first two a person has: does this clinician speak my language, and do they
 * work with what I am here about. Every option comes from the clinicians on the
 * map right now, live and offline, never from the master list: "Cantonese" when
 * nobody speaks it is a menu of dead ends.
 *
 * Multi-select within a row. Each chip carries the number of people it would
 * show, counted against the OTHER rows, so "Arabic 9" beside an active Anxiety
 * chip means nine Arabic-speaking clinicians who work with anxiety.
 *
 * Two rows that scroll sideways on a phone: where and language, then what
 * somebody needs help with. A vertical wheel scrolls them sideways on a desktop.
 */
export function RadarChips({
  entries,
  value,
  onChange,
  className,
}: {
  /** Everybody on the map: live and offline. */
  entries: Matchable[];
  value: RadarFilter;
  onChange: (next: RadarFilter) => void;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();

  const countries = useMemo(
    () => tally(entries, value, { country: "" }, (e) => [countryOf(e)]),
    [entries, value],
  );
  const languages = useMemo(
    () => tally(entries, value, { languages: [] }, (e) => e.languages),
    [entries, value],
  );
  const specialties = useMemo(
    () => tally(entries, value, { specialties: [] }, (e) => e.specialties),
    [entries, value],
  );
  const inPersonCount = entries.filter((e) => e.practice && matches(e, { ...value, inPerson: false })).length;

  const set = (patch: Partial<RadarFilter>) => onChange({ ...value, ...patch });
  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const active = activeCount(value) > 0;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} role="group" aria-label={t("radar.chipsLabel")}>
      <Row label={t("radar.language")}>
        <Chip active={!value.country} onClick={() => set({ country: "", region: "" })}>
          <Globe2 className="h-3 w-3" aria-hidden />
          {t("radar.world")}
        </Chip>
        {countries.map((country) => (
          <Chip
            key={country.value}
            active={value.country === country.value}
            count={country.count}
            onClick={() =>
              set({ country: value.country === country.value ? "" : country.value, region: "" })
            }
          >
            <span aria-hidden>{countryFlag(country.value)}</span>
            {countryName(country.value, locale) ?? country.value}
          </Chip>
        ))}
        <Divider />
        {languages.map((language) => (
          <Chip
            key={language.value}
            active={value.languages.includes(language.value)}
            count={language.count}
            onClick={() => set({ languages: toggle(value.languages, language.value) })}
          >
            <span aria-hidden>{languageFlag(language.value)}</span>
            {language.value}
          </Chip>
        ))}
      </Row>

      <Row label={t("radar.worksWith")}>
        {specialties.map((specialty) => (
          <Chip
            key={specialty.value}
            active={value.specialties.includes(specialty.value)}
            count={specialty.count}
            onClick={() => set({ specialties: toggle(value.specialties, specialty.value) })}
          >
            {specialty.value}
          </Chip>
        ))}
        {/* 🔴 Ruling 5c: someone who wants to sit in a room with their therapist. */}
        {inPersonCount > 0 || value.inPerson ? (
          <Chip active={Boolean(value.inPerson)} count={inPersonCount} onClick={() => set({ inPerson: !value.inPerson })}>
            <MapPin className="h-3 w-3" aria-hidden />
            {t("radar.inPerson")}
          </Chip>
        ) : null}
        {active ? (
          <button
            type="button"
            onClick={() => onChange(NO_FILTER)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-teal-300 hover:text-teal-200"
          >
            <X className="h-3 w-3" aria-hidden />
            {t("radar.clearFilters")}
          </button>
        ) : null}
      </Row>
    </div>
  );
}

/**
 * Count how many clinicians each option would leave, ignoring that row's own
 * selection, so every chip in a row says what choosing it would add.
 */
function tally(
  entries: Matchable[],
  filter: RadarFilter,
  clear: Partial<RadarFilter>,
  values: (entry: Matchable) => string[],
): { value: string; count: number }[] {
  const others: RadarFilter = { ...filter, ...clear };
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!matches(entry, others)) continue;
    for (const value of new Set(values(entry))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  /* A chosen option with nobody left behind it stays visible, or it could never be switched off. */
  const chosen = [
    ...(clear.languages ? filter.languages : []),
    ...(clear.specialties ? filter.specialties : []),
    ...("country" in clear && filter.country ? [filter.country] : []),
  ];
  for (const value of chosen) if (!counts.has(value)) counts.set(value, 0);

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    /*
     * `min-w-0` is what makes the horizontal scroll actually work: a flex item
     * defaults to `min-width: auto`, refuses to shrink below its content, and
     * pushes the whole page wider than a phone instead of scrolling.
     */
    <div
      ref={ref}
      aria-label={label}
      role="group"
      onWheel={(event) => {
        const node = ref.current;
        if (!node || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        if (node.scrollWidth <= node.clientWidth) return;
        node.scrollLeft += event.deltaY;
      }}
      className="no-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto px-0.5 py-0.5 [mask-image:linear-gradient(to_right,black_92%,transparent)] rtl:[mask-image:linear-gradient(to_left,black_92%,transparent)]"
    >
      {children}
      <span className="w-6 shrink-0" aria-hidden />
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-white/15" aria-hidden />;
}

function Chip({
  children,
  count,
  active,
  onClick,
}: {
  children: React.ReactNode;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap backdrop-blur transition-colors",
        active
          ? "border-teal-400 bg-teal-400/20 text-teal-100"
          : "border-white/15 bg-[#04101f]/75 text-white/90 hover:bg-white/10",
      )}
    >
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
            active
              ? "bg-teal-400/30 text-teal-50"
              : "bg-white/10 text-white/85",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
