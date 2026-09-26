"use client";

import type { GlobeEntry } from "@/components/radar/types";
import { countryFlag, countryName } from "@/lib/geo";
import { useLocale, useT } from "@/lib/i18n/client";
import { CITY_LABELS } from "@/lib/radar-places";
import { cn } from "@/lib/utils";

/**
 * What the globe is pointing at: a country (hovered, or the one zoomed into),
 * or one clinician's dot.
 *
 * Kept out of `globe.tsx` so a host can draw the box in its own layout, under
 * its own chips, without importing the globe's chunk on the server pass.
 */
export type GlobeHover =
  | { kind: "country"; code: string; live: number; online: number; offline: number; zoomed: boolean }
  | { kind: "therapist"; entry: GlobeEntry; city: string | null };

/**
 * The box at the globe's top-left.
 *
 * With nothing pointed at it is the legend, because a hollow dot next to a
 * bright one means nothing until somebody says which is which.
 */
export function GlobeInfo({
  info,
  legend = true,
  className,
}: {
  info: GlobeHover | null;
  /** Show the bright/hollow legend when nothing is pointed at. */
  legend?: boolean;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();

  if (!info && !legend) return null;

  return (
    <div
      className={cn(
        "pointer-events-none w-max max-w-[16rem] rounded-xl border border-white/10 bg-[#04101f]/85 px-3 py-2 text-start backdrop-blur",
        className,
      )}
      aria-live="polite"
    >
      {!info ? (
        <div className="flex flex-col gap-1 text-[11px] text-white/85">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden />
            {t("radar.freeNow")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-slate-400" aria-hidden />
            {t("radar.legendOffline")}
          </span>
          <span className="text-white/70">{t("radar.tapMarker")}</span>
        </div>
      ) : info.kind === "country" ? (
        <>
          <p className="text-sm font-semibold text-white">
            <span aria-hidden>{countryFlag(info.code)}</span>{" "}
            {countryName(info.code, locale) ?? info.code}
          </p>
          <p className="text-[11px] text-teal-300">
            {info.online > 0 ? t("radar.onlineNow", { count: info.online }) : t("radar.nobodyHere")}
          </p>
          {info.offline > 0 ? (
            <p className="text-[11px] text-white/85">
              {info.offline} · {t("radar.legendOffline")}
            </p>
          ) : null}
          {info.live + info.offline > 0 ? (
            <p className="mt-0.5 text-[11px] text-white/70">
              {info.zoomed ? t("radar.tapDot") : t("radar.tapToZoom")}
            </p>
          ) : null}
        </>
      ) : (
        <TherapistLine entry={info.entry} city={info.city} />
      )}
    </div>
  );
}

function TherapistLine({ entry, city }: { entry: GlobeEntry; city: string | null }) {
  const t = useT();
  const locale = useLocale();
  const label = city ? CITY_LABELS[city]?.[locale === "ar" ? "ar" : "en"] : null;
  const where = [entry.city, label && label !== entry.city ? label : null].filter(Boolean).join(", ");
  const status =
    entry.status === "offline"
      ? t("radar.legendOffline")
      : entry.status === "online"
        ? t("radar.available")
        : entry.status === "pending"
          ? t("radar.beingBooked")
          : t("radar.inSession");

  return (
    <>
      <p className="truncate text-sm font-semibold text-white">
        {[entry.firstName, entry.lastName].filter(Boolean).join(" ")}
      </p>
      {entry.credentials ? <p className="truncate text-[11px] text-white/85">{entry.credentials}</p> : null}
      {where ? <p className="truncate text-[11px] text-white/85">{where}</p> : null}
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold",
          entry.status === "online" ? "text-teal-300" : "text-white/85",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            entry.status === "offline"
              ? "border border-slate-400"
              : entry.status === "online"
                ? "bg-teal-400"
                : entry.status === "pending"
                  ? "bg-amber-400"
                  : "bg-slate-400",
          )}
          aria-hidden
        />
        {status}
      </p>
      {entry.languages.length > 0 ? (
        <p className="truncate text-[11px] text-white/70">{entry.languages.join(", ")}</p>
      ) : null}
    </>
  );
}
