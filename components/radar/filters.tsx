"use client";

import { useMemo } from "react";

import type { RadarEntry } from "@/components/radar/types";
import { cn } from "@/lib/utils";

/**
 * Language and specialty filters.
 *
 * Options are derived from who is actually on the radar, never from the master
 * allowlist. Offering "Cantonese" when nobody online speaks it is a menu of
 * dead ends, and this is not an audience with patience for dead ends.
 */
export function RadarFilters({
  entries,
  language,
  specialty,
  onLanguage,
  onSpecialty,
  tone = "light",
}: {
  entries: RadarEntry[];
  language: string;
  specialty: string;
  onLanguage: (value: string) => void;
  onSpecialty: (value: string) => void;
  tone?: "light" | "dark";
}) {
  const languages = useMemo(
    () => [...new Set(entries.flatMap((entry) => entry.languages))].sort(),
    [entries],
  );
  const specialties = useMemo(
    () => [...new Set(entries.flatMap((entry) => entry.specialties))].sort(),
    [entries],
  );

  if (languages.length === 0 && specialties.length === 0) return null;

  const active = Boolean(language || specialty);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={language}
        onChange={onLanguage}
        options={languages}
        allLabel="Any language"
        tone={tone}
      />
      <Select
        value={specialty}
        onChange={onSpecialty}
        options={specialties}
        allLabel="Anything"
        tone={tone}
      />
      {active ? (
        <button
          type="button"
          onClick={() => {
            onLanguage("");
            onSpecialty("");
          }}
          className={cn(
            "tap-target px-1 text-xs font-semibold",
            tone === "dark" ? "text-teal-300" : "text-brand-600",
          )}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  allLabel,
  tone,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
  tone: "light" | "dark";
}) {
  if (options.length === 0) return null;

  return (
    <select
      aria-label={allLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 min-w-0 flex-1 rounded-xl border px-2.5 text-sm focus:outline-none",
        tone === "dark"
          ? value
            ? "border-teal-400/60 bg-teal-400/15 font-medium text-teal-100"
            : "border-white/15 bg-white/5 text-white/80"
          : value
            ? "border-brand-500 bg-white font-medium text-brand-700"
            : "border-slate-200 bg-white text-slate-700",
      )}
    >
      <option value="" className="text-slate-900">
        {allLabel}
      </option>
      {options.map((option) => (
        <option key={option} value={option} className="text-slate-900">
          {option}
        </option>
      ))}
    </select>
  );
}
