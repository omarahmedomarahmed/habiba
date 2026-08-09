"use client";

import { useMemo } from "react";
import { MapPin, X } from "lucide-react";

import type { RadarEntry } from "@/components/radar/types";
import { countryFlag, countryName, languageFlag } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type RadarFilter = {
  language: string;
  specialty: string;
  /** ISO alpha-2. Usually set by tapping the globe. */
  country: string;
  /** Only meaningful with a country set. */
  region: string;
};

export const NO_FILTER: RadarFilter = { language: "", specialty: "", country: "", region: "" };

/** One place where "does this clinician match" is decided. */
export function matches(entry: RadarEntry, filter: RadarFilter): boolean {
  if (filter.language && !entry.languages.includes(filter.language)) return false;
  if (filter.specialty && !entry.specialties.includes(filter.specialty)) return false;
  if (filter.country && entry.country !== filter.country) return false;
  if (filter.region && entry.region !== filter.region) return false;
  return true;
}

/**
 * The filter bar.
 *
 * Every option is derived from who is actually on the radar right now, never
 * from the master list. Offering "Cantonese" when nobody online speaks it is a
 * menu of dead ends, and each chip carries the number of people behind it so
 * the dead ends are visible before they are tapped.
 *
 * Counts are computed against the *other* filters, not the final result — so
 * "Arabic 3" next to an active Trauma filter means three Arabic-speaking trauma
 * clinicians, which is the question the person is actually asking.
 */
export function RadarFilters({
  entries,
  value,
  onChange,
  tone = "light",
}: {
  entries: RadarEntry[];
  value: RadarFilter;
  onChange: (next: RadarFilter) => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";

  const languages = useMemo(
    () => tally(entries, value, "language", (e) => e.languages),
    [entries, value],
  );
  const specialties = useMemo(
    () => tally(entries, value, "specialty", (e) => e.specialties),
    [entries, value],
  );
  const regions = useMemo(() => {
    if (!value.country) return [];
    return tally(entries, value, "region", (e) =>
      e.country === value.country && e.region ? [e.region] : [],
    );
  }, [entries, value]);

  const active = Boolean(value.language || value.specialty || value.country || value.region);
  if (languages.length === 0 && specialties.length === 0 && !active) return null;

  const set = (patch: Partial<RadarFilter>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2.5">
      {/* Where. The globe sets this; the chip is how you get back out of it. */}
      {value.country ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => set({ country: "", region: "" })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              dark ? "bg-teal-400/20 text-teal-100" : "bg-teal-100 text-teal-800",
            )}
          >
            <span aria-hidden>{countryFlag(value.country)}</span>
            {countryName(value.country) ?? value.country}
            <X className="h-3 w-3" aria-hidden />
          </button>

          {regions.length > 1
            ? regions.map((region) => (
                <Chip
                  key={region.value}
                  dark={dark}
                  active={value.region === region.value}
                  count={region.count}
                  onClick={() =>
                    set({ region: value.region === region.value ? "" : region.value })
                  }
                >
                  <MapPin className="h-2.5 w-2.5" aria-hidden />
                  {region.value}
                </Chip>
              ))
            : null}
        </div>
      ) : null}

      {/* Language, by flag. The flag is an anchor, never the only signal — the
          name is always beside it, because Windows renders letters not flags. */}
      {languages.length > 1 ? (
        <Scroller label="Language">
          {languages.map((language) => (
            <Chip
              key={language.value}
              dark={dark}
              active={value.language === language.value}
              count={language.count}
              onClick={() =>
                set({ language: value.language === language.value ? "" : language.value })
              }
            >
              <span aria-hidden>{languageFlag(language.value)}</span>
              {language.value}
            </Chip>
          ))}
        </Scroller>
      ) : null}

      {specialties.length > 1 ? (
        <Scroller label="Works with">
          {specialties.map((specialty) => (
            <Chip
              key={specialty.value}
              dark={dark}
              active={value.specialty === specialty.value}
              count={specialty.count}
              onClick={() =>
                set({ specialty: value.specialty === specialty.value ? "" : specialty.value })
              }
            >
              {specialty.value}
            </Chip>
          ))}
        </Scroller>
      ) : null}

      {active ? (
        <button
          type="button"
          onClick={() => onChange(NO_FILTER)}
          className={cn(
            "text-xs font-semibold",
            dark ? "text-teal-300" : "text-brand-600",
          )}
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );
}

/**
 * Count how many clinicians each option would leave, ignoring that option's own
 * current selection.
 *
 * Ignoring it matters: with "Arabic" selected, the Arabic chip should still say
 * how many Arabic speakers there are rather than recomputing to the same number
 * for every language, and the other language chips should say what switching to
 * them would give you.
 */
function tally(
  entries: RadarEntry[],
  filter: RadarFilter,
  dimension: keyof RadarFilter,
  values: (entry: RadarEntry) => string[],
): { value: string; count: number }[] {
  const others: RadarFilter = { ...filter, [dimension]: "" };
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!matches(entry, others)) continue;
    for (const value of values(entry)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function Scroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      {/* Scrolls on a phone, wraps once there is room. A chip cut in half at
          the edge of a wide screen reads as a rendering bug rather than as an
          invitation to scroll. */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-x-visible">
        {children}
      </div>
    </div>
  );
}

function Chip({
  children,
  count,
  active,
  dark,
  onClick,
}: {
  children: React.ReactNode;
  count: number;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? dark
            ? "border-teal-400 bg-teal-400/20 text-teal-100"
            : "border-teal-500 bg-teal-50 text-teal-800"
          : dark
            ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
          active
            ? dark
              ? "bg-teal-400/30 text-teal-50"
              : "bg-teal-200 text-teal-900"
            : dark
              ? "bg-white/10 text-white/50"
              : "bg-slate-100 text-slate-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}
