"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2 } from "lucide-react";

import { GlobeInfo, type GlobeHover } from "@/components/radar/globe-info";
import type { GlobeEntry, RadarEntry, RadarOfflineEntry } from "@/components/radar/types";
import {
  ease,
  project,
  ringPath,
  shortestTurn,
  visible,
  zoomForBounds,
  type Viewpoint,
} from "@/lib/globe";
import raw from "@/lib/world-110m.json";
import { CITY_LABELS, jitter, placeOf } from "@/lib/radar-places";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/i18n/client";

export type { GlobeHover } from "@/components/radar/globe-info";

type Country = { n: string; c: [number, number]; b: [number, number, number, number]; p: number[][] };
const WORLD = raw as unknown as Record<string, Country>;

const SIZE = 640;
const CX = SIZE / 2;
const CY = SIZE / 2;
const BASE_RADIUS = 268;
/** How far in a person may wheel. Far enough to tell Smouha from Sporting. */
const MAX_ZOOM = 90;
/** One empty list, so a host passing nothing does not re-place every dot each render. */
const NONE: RadarOfflineEntry[] = [];

/** Degrees per second when nobody is touching it. */
const DRIFT = 3.2;

/** Two dots closer than this, in viewBox units, are fanned out around their middle. */
const MIN_GAP = 15;

type Pin = { entry: GlobeEntry; lon: number; lat: number; country: string; city: string };

type Group = {
  code: string;
  lon: number;
  lat: number;
  live: number;
  online: number;
  offline: number;
  pins: Pin[];
  /** City key to its middle, for the labels on the zoomed map. */
  cities: Map<string, { lon: number; lat: number }>;
};

/**
 * The globe.
 *
 * Drawn as SVG paths from Natural Earth's 110m outlines, projected
 * orthographically on every frame. No map library and no tile server: nothing
 * is fetched while a person in crisis waits, nothing phones a third party to
 * tell them who is looking at a therapy site, and the whole thing is one 40 kB
 * chunk that only loads on this page.
 *
 * ## Two distances
 *
 * From orbit, every country with a clinician in it is lit and carries ONE
 * marker with a count: bright when anybody there is live, hollow when all of
 * them are offline. A dot per clinician at this distance was a scatter across
 * the whole country that looked random, because at this scale it was.
 *
 * Tapping the marker (or the country) flies in to that country's clinicians
 * and draws each at the district they practise in (`lib/radar-places.ts`), so
 * Cairo reads as Cairo and Alexandria as Alexandria. Dots that land on top of
 * each other are fanned out around their middle on screen, never moved across
 * the map. Tapping outside, the "World" control, or wheeling back out returns
 * to orbit.
 *
 * The animation loop writes `d` and `transform` straight onto the DOM nodes
 * rather than going through React. Re-rendering 170 paths and every dot sixty
 * times a second is exactly the kind of thing that turns a nice globe into a
 * stuttering one on the phone somebody is actually holding.
 */
export function Globe({
  entries,
  offline = NONE,
  selected,
  onSelect,
  onPick,
  onPickOffline,
  onHover,
  showInfo = true,
  backButton = true,
  className,
}: {
  entries: RadarEntry[];
  /**
   * 🔴 Verified clinicians who are not on shift. Drawn hollow and dim, with no
   * pulse and no glow, and never handed to `onPick`: a tap on one goes to
   * `onPickOffline`, or straight to their profile to book a time. The live
   * dots are drawn after these so a live one is never underneath.
   */
  offline?: RadarOfflineEntry[];
  /** ISO alpha-2 of the country zoomed into, if any. The globe also zooms on its own when tapped. */
  selected: string | null;
  onSelect: (code: string | null) => void;
  onPick: (entry: RadarEntry) => void;
  onPickOffline?: (entry: RadarOfflineEntry) => void;
  /** What is being pointed at, for a host that draws the info box itself. */
  onHover?: (info: GlobeHover | null) => void;
  /** Draw the info box at the globe's own top-left. Off when the host draws it under its chips. */
  showInfo?: boolean;
  /** A "World" button while zoomed in. Off when the host has its own. */
  backButton?: boolean;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);
  const view = useRef<Viewpoint>({ lon: 10, lat: 18, radius: BASE_RADIUS, cx: CX, cy: CY });
  const paths = useRef(new Map<string, SVGPathElement>());
  const dots = useRef(new Map<string, SVGGElement>());
  const markers = useRef(new Map<string, SVGGElement>());
  const labels = useRef(new Map<string, SVGTextElement>());
  const graticule = useRef<SVGPathElement>(null);
  /** The globe's drawn width in CSS pixels, kept current by a resize observer. */
  const width = useRef(SIZE);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = svg.getBoundingClientRect();
      /* The viewBox is square and letterboxed, so the drawn size is the shorter side. */
      width.current = Math.min(box.width, box.height) || SIZE;
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  /** `c:EG` for a country or its marker, `t:<id>` for a clinician. */
  const [hover, setHover] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /*
   * Which country is zoomed into. Follows `selected` when the host changes it
   * (a chip), and moves on its own when the globe is tapped, so a host that
   * does not filter by country (the marketing page) still gets the zoom.
   */
  const [focus, setFocus] = useState<string | null>(selected);
  useEffect(() => setFocus(selected), [selected]);
  const focusRef = useRef(focus);
  focusRef.current = focus;

  /*
   * Callbacks behind refs.
   *
   * The pointer listeners are attached once and must never be torn down and
   * rebuilt mid-drag, which is what a dependency on a parent's inline arrow
   * function would cause on every render.
   */
  const handlers = useRef({ onSelect, onPick, onPickOffline });
  handlers.current = { onSelect, onPick, onPickOffline };

  const choose = useCallback((code: string | null) => {
    setFocus(code);
    handlers.current.onSelect(code);
  }, []);

  /* ------------------------------------------------------------ placing -- */

  /**
   * Where each clinician's dot goes, and the one marker per country.
   *
   * Offline first, live last, so live dots are drawn later and win a tap.
   */
  const { pins, groups } = useMemo(() => {
    const pins: Pin[] = [];
    for (const entry of [...offline, ...entries] as GlobeEntry[]) {
      const place = placeOf(entry);
      const country = place.country;
      let { lat, lon } = place;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const centre = WORLD[country]?.c;
        if (!centre) continue;
        [lon, lat] = centre;
      }
      const nudge = place.exact ? { dLat: 0, dLon: 0 } : jitter(entry.userId);
      pins.push({ entry, lon: lon + nudge.dLon, lat: lat + nudge.dLat, country, city: place.city });
    }

    const groups = new Map<string, Group>();
    for (const pin of pins) {
      let group = groups.get(pin.country);
      if (!group) {
        group = { code: pin.country, lon: 0, lat: 0, live: 0, online: 0, offline: 0, pins: [], cities: new Map() };
        groups.set(pin.country, group);
      }
      group.pins.push(pin);
      if (pin.entry.status === "offline") group.offline += 1;
      else group.live += 1;
      if (pin.entry.status === "online") group.online += 1;
    }
    for (const group of groups.values()) {
      group.lon = group.pins.reduce((sum, p) => sum + p.lon, 0) / group.pins.length;
      group.lat = group.pins.reduce((sum, p) => sum + p.lat, 0) / group.pins.length;
      const byCity = new Map<string, Pin[]>();
      for (const pin of group.pins) {
        if (!pin.city) continue;
        byCity.set(pin.city, [...(byCity.get(pin.city) ?? []), pin]);
      }
      for (const [city, list] of byCity) {
        group.cities.set(city, {
          lon: list.reduce((s, p) => s + p.lon, 0) / list.length,
          lat: list.reduce((s, p) => s + p.lat, 0) / list.length,
        });
      }
    }
    return { pins, groups };
  }, [entries, offline]);

  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const codes = useMemo(() => Object.keys(WORLD), []);

  /* ------------------------------------------------------------ drawing -- */

  const draw = useCallback(() => {
    const current = view.current;
    const zoomed = focusRef.current;
    /*
     * Marks are sized in viewBox units, so a globe drawn 320 pixels wide on a
     * phone shrinks a dot to three pixels and a city name to six. Scale them
     * back up when the globe is small, and never down.
     */
    const ui = Math.min(1.8, Math.max(1, 520 / (width.current || SIZE)));

    for (const code of codes) {
      const node = paths.current.get(code);
      if (!node) continue;
      node.setAttribute("d", WORLD[code]!.p.map((ring) => ringPath(ring, current)).join(" "));
    }

    if (graticule.current) graticule.current.setAttribute("d", graticulePath(current));

    /* One marker per country, except the one being looked into. */
    for (const group of groups.values()) {
      const node = markers.current.get(group.code);
      if (!node) continue;
      const point =
        group.code !== zoomed && visible(group.lon, group.lat, current)
          ? project(group.lon, group.lat, current)
          : null;
      if (!point) {
        node.style.display = "none";
        continue;
      }
      node.style.display = "";
      node.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) scale(${ui})`);
    }

    /* The clinicians of the zoomed country, fanned out where they overlap. */
    const shown: { id: string; city: string; x: number; y: number }[] = [];
    for (const pin of pins) {
      const node = dots.current.get(pin.entry.userId);
      if (!node) continue;
      const point =
        pin.country === zoomed && visible(pin.lon, pin.lat, current)
          ? project(pin.lon, pin.lat, current)
          : null;
      if (!point) {
        node.style.display = "none";
        continue;
      }
      shown.push({ id: pin.entry.userId, city: pin.city, x: point.x, y: point.y });
    }
    declutter(shown, MIN_GAP * ui);
    const top = new Map<string, number>();
    for (const dot of shown) {
      const node = dots.current.get(dot.id)!;
      node.style.display = "";
      node.setAttribute("transform", `translate(${dot.x.toFixed(1)} ${dot.y.toFixed(1)}) scale(${ui})`);
      top.set(dot.city, Math.min(top.get(dot.city) ?? Infinity, dot.y));
    }

    /* City names above each cluster, so Cairo and Alexandria are named on the map. */
    const group = zoomed ? groups.get(zoomed) : null;
    for (const [key, node] of labels.current) {
      const [code, city] = key.split(":") as [string, string];
      const anchor = group && code === zoomed ? group.cities.get(city) : null;
      const point = anchor && visible(anchor.lon, anchor.lat, current) ? project(anchor.lon, anchor.lat, current) : null;
      if (!point || !top.has(city)) {
        node.style.display = "none";
        continue;
      }
      node.style.display = "";
      node.setAttribute("x", point.x.toFixed(1));
      node.setAttribute("font-size", (12 * ui).toFixed(1));
      node.setAttribute("y", (Math.min(point.y, top.get(city)!) - 14 * ui).toFixed(1));
    }
  }, [codes, groups, pins]);

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
       * country is zoomed into: spinning away from the thing someone just asked
       * to look at is the most annoying possible behaviour.
       */
      if (!reduced && !dragging.current && !focus && Date.now() - idleSince.current > 2500) {
        view.current.lon -= DRIFT * dt;
      }

      draw();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    setReady(true);
    return () => cancelAnimationFrame(frame);
  }, [draw, focus]);

  /** Fly to a country's clinicians, or back out to the whole world. */
  const flyTo = useCallback((code: string | null) => {
    const from = { ...view.current };
    let to = { lon: shortestTurn(from.lon, 10), lat: 18, radius: BASE_RADIUS };

    if (code) {
      const group = groupsRef.current.get(code);
      const country = WORLD[code];
      if (group && group.pins.length > 0) {
        /*
         * Frame the clinicians, not the whole country: Egypt's outline is a
         * thousand kilometres of desert around two cities, and the point is to
         * see which district everybody is in.
         */
        const lons = group.pins.map((p) => p.lon);
        const lats = group.pins.map((p) => p.lat);
        const pad = 0.7;
        const bounds: [number, number, number, number] = [
          Math.min(...lons) - pad,
          Math.min(...lats) - pad,
          Math.max(...lons) + pad,
          Math.max(...lats) + pad,
        ];
        const centreLon = (bounds[0] + bounds[2]) / 2;
        const centreLat = (bounds[1] + bounds[3]) / 2;
        const spanLon = Math.abs(bounds[2] - bounds[0]) * Math.cos((centreLat * Math.PI) / 180);
        const span = Math.max(2.4, spanLon, Math.abs(bounds[3] - bounds[1]));
        to = {
          lon: shortestTurn(from.lon, centreLon),
          /*
           * Aimed a little north of the middle so the clinicians sit in the
           * lower part of the disc, clear of the info box at its top-left.
           */
          lat: Math.max(-70, Math.min(70, centreLat + span * 0.12)),
          radius: BASE_RADIUS * Math.min(MAX_ZOOM * 0.66, Math.max(1, 115 / span)),
        };
      } else if (country) {
        to = {
          lon: shortestTurn(from.lon, country.c[0]),
          lat: Math.max(-70, Math.min(70, country.c[1])),
          radius: BASE_RADIUS * zoomForBounds(country.b),
        };
      }
    }

    if (animation.current) cancelAnimationFrame(animation.current);
    const start = performance.now();
    /* A longer flight for a deeper zoom, or the last few kilometres are a jump. */
    const duration = code ? 1100 : 800;

    /*
     * The radius is eased on a log scale: going from 1x to 50x linearly spends
     * the whole flight at the far end and arrives with a lurch.
     */
    const logFrom = Math.log(from.radius);
    const logTo = Math.log(to.radius);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      view.current.lon = from.lon + (to.lon - from.lon) * k;
      view.current.lat = from.lat + (to.lat - from.lat) * k;
      view.current.radius = Math.exp(logFrom + (logTo - logFrom) * k);
      if (t < 1) animation.current = requestAnimationFrame(step);
    };
    animation.current = requestAnimationFrame(step);
    idleSince.current = Date.now();
  }, []);

  useEffect(() => {
    flyTo(focus);
  }, [focus, flyTo]);

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
      if (animation.current) cancelAnimationFrame(animation.current);
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
       * Pointer capture, which the drag needs or the globe stops turning the
       * moment the cursor leaves it, redirects every subsequent event to the
       * SVG, so the browser fires `click` on the SVG and never on the country
       * underneath. Hit-test the point ourselves instead, and only when the
       * pointer barely moved, so the end of a spin is not also a selection.
       */
      if (moved > 6) return;

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const dot = target?.closest("[data-therapist]")?.getAttribute("data-therapist");
      if (dot) {
        const entry = pinsRef.current.find((p) => p.entry.userId === dot)?.entry;
        /*
         * 🔴 An offline dot never reaches `onPick`, which is the booking sheet's
         * door on every host. It opens their profile to book a time instead.
         */
        if (entry?.status === "offline") {
          if (handlers.current.onPickOffline) handlers.current.onPickOffline(entry);
          else window.location.assign(`/t/${entry.userId}`);
        } else if (entry) {
          handlers.current.onPick(entry);
        }
        return;
      }

      const marker = target?.closest("[data-marker]")?.getAttribute("data-marker");
      if (marker) {
        choose(marker);
        return;
      }

      const code = target?.closest("[data-country]")?.getAttribute("data-country");
      if (code && groupsRef.current.has(code)) {
        choose(code === focusRef.current ? null : code);
        return;
      }
      /* Anywhere else, while zoomed in, is "take me back out". */
      if (focusRef.current) choose(null);
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (animation.current) cancelAnimationFrame(animation.current);
      const next = view.current.radius * (event.deltaY > 0 ? 0.9 : 1.1);
      view.current.radius = Math.max(BASE_RADIUS, Math.min(BASE_RADIUS * MAX_ZOOM, next));
      idleSince.current = Date.now();
      /* Wheeling all the way back out is the same as asking for the world. */
      if (focusRef.current && view.current.radius <= BASE_RADIUS * 1.25) choose(null);
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
  }, [choose]);

  /* ------------------------------------------------------------ the box -- */

  const info = useMemo<GlobeHover | null>(() => {
    const countryInfo = (code: string, zoomed: boolean): GlobeHover => {
      const group = groups.get(code);
      return {
        kind: "country",
        code,
        live: group?.live ?? 0,
        online: group?.online ?? 0,
        offline: group?.offline ?? 0,
        zoomed,
      };
    };
    if (hover?.startsWith("t:")) {
      const pin = pins.find((p) => p.entry.userId === hover.slice(2));
      if (pin) return { kind: "therapist", entry: pin.entry, city: pin.city || null };
    }
    if (hover?.startsWith("c:")) return countryInfo(hover.slice(2), hover.slice(2) === focus);
    if (focus) return countryInfo(focus, true);
    return null;
  }, [hover, pins, groups, focus]);

  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  useEffect(() => {
    onHoverRef.current?.(info);
  }, [info]);

  const cityKeys = useMemo(
    () => [...groups.values()].flatMap((g) => [...g.cities.keys()].map((city) => `${g.code}:${city}`)),
    [groups],
  );

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label={t("radar.globeLabel")}
        data-zoomed={focus ?? ""}
      >
        <defs>
          <radialGradient id="globe-ocean" cx="34%" cy="28%" r="82%">
            <stop offset="0%" stopColor="#123a63" />
            <stop offset="55%" stopColor="#0A2342" />
            <stop offset="100%" stopColor="#04101f" />
          </radialGradient>
          <radialGradient id="globe-halo" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="#2EC4B6" stopOpacity="0" />
            <stop offset="92%" stopColor="#2EC4B6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2EC4B6" stopOpacity="0" />
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
            stroke="#2EC4B6"
            strokeOpacity="0.12"
            strokeWidth="0.7"
          />

          {codes.map((code) => {
            const has = groups.has(code);
            const isFocus = focus === code;
            const isHover = hover === `c:${code}`;
            return (
              <path
                key={code}
                ref={(node) => {
                  if (node) paths.current.set(code, node);
                  else paths.current.delete(code);
                }}
                data-country={code}
                data-populated={has ? "" : undefined}
                onPointerEnter={() => setHover(`c:${code}`)}
                onPointerLeave={() => setHover((h) => (h === `c:${code}` ? null : h))}
                className={cn(
                  "transition-[fill,stroke] duration-200",
                  has ? "cursor-pointer" : "cursor-grab",
                )}
                /*
                 * 🔴 A country with clinicians is LIT: a teal-tinted fill and a
                 * teal edge, so where help is reads before a single marker does.
                 */
                fill={
                  isFocus
                    ? "#134760"
                    : has
                      ? isHover
                        ? "#1f8197"
                        : "#1a6a82"
                      : isHover
                        ? "#1b3a5c"
                        : "#14304e"
                }
                stroke={isFocus || has ? "#2EC4B6" : isHover ? "#5eead4" : "#0A2342"}
                strokeOpacity={isFocus ? 0.9 : has ? 0.7 : 1}
                strokeWidth={isFocus ? 1.4 : has ? 1 : isHover ? 1.2 : 0.6}
                strokeLinejoin="round"
              />
            );
          })}

          {/* City names on the zoomed map. */}
          {cityKeys.map((key) => {
            const city = key.split(":")[1]!;
            const name = CITY_LABELS[city]?.[locale === "ar" ? "ar" : "en"] ?? city;
            return (
              <text
                key={key}
                ref={(node) => {
                  if (node) labels.current.set(key, node);
                  else labels.current.delete(key);
                }}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#e2f7f5"
                stroke="#04101f"
                strokeWidth="3"
                paintOrder="stroke"
                pointerEvents="none"
                style={{ display: "none", letterSpacing: "0.04em" }}
              >
                {name}
              </text>
            );
          })}

          {/* Clinicians, drawn only while their country is zoomed into. */}
          {pins.map(({ entry }) => (
            <g
              key={entry.userId}
              ref={(node) => {
                if (node) dots.current.set(entry.userId, node);
                else dots.current.delete(entry.userId);
              }}
              data-therapist={entry.userId}
              data-state={entry.status}
              className="cursor-pointer"
              style={{ display: "none" }}
              onPointerEnter={() => setHover(`t:${entry.userId}`)}
              onPointerLeave={() => setHover((h) => (h === `t:${entry.userId}` ? null : h))}
            >
              {entry.status === "offline" ? (
                /*
                 * 🔴 HOLLOW AND DIM, AND CHEAP. No pulse and no glow filter: a
                 * blur per dot is what would make five hundred of them stutter
                 * on a phone, and a pulse would say "live". The invisible ring
                 * is the thumb-sized target a 4px dot cannot be.
                 */
                <>
                  <circle r="10" fill="#000" fillOpacity="0" />
                  <circle
                    r="5"
                    fill="#04101f"
                    fillOpacity="0.6"
                    stroke="#cbd5e1"
                    strokeOpacity="0.9"
                    strokeWidth="1.6"
                  />
                  <title>{`${entry.firstName}, ${t("radar.legendOffline")}`}</title>
                </>
              ) : (
                <>
                  <circle r="10" fill="#000" fillOpacity="0" />
                  {entry.status === "online" ? (
                    <circle r="12" fill="#2EC4B6" opacity="0.18" pointerEvents="none">
                      <animate attributeName="r" values="6;16;6" dur="2.4s" repeatCount="indefinite" />
                      <animate
                        attributeName="opacity"
                        values="0.34;0;0.34"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  ) : null}
                  <circle
                    r="6"
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
                  <title>{`${entry.firstName}, ${t(entry.status === "online" ? "radar.dotOnline" : entry.status === "pending" ? "radar.dotPending" : "radar.dotBusy")}`}</title>
                </>
              )}
            </g>
          ))}

          {/* One marker per country, drawn last so it is never under an outline. */}
          {[...groups.values()].map((group) => {
            const count = group.live + group.offline;
            const bright = group.live > 0;
            const r = 12 + Math.min(6, Math.log2(count) * 2);
            return (
              <g
                key={group.code}
                ref={(node) => {
                  if (node) markers.current.set(group.code, node);
                  else markers.current.delete(group.code);
                }}
                data-marker={group.code}
                data-state={bright ? "live" : "offline"}
                className="cursor-pointer"
                style={{ display: "none" }}
                onPointerEnter={() => setHover(`c:${group.code}`)}
                onPointerLeave={() => setHover((h) => (h === `c:${group.code}` ? null : h))}
              >
                <circle r={r + 8} fill="#000" fillOpacity="0" />
                {group.online > 0 ? (
                  <circle r={r} fill="#2EC4B6" opacity="0.2" pointerEvents="none">
                    <animate
                      attributeName="r"
                      values={`${r};${r + 12};${r}`}
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                ) : null}
                {bright ? (
                  <circle
                    r={r}
                    fill={group.online > 0 ? "#2EC4B6" : "#fbbf24"}
                    stroke="#04101f"
                    strokeWidth="2"
                    filter="url(#globe-glow)"
                  />
                ) : (
                  <circle
                    r={r}
                    fill="#04101f"
                    fillOpacity="0.75"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                )}
                <text
                  textAnchor="middle"
                  dy="0.36em"
                  fontSize={count > 99 ? 10 : 12}
                  fontWeight="800"
                  fill={bright ? "#04101f" : "#e2e8f0"}
                  pointerEvents="none"
                >
                  {count}
                </text>
                <title>
                  {`${WORLD[group.code]?.n ?? group.code}: ${t("radar.markerTitle", {
                    online: group.online,
                    offline: group.offline,
                  })}`}
                </title>
              </g>
            );
          })}
        </g>

        {/* The limb, drawn over everything so the sphere reads as a sphere. */}
        <circle
          cx={CX}
          cy={CY}
          r={BASE_RADIUS}
          fill="none"
          stroke="#2EC4B6"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      </svg>

      {/* The box. Absolutely positioned rather than an SVG label so it never
          scales into illegibility on a phone. */}
      {showInfo ? <GlobeInfo info={info} legend={false} className="absolute top-3 start-3" /> : null}

      {backButton && focus ? (
        <button
          type="button"
          onClick={() => choose(null)}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-[#04101f]/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/10"
        >
          <Globe2 className="h-3.5 w-3.5" aria-hidden />
          {t("radar.world")}
        </button>
      ) : null}

      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/85">{t("radar.spinningUp")}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fan out dots that sit on top of each other, on screen.
 *
 * Geography stays true: dots are only moved within their own cluster, around
 * the cluster's middle, and only by as much as it takes to see each one. The
 * order is the order they arrive in, which is fixed, so nothing shuffles
 * between frames.
 */
function declutter(points: { x: number; y: number }[], gap: number): void {
  const n = points.length;
  if (n < 2) return;
  const seen = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    seen[i] = true;
    const cluster = [i];
    for (let c = 0; c < cluster.length; c++) {
      const a = points[cluster[c]!]!;
      for (let j = 0; j < n; j++) {
        if (seen[j]) continue;
        const b = points[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y) < gap) {
          seen[j] = true;
          cluster.push(j);
        }
      }
    }
    if (cluster.length < 2) continue;

    const cx = cluster.reduce((s, k) => s + points[k]!.x, 0) / cluster.length;
    const cy = cluster.reduce((s, k) => s + points[k]!.y, 0) / cluster.length;
    /* A sunflower: every dot the same distance from its neighbours, however many. */
    const spacing = gap * 0.62;
    cluster.forEach((k, index) => {
      const angle = index * 2.39996;
      const distance = spacing * Math.sqrt(index + 0.5);
      points[k]!.x = cx + Math.cos(angle) * distance;
      points[k]!.y = cy + Math.sin(angle) * distance;
    });
  }
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
