"use client";

import dynamicImport from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, PanelLeftClose, PanelRightClose, Radio } from "lucide-react";

import { BookingSheet } from "@/components/radar/booking-sheet";
import { matches, NO_FILTER, RadarFilters, type RadarFilter } from "@/components/radar/filters";
import { RadarList } from "@/components/radar/radar-list";
import { TherapistCard } from "@/components/radar/therapist-card";
import type { RadarEntry } from "@/components/radar/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

/**
 * The radar, as a room rather than a page.
 *
 * The board used to be a column: a globe in a card, filters under it, a list
 * under those, all inside a 4xl measure with a white page around it. That reads
 * as an article about availability. This reads as availability — the globe is
 * the floor, the panels sit on top of it, and nothing scrolls away from the one
 * thing the page is for.
 *
 * ## What is on each side, and why
 *
 * Left is *narrowing*: languages, then what someone needs help with. Those are
 * the two questions that rule a clinician out, and they are asked in that order
 * because language rules out hardest.
 *
 * Right is *choosing*: the clinicians who survived the narrowing, with the
 * booking sheet one tap away.
 *
 * The globe is the third filter and it is spatial. Tapping a country sets the
 * same filter the chips set, so all three controls write to one object and the
 * list is always the truth about all of them at once.
 *
 * ## Collapsed still says something
 *
 * A collapsed panel keeps its headline — how many filters are active, how many
 * clinicians are showing — because the reason to collapse it is to see more
 * globe, not to stop knowing. A panel that collapses to a bare chevron makes
 * you open it to find out whether you needed to.
 */
const Globe = dynamicImport(() => import("@/components/radar/globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-teal-400/50" aria-hidden />
    </div>
  ),
});

/** Availability changes in seconds. Four is the difference between free and busy. */
const REFRESH_MS = 4_000;

export function RadarConsole({ initial }: { initial: RadarEntry[] }) {
  const t = useT();
  const [entries, setEntries] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RadarFilter>(NO_FILTER);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer] = useState(() => viewerId());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"filters" | "list">("list");
  const [sheetOpen, setSheetOpen] = useState(true);
  /*
   * 🔴 65.6 — WHICH QUESTION THE FLOOR IS ANSWERING.
   *
   * *The map answers "who is near me" and the list answers "who is there", and most
   * people are asking the second question.* The globe stays the default because it is
   * the product's front door and it is what the marketing site shows, but the second
   * question now has a control rather than a scroll.
   */
  const [view, setView] = useState<"map" | "list">("map");

  useEffect(() => setEntries(initial), [initial]);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      setRefreshing(true);
      try {
        const response = await fetch(`/api/radar?v=${encodeURIComponent(viewer)}`, {
          cache: "no-store",
        });
        if (response.ok) setEntries((await response.json()).therapists as RadarEntry[]);
      } catch {
        // A failed refresh leaves the last good list on screen.
      } finally {
        setRefreshing(false);
      }
    };
    const timer = setInterval(tick, REFRESH_MS);
    return () => clearInterval(timer);
  }, [viewer]);

  const visible = useMemo(
    () => entries.filter((entry) => matches(entry, filter)),
    [entries, filter],
  );

  // Always the unfiltered count. "Nobody available" while four people are
  // online and you have merely picked a narrow filter is a lie that sends
  // somebody away.
  const onlineCount = entries.filter((entry) => entry.status === "online").length;
  const selected = entries.find((entry) => entry.userId === selectedId) ?? null;
  const activeFilters = [filter.language, filter.specialty, filter.country].filter(Boolean).length;

  const filterSummary =
    activeFilters === 0
      ? t("radar.everyoneOnShift")
      : activeFilters === 1
        ? t("radar.oneFilterOn")
        : t("radar.filtersOn", { count: activeFilters });

  const filterContent = (
    <RadarFilters entries={entries} value={filter} onChange={setFilter} tone="dark" />
  );

  const listContent =
    visible.length === 0 ? (
      <div className="rounded-2xl bg-white/5 p-4 text-center">
        <p className="text-sm font-semibold text-white">{t("radar.nobodyMatchingTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/85">
          {onlineCount === 1
            ? t("radar.othersAvailableOne")
            : t("radar.othersAvailableMany", { count: onlineCount })}
        </p>
        <button
          type="button"
          onClick={() => setFilter(NO_FILTER)}
          className="mt-3 text-xs font-semibold text-teal-300 hover:text-teal-200"
        >
          {t("radar.showEveryone")}
        </button>
      </div>
    ) : (
      <ul className="space-y-2">
        {visible.map((entry) => (
          <li key={entry.userId} className="min-w-0">
            <TherapistCard entry={entry} tone="dark" onSelect={() => setSelectedId(entry.userId)} />
          </li>
        ))}
      </ul>
    );

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] min-h-[560px] w-full overflow-hidden bg-[#04101f]">
      {/*
        The floor. The globe, or the list that answers the other question.

        Swapped rather than stacked: a list under a globe is a scroll, and a person who
        came to compare six clinicians on price and next availability should not have to
        drag a planet out of the way first.
      */}
      <div className="absolute inset-0">
        {view === "map" ? (
          <Globe
            entries={visible}
            selected={filter.country || null}
            onSelect={(code) => setFilter((f) => ({ ...f, country: code ?? "", region: "" }))}
            onPick={(entry) => setSelectedId(entry.userId)}
            className="h-full w-full"
          />
        ) : (
          <div className="h-full overflow-y-auto px-3 pt-16 pb-[56dvh] sm:px-4 sm:pb-6 sm:ps-[20.5rem]">
            {visible.length === 0 ? (
              <div className="mx-auto max-w-md rounded-2xl bg-white/5 p-4 text-center">
                <p className="text-sm font-semibold text-white">
                  {t("radar.nobodyMatchingTitle")}
                </p>
                <button
                  type="button"
                  onClick={() => setFilter(NO_FILTER)}
                  className="mt-3 text-xs font-semibold text-teal-300 hover:text-teal-200"
                >
                  {t("radar.showEveryone")}
                </button>
              </div>
            ) : (
              <RadarList entries={visible} onSelect={(entry) => setSelectedId(entry.userId)} />
            )}
          </div>
        )}
      </div>

      {/* Vignette: keeps panel text legible over whatever the globe is doing. */}
      {view === "map" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(4,16,31,0.82)_100%)]"
        />
      ) : null}

      {/* ------------------------------------------------------------ status */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#04101f]/80 px-3 py-1.5 backdrop-blur">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              onlineCount > 0 ? "live-dot bg-teal-400" : "bg-slate-500",
            )}
          />
          <span className="text-sm font-semibold text-white tabular-nums">
            {onlineCount > 0 ? onlineCount : t("radar.noOne")}
          </span>
          <span className="text-sm text-white/85">
            {onlineCount === 1
              ? t("radar.oneOnShift")
              : onlineCount > 0
                ? t("radar.manyOnShift")
                : t("radar.onShift")}
          </span>
          {refreshing ? (
            <Loader2 className="h-3 w-3 animate-spin text-white/30" aria-hidden />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {view === "map" ? (
            <p className="pointer-events-none hidden rounded-full bg-[#04101f]/70 px-3 py-1.5 text-xs text-white/85 backdrop-blur lg:block">
              {t("radar.dragToSpin")}
            </p>
          ) : null}

          {/*
            🔴 65.6 — TWO VIEWS, BOTH LABELLED, NEITHER HIDDEN.

            A segmented control rather than an icon that toggles: the reader can see that
            a list exists before they have tried the button, which is the whole reason
            this ticket is not "make the panel taller".
          */}
          <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-[#04101f]/80 p-1 backdrop-blur">
            {(["map", "list"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  view === option ? "bg-white/15 text-white" : "text-white/85 hover:text-white/85",
                )}
              >
                {option === "map" ? t("radar.mapView") : t("radar.listView")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- desktop panels */}
      <div className="hidden sm:contents">
        <Panel
          side="left"
          open={leftOpen}
          onToggle={() => setLeftOpen((v) => !v)}
          title={t("radar.narrowDown")}
          summary={filterSummary}
        >
          {filterContent}
        </Panel>

        {/*
          The right panel is the globe's legend, so it goes when the globe does.

          In list view it would be the same people twice, in a narrower column, with
          less about each of them.
        */}
        {view === "map" ? (
          <Panel
            side="right"
            open={rightOpen}
            onToggle={() => setRightOpen((v) => !v)}
            title={t("radar.whoIsFree")}
            summary={t("radar.countShowing", { count: visible.length })}
          >
            {listContent}
          </Panel>
        ) : null}
      </div>

      {/* ---------------------------------------------------- mobile sheet */}
      {/*
        One sheet with two tabs, not two stacked panels.

        A phone has room for a globe or a column, not both, and two floating
        panels on a 375px screen simply landed on top of each other. Tabs keep
        the same two jobs — narrowing and choosing — without pretending there
        is space to do them side by side.
      */}
      <section className="absolute inset-x-0 bottom-0 z-10 flex max-h-[52dvh] flex-col rounded-t-2xl border-t border-white/10 bg-[#071a2e]/95 backdrop-blur-md sm:hidden">
        <div className="flex shrink-0 items-center gap-1 border-b border-white/10 p-2">
          {/*
            In list view the floor already IS the list, so the sheet offers narrowing
            only. Two copies of the same people on a 375px screen is the thing the
            mobile sheet was built to stop.
          */}
          {(view === "list" ? (["filters"] as const) : (["list", "filters"] as const)).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => (sheetOpen && mobileTab === tab ? setSheetOpen(false) : (setMobileTab(tab), setSheetOpen(true)))}
              aria-pressed={sheetOpen && mobileTab === tab}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                sheetOpen && mobileTab === tab
                  ? "bg-white/10 text-white"
                  : "text-white/85 hover:text-white/85",
              )}
            >
              {tab === "list" ? t("radar.countFree", { count: visible.length }) : filterSummary}
            </button>
          ))}
          <span className="flex h-9 w-9 items-center justify-center text-white/85">
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", sheetOpen && "rotate-180")}
              aria-hidden
            />
          </span>
        </div>
        {sheetOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {mobileTab === "list" && view === "map" ? listContent : filterContent}
          </div>
        ) : null}
      </section>

      {selected ? <BookingSheet entry={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

/**
 * A floating panel that keeps its headline when shut.
 *
 * On a phone the two panels stack along the bottom instead of hugging the
 * edges, because a 375px screen has no room for a globe with a column either
 * side — and the globe is the reason to be here.
 */
function Panel({
  side,
  open,
  onToggle,
  title,
  summary,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  onToggle: () => void;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const Icon = side === "left" ? PanelLeftClose : PanelRightClose;
  return (
    <section
      className={cn(
        "absolute z-10 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071a2e]/85 backdrop-blur-md",
        side === "left"
          ? "top-16 bottom-3 left-4 w-[19rem]"
          : "top-16 bottom-3 right-4 w-[24rem]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-white/5"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold tracking-wider text-teal-300 uppercase">
            {title}
          </span>
          <span className="block truncate text-sm text-white/85">{summary}</span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/85">
          {open ? (
            <Icon className="hidden h-4 w-4 sm:block" aria-hidden />
          ) : (
            <ChevronDown className="hidden h-4 w-4 rotate-180 sm:block" aria-hidden />
          )}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform sm:hidden", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      ) : null}
    </section>
  );
}

/** Kept out of the panel so the emergency line is never inside a collapsed box. */
export function RadarSafetyLine() {
  const t = useT();

  return (
    <p className="flex items-center justify-center gap-2 bg-[#04101f] px-4 py-2.5 text-center text-xs text-white/85">
      <Radio className="h-3 w-3 shrink-0" aria-hidden />
      {t("crisis.notEmergency")}
    </p>
  );
}
