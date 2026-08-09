/**
 * Orthographic projection — the maths behind the globe.
 *
 * No library. d3-geo is 60 kB to do this, three.js is ten times that, and what
 * is actually needed is nine lines of spherical trigonometry plus a rule for
 * clipping at the horizon. Keeping it here means the globe is a component with
 * no dependencies rather than a reason to add two.
 *
 * Everything is pure and synchronous so it can run inside a render without a
 * `useEffect`, and every function is cheap enough to call ten thousand times a
 * frame, which is exactly what dragging the globe does.
 */

const RAD = Math.PI / 180;

export type Viewpoint = {
  /** Longitude at the centre of the disc — rotating this spins the globe. */
  lon: number;
  /** Latitude at the centre — tilting this looks over the pole. */
  lat: number;
  /** Radius in pixels. Zoom is just a bigger radius behind a circular mask. */
  radius: number;
  cx: number;
  cy: number;
};

export type Point = { x: number; y: number };

/**
 * Project a coordinate, or null if it is round the back.
 *
 * The null is the whole reason this is not a one-liner: a globe that draws the
 * far side of the world through the near side looks like a wireframe of a
 * balloon, and every path has to be cut where it crosses the horizon.
 */
export function project(lon: number, lat: number, view: Viewpoint): Point | null {
  const dl = (lon - view.lon) * RAD;
  const phi = lat * RAD;
  const phi0 = view.lat * RAD;

  const cosc =
    Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dl);
  if (cosc < 0) return null;

  return {
    x: view.cx + view.radius * Math.cos(phi) * Math.sin(dl),
    y:
      view.cy -
      view.radius * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dl)),
  };
}

/** Is this coordinate on the visible hemisphere at all? */
export function visible(lon: number, lat: number, view: Viewpoint): boolean {
  const dl = (lon - view.lon) * RAD;
  const phi = lat * RAD;
  const phi0 = view.lat * RAD;
  return Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dl) >= 0;
}

/**
 * One ring of `[lon, lat, lon, lat, …]` as an SVG path.
 *
 * Runs of visible points become subpaths; a point behind the horizon ends the
 * run. The seam is left open rather than walked around the limb — at this
 * resolution the gap is a pixel or two on a country straddling the edge, and
 * chasing it correctly costs a great-circle intersection per crossing, every
 * frame, for something nobody can see.
 */
export function ringPath(flat: number[], view: Viewpoint): string {
  let path = "";
  let drawing = false;

  for (let i = 0; i < flat.length; i += 2) {
    const point = project(flat[i]!, flat[i + 1]!, view);
    if (!point) {
      drawing = false;
      continue;
    }
    path += `${drawing ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    drawing = true;
  }

  return path;
}

/**
 * Shortest way round from one longitude to another.
 *
 * Spinning from Tokyo to Los Angeles should cross the Pacific, not travel back
 * across all of Asia and Europe. Without this, every zoom-to-country from the
 * far side of the world is a three-second scenic tour.
 */
export function shortestTurn(from: number, to: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  if (delta === -180) delta = 180;
  return from + delta;
}

/** Ease-in-out cubic. Slow, fast, slow — how a heavy object actually moves. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * How far to zoom so a country fills the view without spilling out of it.
 *
 * Derived from its bounding box in degrees rather than a fixed number per
 * country: Russia and Luxembourg both want to be "on screen and legible", and
 * one constant cannot mean that for both.
 */
export function zoomForBounds(bounds: [number, number, number, number]): number {
  const [west, south, east, north] = bounds;
  const spanLon = Math.max(1, Math.abs(east - west) * Math.cos(((north + south) / 2) * RAD));
  const spanLat = Math.max(1, Math.abs(north - south));
  const span = Math.max(spanLon, spanLat);

  // 130° of arc across the disc is roughly "the whole visible face", so the
  // ratio against it is the magnification. Clamped: below 1 is pointless and
  // above 6 the 110m outlines start looking like a polygon soup.
  return Math.min(6, Math.max(1, 130 / span));
}

/**
 * Spread clinicians who share a location so they are countable.
 *
 * Four therapists in Cairo are four dots, not one dot that looks like one
 * therapist. A deterministic spiral keyed on the index, so a dot does not jump
 * to a different spot every time the radar refreshes — movement on this page
 * means "something changed", and it has to keep meaning that.
 */
export function spread(index: number, total: number): { dLon: number; dLat: number } {
  if (total <= 1) return { dLon: 0, dLat: 0 };
  const angle = index * 2.39996; // golden angle, in radians
  const distance = 1.6 * Math.sqrt(index + 0.5);
  return { dLon: Math.cos(angle) * distance, dLat: Math.sin(angle) * distance };
}
