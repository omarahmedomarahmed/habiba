/**
 * Turn Natural Earth's 110m country topology into the compact table the globe
 * renders from.
 *
 * Run by hand, not by the build: the output is committed. A build step that
 * reaches out to a CDN is a build that fails the day the CDN does, for a file
 * that changes when borders do.
 *
 *   node scripts/build-world.mjs <countries-110m.json> <codes.json>
 *
 * Sources, both public domain / permissively licensed:
 *   world-atlas@2/countries-110m.json  (Natural Earth, public domain)
 *   i18n-iso-countries@7/codes.json    (ISO 3166 numeric → alpha-2)
 *
 * The output drops three decimal places of precision. At 110m resolution on a
 * globe 640 pixels wide, one degree is about two pixels, so a tenth of a degree
 * is a fifth of a pixel — invisible, and it halves the file.
 */

import { readFileSync, writeFileSync } from "node:fs";

const [, , topoPath, codesPath] = process.argv;
if (!topoPath || !codesPath) {
  console.error("usage: node scripts/build-world.mjs <countries-110m.json> <codes.json>");
  process.exit(1);
}

const topo = JSON.parse(readFileSync(topoPath, "utf8"));
const codes = JSON.parse(readFileSync(codesPath, "utf8"));

/** ISO numeric (as an integer, so "004" and "4" agree) → alpha-2. */
const numericToAlpha2 = new Map(codes.map(([a2, , numeric]) => [Number(numeric), a2]));

/* ------------------------------------------------------------- topojson -- */

const { scale, translate } = topo.transform;

/** Undo quantisation and delta encoding for one arc. */
function decodeArc(arc) {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
}

const arcs = topo.arcs.map(decodeArc);

/** A negative index means "that arc, reversed", with ~i as the real index. */
function ring(indices) {
  const points = [];
  for (const index of indices) {
    const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    // Arcs share endpoints; dropping the first avoids a duplicate at each join.
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
}

function polygons(geometry) {
  if (geometry.type === "Polygon") return [geometry.arcs.map(ring)];
  if (geometry.type === "MultiPolygon") return geometry.arcs.map((p) => p.map(ring));
  return [];
}

/* ------------------------------------------------------------ simplify -- */

const round = (n) => Math.round(n * 10) / 10;

function simplify(points) {
  const out = [];
  for (const [lon, lat] of points) {
    const p = [round(lon), round(lat)];
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  // Close it explicitly so the renderer never has to think about it.
  if (out.length > 2) {
    const [fx, fy] = out[0];
    const [lx, ly] = out[out.length - 1];
    if (fx !== lx || fy !== ly) out.push([fx, fy]);
  }
  return out;
}

/** Shoelace, in square degrees. Only used to throw away specks. */
function area(points) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1];
  }
  return Math.abs(sum / 2);
}

/* --------------------------------------------------------------- build -- */

const world = {};

for (const geometry of topo.objects.countries.geometries) {
  const alpha2 = numericToAlpha2.get(Number(geometry.id));
  if (!alpha2) continue;

  const rings = [];
  for (const polygon of polygons(geometry)) {
    // Outer ring only. Holes at this resolution are Lesotho and the Vatican,
    // and drawing them costs more than the honesty is worth on a 600px globe.
    const outer = simplify(polygon[0]);
    if (outer.length < 4) continue;
    if (area(outer) < 0.6) continue;
    rings.push(outer);
  }
  if (rings.length === 0) continue;

  /*
   * Aim at the *largest* landmass, not at the average of every territory.
   *
   * Natural Earth's "France" includes French Guiana, so the bounding box of
   * all its rings has its centre in the Atlantic — which is where the pin for
   * a therapist in Paris ended up, several hundred miles off the coast of
   * Senegal. The United States has the same problem via Alaska and Hawaii, and
   * the Netherlands via the Caribbean. Taking the biggest ring gives mainland
   * France, the contiguous States, and the actual Netherlands.
   */
  const main = rings.reduce((a, b) => (area(a) >= area(b) ? a : b));

  const span = (points) => {
    let w = 180;
    let e = -180;
    for (const [lon] of points) {
      if (lon < w) w = lon;
      if (lon > e) e = lon;
    }
    return e - w;
  };

  /*
   * Russia wraps the antimeridian, so its ring runs from -180 to 180 and the
   * naive centre is longitude zero — Denmark. Shifting negative longitudes up
   * by 360 makes the ring contiguous again; the centre comes back into range
   * afterwards.
   */
  const wraps = span(main) > 180;
  const lonOf = ([lon]) => (wraps && lon < 0 ? lon + 360 : lon);

  let west = Infinity;
  let south = 90;
  let east = -Infinity;
  let north = -90;
  for (const point of main) {
    const lon = lonOf(point);
    const lat = point[1];
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (wraps) {
    const normalise = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
    // Keep the span honest for the zoom calculation, but bring the edges back
    // into the range everything downstream expects.
    const width = east - west;
    const centre = normalise((west + east) / 2);
    west = centre - width / 2;
    east = centre + width / 2;
  }

  world[alpha2] = {
    n: geometry.properties.name,
    // Bounding-box centre of that landmass, not a true centroid. For pointing
    // a globe at a country the two are indistinguishable, and this one cannot
    // fall in the sea the way a centroid does for a crescent-shaped country.
    c: [round((west + east) / 2), round((south + north) / 2)],
    b: [west, south, east, north],
    // Flat arrays: [lon, lat, lon, lat, …]. Halves the JSON versus pairs.
    p: rings.map((r) => r.flat()),
  };
}

/*
 * Natural Earth uses the long-form names. A dropdown reading "United States of
 * America" between "United Kingdom" and "Uruguay" is correct and nobody talks
 * like that, so a short list of them is renamed. Everything else keeps the
 * name it came with, because guessing at 169 countries is how you offend
 * somebody.
 */
const ALIASES = {
  US: "United States",
  GB: "United Kingdom",
  TR: "Türkiye",
  KR: "South Korea",
  KP: "North Korea",
  CD: "DR Congo",
  CG: "Republic of the Congo",
  CZ: "Czechia",
  LA: "Laos",
  SY: "Syria",
  VN: "Vietnam",
  TZ: "Tanzania",
  VE: "Venezuela",
  BO: "Bolivia",
  IR: "Iran",
  MD: "Moldova",
  RU: "Russia",
  MK: "North Macedonia",
  BN: "Brunei",
  TL: "Timor-Leste",
  CI: "Côte d'Ivoire",
  SZ: "Eswatini",
  FM: "Micronesia",
};

for (const [code, name] of Object.entries(ALIASES)) {
  if (world[code]) world[code].n = name;
}

const json = JSON.stringify(world);
writeFileSync("lib/world-110m.json", json);

/*
 * A tiny sibling: code → [name, lon, lat].
 *
 * Everything outside the globe — dropdowns, the admin list, the flat hero map,
 * a country name beside a therapist's card — needs the name and the centre and
 * nothing else. Importing the 115 kB outline file to read a country's name
 * would put the whole world into every bundle that mentions one.
 */
const compact = Object.fromEntries(
  Object.entries(world).map(([code, c]) => [code, [c.n, c.c[0], c.c[1]]]),
);
writeFileSync("lib/countries.json", JSON.stringify(compact));

const points = Object.values(world).reduce(
  (sum, c) => sum + c.p.reduce((s, r) => s + r.length / 2, 0),
  0,
);
console.log(
  `${Object.keys(world).length} countries, ${points} points, ${(json.length / 1024).toFixed(0)} kB`,
);
