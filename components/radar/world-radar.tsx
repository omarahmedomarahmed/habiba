"use client";

import { useMemo } from "react";

import { countryPoint, landDots } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type RadarDot = {
  id: string;
  country: string | null;
  status: "online" | "pending" | "in_session";
  label: string;
};

const STATUS_FILL: Record<RadarDot["status"], string> = {
  online: "#2EC4B6",
  pending: "#F59E0B",
  in_session: "#64748B",
};

/**
 * The radar itself.
 *
 * A coarse dot-matrix world with a sweeping beam and one dot per available
 * clinician. It is drawn entirely from data already on the page — no tiles, no
 * geo-IP, no third-party request from a public marketing page — and the
 * resolution is deliberately country-level, because where a clinician actually
 * sits is not something a patient needs or we should publish.
 *
 * `viewBox` is fixed at 1000×500 and everything inside is proportional, so the
 * whole thing scales to a phone without a resize observer.
 */
export function WorldRadar({
  dots,
  className,
  onSelect,
  selectedId,
}: {
  dots: RadarDot[];
  className?: string;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const land = useMemo(() => landDots(), []);

  // Two clinicians in the same country would sit on the same pixel. Fan them
  // out on a small ring instead of stacking them invisibly.
  const placed = useMemo(() => {
    const byCountry = new Map<string, number>();
    return dots.map((dot) => {
      const key = dot.country ?? "??";
      const index = byCountry.get(key) ?? 0;
      byCountry.set(key, index + 1);

      const base = countryPoint(dot.country);
      const angle = index * 2.399; // golden angle: no two land on top of each other
      const radius = index === 0 ? 0 : 8 + index * 2;

      return {
        ...dot,
        cx: base.x * 1000 + Math.cos(angle) * radius,
        cy: base.y * 500 + Math.sin(angle) * radius,
      };
    });
  }, [dots]);

  return (
    <svg
      viewBox="0 0 1000 500"
      role="img"
      aria-label={`${dots.length} clinicians on the radar`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="radar-sweep" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#24C8DB" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#24C8DB" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1F5EFF" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#0A2342" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1000" height="500" fill="#0A2342" />
      <rect width="1000" height="500" fill="url(#radar-glow)" />

      {/* Graticule: every 30° of longitude, every 30° of latitude. */}
      <g stroke="#24C8DB" strokeOpacity="0.08" strokeWidth="1">
        {[...Array(11)].map((_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 83.3} y1="0" x2={(i + 1) * 83.3} y2="500" />
        ))}
        {[...Array(4)].map((_, i) => (
          <line key={`h${i}`} x1="0" y1={(i + 1) * 100} x2="1000" y2={(i + 1) * 100} />
        ))}
      </g>

      {/* Land. */}
      <g fill="#24C8DB" fillOpacity="0.22">
        {land.map((dot, i) => (
          <circle key={i} cx={dot.x * 1000} cy={dot.y * 500} r="2.6" />
        ))}
      </g>

      {/* The sweep. Purely decorative, and it stops for reduced-motion users. */}
      <g className="radar-sweep" style={{ transformOrigin: "500px 250px" }}>
        <path d="M500 250 L500 -60 A310 310 0 0 1 780 90 Z" fill="url(#radar-sweep)" />
      </g>

      {placed.map((dot) => {
        const selected = selectedId === dot.id;
        return (
          <g
            key={dot.id}
            transform={`translate(${dot.cx} ${dot.cy})`}
            onClick={onSelect ? () => onSelect(dot.id) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <title>{dot.label}</title>
            {dot.status === "online" ? (
              <circle r="14" fill={STATUS_FILL.online} fillOpacity="0.18" className="radar-ping" />
            ) : null}
            <circle
              r={selected ? 9 : 6.5}
              fill={STATUS_FILL[dot.status]}
              stroke="#0A2342"
              strokeWidth="2"
            />
          </g>
        );
      })}
    </svg>
  );
}
