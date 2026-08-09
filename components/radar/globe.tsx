"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RadarEntry } from "@/components/radar/types";
import {
  ease,
  project,
  ringPath,
  shortestTurn,
  spread,
  visible,
  zoomForBounds,
  type Viewpoint,
} from "@/lib/globe";
import raw from "@/lib/world-110m.json";
import { countryFlag } from "@/lib/geo";
import { cn } from "@/lib/utils";

type Country = { n: string; c: [number, number]; b: [number, number, number, number]; p: number[][] };
const WORLD = raw as unknown as Record<string, Country>;

const SIZE = 640;
const CX = SIZE / 2;
const CY = SIZE / 2;
const BASE_RADIUS = 268;
/** Degrees per second when nobody is touching it. */
const DRIFT = 3.2;

/**
 * The globe.
 *
 * Drawn as SVG paths from Natural Earth's 110m outlines, projected
 * orthographically on every frame. No map library and no tile server: nothing
 * is fetched while a person in crisis waits, nothing phones a third party to
 * tell them who is looking at a therapy site, and the whole thing is one 40 kB
 * chunk that only loads on this page.
 *
 * The animation loop writes `d` and `cx`/`cy` straight onto the DOM nodes
 * rather than going through React. Re-rendering 170 paths and every dot sixty
 * times a second is exactly the kind of thing that turns a nice globe into a
 * stuttering one on the phone somebody is actually holding.
 */
export function Globe({
  entries,
  selected,
  onSelect,
  onPick,
  className,
}: {
  entries: RadarEntry[];
  /** ISO alpha-2 of the country being filtered on, if any. */
  selected: string | null;
  onSelect: (code: string | null) => void;
  onPick: (entry: RadarEntry) => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const view = useRef<Viewpoint>({ lon: 10, lat: 18, radius: BASE_RADIUS, cx: CX, cy: CY });
  const paths = useRef(new Map<string, SVGPathElement>());
  const dots = useRef(new Map<string, SVGGElement>());
  const graticule = useRef<SVGPathElement>(null);

  const [hover, setHover] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /*
   * Callbacks behind refs.
   *
   * The pointer listeners are attached once and must never be torn down and
   * rebuilt mid-drag, which is what a dependency on a parent's inline arrow
   * function would cause on every render.
   */
  const handlers = useRef({ onSelect, onPick, selected });
  handlers.current = { onSelect, onPick, selected };

  /* ------------------------------------------------------------ placing -- */

  /**
   * Where each clinician's dot goes.
   *
   * A confirmed practice pin when there is one, the country centroid otherwise,
   * and a deterministic spiral offset so four people in one city are four dots.
   * Anyone with no country at all is simply not on the globe — a dot in the
   * Atlantic is a claim about where someone is, and we do not have one.
   */
  const placed = useMemo(() => {
    const byCountry = new Map<string, RadarEntry[]>();
    for (const entry of entries) {
      if (!entry.country) continue;
      const list = byCountry.get(entry.country);
      if (list) list.push(entry);
      else byCountry.set(entry.country, [entry]);
    }

    const out: { entry: RadarEntry; lon: number; lat: number }[] = [];
    for (const [code, list] of byCountry) {
      const centre = WORLD[code]?.c;
      list.forEach((entry, index) => {
        const lat = entry.practice?.lat ? Number(entry.practice.lat) : centre?.[1];
        const lon = entry.practice?.lon ? Number(entry.practice.lon) : centre?.[0];
        if (typeof lat !== "number" || typeof lon !== "number" || Number.isNaN(lat)) return;

        // A confirmed pin is a real address; do not nudge it off the building.
        const offset = entry.practice?.lat ? { dLon: 0, dLat: 0 } : spread(index, list.length);
        out.push({ entry, lon: lon + offset.dLon, lat: lat + offset.dLat });
      });
    }
    return out;
  }, [entries]);

  /** Countries with at least one clinician — the only ones worth lighting up. */
  const populated = useMemo(
    () => new Set(entries.map((entry) => entry.country).filter(Boolean) as string[]),
    [entries],
  );

  const placedRef = useRef(placed);
  placedRef.current = placed;

  const codes = useMemo(() => Object.keys(WORLD), []);

  /* ------------------------------------------------------------ drawing -- */

  const draw = useCallback(() => {
    const current = view.current;

    for (const code of codes) {
      const node = paths.current.get(code);
      if (!node) continue;
      const country = WORLD[code]!;
      node.setAttribute("d", country.p.map((ring) => ringPath(ring, current)).join(" "));
    }

    if (graticule.current) graticule.current.setAttribute("d", graticulePath(current));

    for (const { entry, lon, lat } of placed) {
      const node = dots.current.get(entry.userId);
      if (!node) continue;
      const point = visible(lon, lat, current) ? project(lon, lat, current) : null;
      if (!point) {
        node.style.display = "none";
        continue;
      }
      node.style.display = "";
      node.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    }
  }, [codes, placed]);

  /* ------------------------------------------------- drift and animation -- */

  const animation = useRef<number | null>(null);
  const dragging = useRef(false);
  const idleSince = useRef(Date.now());

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      /*
       * A slow drift when nobody has touched it for a while, and never while a
       * country is selected — spinning away from the thing someone just asked
       * to look at is the most annoying possible behaviour.
       */
      if (!reduced && !dragging.current && !selected && Date.now() - idleSince.current > 2500) {
        view.current.lon -= DRIFT * dt;
      }

      draw();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    setReady(true);
    return () => cancelAnimationFrame(frame);
  }, [draw, selected]);

  /** Fly to a country, or back out to the whole world. */
  const flyTo = useCallback(
    (code: string | null) => {
      const target = code ? WORLD[code] : null;
      const from = { ...view.current };
      const to = target
        ? {
            lon: shortestTurn(from.lon, target.c[0]),
            lat: Math.max(-70, Math.min(70, target.c[1])),
            radius: BASE_RADIUS * zoomForBounds(target.b),
          }
        : { lon: shortestTurn(from.lon, 10), lat: 18, radius: BASE_RADIUS };

      if (animation.current) cancelAnimationFrame(animation.current);
      const start = performance.now();
      const duration = 620;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const k = ease(t);
        view.current.lon = from.lon + (to.lon - from.lon) * k;
        view.current.lat = from.lat + (to.lat - from.lat) * k;
        view.current.radius = from.radius + (to.radius - from.radius) * k;
        if (t < 1) animation.current = requestAnimationFrame(step);
      };
      animation.current = requestAnimationFrame(step);
      idleSince.current = Date.now();
    },
    [],
  );

  useEffect(() => {
    flyTo(selected);
  }, [selected, flyTo]);

  /* -------------------------------------------------------- interaction -- */

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    let pointer: number | null = null;

    const scale = () => SIZE / (svg.getBoundingClientRect().width || SIZE);

    const down = (event: PointerEvent) => {
      if (pointer !== null) return;
      pointer = event.pointerId;
      dragging.current = true;
      moved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      svg.setPointerCapture(event.pointerId);
    };

    const move = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      const k = scale();
      const dx = (event.clientX - lastX) * k;
      const dy = (event.clientY - lastY) * k;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);

      // Degrees per pixel falls as you zoom in, so dragging feels like moving
      // the surface rather than the camera.
      const perPixel = 180 / (Math.PI * view.current.radius);
      view.current.lon -= dx * perPixel * 1.4;
      view.current.lat = Math.max(-80, Math.min(80, view.current.lat + dy * perPixel * 1.4));
      idleSince.current = Date.now();
    };

    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      pointer = null;
      dragging.current = false;
      idleSince.current = Date.now();
      svg.releasePointerCapture?.(event.pointerId);

      /*
       * Taps are resolved here rather than with an `onClick` on each path.
       *
       * Pointer capture — which the drag needs, or the globe stops turning the
       * moment the cursor leaves it — redirects every subsequent event to the
       * SVG, so the browser fires `click` on the SVG and never on the country
       * underneath. The paths had handlers and none of them ever ran. Hit-test
       * the point ourselves instead, and only when the pointer barely moved,
       * so the end of a spin is not also a selection.
       */
      if (moved > 6) return;

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const dot = target?.closest("[data-therapist]")?.getAttribute("data-therapist");
      if (dot) {
        const entry = placedRef.current.find((p) => p.entry.userId === dot);
        if (entry) handlers.current.onPick(entry.entry);
        return;
      }

      const code = target?.closest("[data-country]")?.getAttribute("data-country");
      if (code) handlers.current.onSelect(code === handlers.current.selected ? null : code);
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const next = view.current.radius * (event.deltaY > 0 ? 0.92 : 1.08);
      view.current.radius = Math.max(BASE_RADIUS, Math.min(BASE_RADIUS * 6, next));
      idleSince.current = Date.now();
    };

    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("wheel", wheel, { passive: false });

    return () => {
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
      svg.removeEventListener("wheel", wheel);
    };
  }, []);

  const hovered = hover ? WORLD[hover] : null;
  const hoveredCount = hover ? entries.filter((e) => e.country === hover).length : 0;

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label="A globe showing where therapists are online right now"
      >
        <defs>
          <radialGradient id="globe-ocean" cx="34%" cy="28%" r="82%">
            <stop offset="0%" stopColor="#123a63" />
            <stop offset="55%" stopColor="#0A2342" />
            <stop offset="100%" stopColor="#04101f" />
          </radialGradient>
          <radialGradient id="globe-halo" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="#24C8DB" stopOpacity="0" />
            <stop offset="92%" stopColor="#24C8DB" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#24C8DB" stopOpacity="0" />
          </radialGradient>
          <clipPath id="globe-clip">
            <circle cx={CX} cy={CY} r={BASE_RADIUS} />
          </clipPath>
          <filter id="globe-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Atmosphere. Outside the clip so it can bleed past the limb. */}
        <circle cx={CX} cy={CY} r={BASE_RADIUS + 26} fill="url(#globe-halo)" />
        <circle cx={CX} cy={CY} r={BASE_RADIUS} fill="url(#globe-ocean)" />

        <g clipPath="url(#globe-clip)">
          <path
            ref={graticule}
            fill="none"
            stroke="#24C8DB"
            strokeOpacity="0.12"
            strokeWidth="0.7"
          />

          {codes.map((code) => {
            const has = populated.has(code);
            const isSelected = selected === code;
            const isHover = hover === code;
            return (
              <path
                key={code}
                ref={(node) => {
                  if (node) paths.current.set(code, node);
                  else paths.current.delete(code);
                }}
                data-country={code}
                onPointerEnter={() => setHover(code)}
                onPointerLeave={() => setHover((h) => (h === code ? null : h))}
                className={cn(
                  "transition-[fill,stroke] duration-200",
                  has ? "cursor-pointer" : "cursor-grab",
                )}
                fill={
                  isSelected
                    ? "#2EC4B6"
                    : isHover
                      ? has
                        ? "#1c6f8c"
                        : "#1b3a5c"
                      : has
                        ? "#17547a"
                        : "#14304e"
                }
                fillOpacity={isSelected ? 0.85 : 1}
                stroke={isSelected || isHover ? "#5eead4" : "#0A2342"}
                strokeWidth={isSelected || isHover ? 1.2 : 0.6}
                strokeLinejoin="round"
              />
            );
          })}

          {/* Dots last so they are never behind a country outline. */}
          {placed.map(({ entry }) => (
            <g
              key={entry.userId}
              ref={(node) => {
                if (node) dots.current.set(entry.userId, node);
                else dots.current.delete(entry.userId);
              }}
              data-therapist={entry.userId}
              className="cursor-pointer"
            >
              {entry.status === "online" ? (
                <circle r="12" fill="#2EC4B6" opacity="0.18" pointerEvents="none">
                  <animate
                    attributeName="r"
                    values="6;16;6"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.34;0;0.34"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              ) : null}
              <circle
                r="5.5"
                fill={
                  entry.status === "online"
                    ? "#2EC4B6"
                    : entry.status === "pending"
                      ? "#fbbf24"
                      : "#94a3b8"
                }
                stroke="#04101f"
                strokeWidth="1.4"
                filter="url(#globe-glow)"
              />
              <title>{`${entry.firstName} — ${entry.status === "online" ? "available now" : entry.status === "pending" ? "being booked" : "in a session"}`}</title>
            </g>
          ))}
        </g>

        {/* The limb, drawn over everything so the sphere reads as a sphere. */}
        <circle
          cx={CX}
          cy={CY}
          r={BASE_RADIUS}
          fill="none"
          stroke="#24C8DB"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      </svg>

      {/* Hover readout. Absolutely positioned rather than an SVG label so it
          never scales into illegibility on a phone. */}
      {hovered ? (
        <div className="pointer-events-none absolute top-3 left-3 rounded-xl border border-white/10 bg-navy-500/80 px-3 py-2 backdrop-blur">
          <p className="text-sm font-semibold text-white">
            <span aria-hidden>{countryFlag(hover)}</span> {hovered.n}
          </p>
          <p className="text-[11px] text-teal-300">
            {hoveredCount > 0
              ? `${hoveredCount} online now — tap to filter`
              : "Nobody here right now"}
          </p>
        </div>
      ) : null}

      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/40">Spinning up…</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Meridians and parallels every thirty degrees.
 *
 * Not decoration: without a grid an orthographic sphere with no shading reads
 * as a flat disc, and dragging it feels like sliding a picture rather than
 * turning a ball.
 */
function graticulePath(view: Viewpoint): string {
  let path = "";

  for (let lon = -180; lon < 180; lon += 30) {
    let drawing = false;
    for (let lat = -80; lat <= 80; lat += 4) {
      const point = project(lon, lat, view);
      if (!point) {
        drawing = false;
        continue;
      }
      path += `${drawing ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      drawing = true;
    }
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    let drawing = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const point = project(lon, lat, view);
      if (!point) {
        drawing = false;
        continue;
      }
      path += `${drawing ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      drawing = true;
    }
  }

  return path;
}
