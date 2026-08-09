/**
 * Just enough geography to draw a radar.
 *
 * No geo-IP, no map tiles, no external service. Two reasons: a clinician's
 * precise location is not ours to publish — country granularity is the most a
 * patient needs and the least we can leak — and a public marketing page must
 * not make a third-party request on every visit.
 *
 * The land mask below is a deliberately coarse equirectangular silhouette. It
 * is a backdrop, not a map: nobody should navigate by it.
 */

export const LAT_TOP = 78;
export const LAT_BOTTOM = -58;
export const GRID_COLS = 60;
export const GRID_ROWS = 28;

/**
 * Land, as longitude spans per latitude band, north to south. Written as
 * degrees rather than grid indices so it can be read and corrected by eye.
 */
const LAND_BANDS: { lat: number; spans: [number, number][] }[] = [
  { lat: 78, spans: [[-125, -80], [-73, -20], [10, 25], [55, 140]] },
  { lat: 73, spans: [[-128, -65], [-55, -20], [20, 180]] },
  { lat: 68, spans: [[-165, -140], [-138, -65], [-52, -20], [8, 180]] },
  { lat: 63, spans: [[-166, -134], [-132, -60], [-45, -20], [-24, -13], [4, 180]] },
  { lat: 58, spans: [[-162, -134], [-130, -58], [-8, -1], [3, 180]] },
  { lat: 53, spans: [[-135, -55], [-11, 30], [30, 180]] },
  { lat: 48, spans: [[-128, -58], [-6, 40], [40, 150]] },
  { lat: 43, spans: [[-125, -62], [-9, 45], [45, 148]] },
  { lat: 38, spans: [[-123, -72], [-10, 45], [45, 142]] },
  { lat: 33, spans: [[-121, -76], [-17, -1], [4, 38], [38, 136]] },
  { lat: 28, spans: [[-116, -78], [-17, 36], [36, 122]] },
  { lat: 23, spans: [[-111, -84], [-17, 36], [36, 95], [95, 112]] },
  { lat: 18, spans: [[-106, -84], [-17, 42], [42, 95], [95, 108]] },
  { lat: 13, spans: [[-93, -82], [-17, 46], [72, 95], [95, 110]] },
  { lat: 8, spans: [[-85, -76], [-73, -59], [-13, 48], [74, 82], [95, 118]] },
  { lat: 3, spans: [[-80, -49], [-9, 44], [95, 122]] },
  { lat: -2, spans: [[-79, -44], [8, 42], [98, 140]] },
  { lat: -7, spans: [[-78, -36], [11, 41], [104, 150]] },
  { lat: -12, spans: [[-76, -35], [12, 41], [122, 151]] },
  { lat: -17, spans: [[-72, -38], [12, 41], [113, 147]] },
  { lat: -22, spans: [[-70, -41], [13, 36], [113, 152]] },
  { lat: -27, spans: [[-72, -47], [15, 33], [113, 153]] },
  { lat: -32, spans: [[-73, -52], [17, 32], [115, 152]] },
  { lat: -37, spans: [[-74, -56], [18, 27], [138, 150], [166, 179]] },
  { lat: -42, spans: [[-75, -62], [144, 149], [168, 177]] },
  { lat: -47, spans: [[-75, -65]] },
  { lat: -52, spans: [[-75, -67]] },
  { lat: -57, spans: [] },
];

export type LandDot = { x: number; y: number };

/** The land mask as normalised 0–1 coordinates, ready to place in an SVG. */
export function landDots(): LandDot[] {
  const dots: LandDot[] = [];
  LAND_BANDS.forEach((band, row) => {
    const y = row / (GRID_ROWS - 1);
    for (let col = 0; col < GRID_COLS; col += 1) {
      const lon = -180 + (col * 360) / GRID_COLS;
      if (band.spans.some(([from, to]) => lon >= from && lon <= to)) {
        dots.push({ x: col / (GRID_COLS - 1), y });
      }
    }
  });
  return dots;
}

/** Equirectangular projection into the same 0–1 space as the land mask. */
export function project(lon: number, lat: number): { x: number; y: number } {
  const x = (lon + 180) / 360;
  const y = (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM);
  return { x: clamp01(x), y: clamp01(y) };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Country centroids, roughly. Enough of the world to place a dot; the fallback
 * is the middle of the Atlantic, which reads as "unspecified" rather than as a
 * wrong claim about where someone is.
 */
const COUNTRIES: Record<string, { name: string; lon: number; lat: number }> = {
  US: { name: "United States", lon: -98, lat: 39 },
  CA: { name: "Canada", lon: -106, lat: 56 },
  MX: { name: "Mexico", lon: -102, lat: 23 },
  BR: { name: "Brazil", lon: -51, lat: -10 },
  AR: { name: "Argentina", lon: -64, lat: -34 },
  CL: { name: "Chile", lon: -71, lat: -33 },
  CO: { name: "Colombia", lon: -74, lat: 4 },
  GB: { name: "United Kingdom", lon: -2, lat: 54 },
  IE: { name: "Ireland", lon: -8, lat: 53 },
  FR: { name: "France", lon: 2, lat: 46 },
  ES: { name: "Spain", lon: -4, lat: 40 },
  PT: { name: "Portugal", lon: -8, lat: 39 },
  DE: { name: "Germany", lon: 10, lat: 51 },
  NL: { name: "Netherlands", lon: 5, lat: 52 },
  BE: { name: "Belgium", lon: 4, lat: 51 },
  CH: { name: "Switzerland", lon: 8, lat: 47 },
  AT: { name: "Austria", lon: 14, lat: 47 },
  IT: { name: "Italy", lon: 12, lat: 42 },
  GR: { name: "Greece", lon: 22, lat: 39 },
  PL: { name: "Poland", lon: 19, lat: 52 },
  SE: { name: "Sweden", lon: 15, lat: 62 },
  NO: { name: "Norway", lon: 9, lat: 61 },
  DK: { name: "Denmark", lon: 10, lat: 56 },
  FI: { name: "Finland", lon: 26, lat: 64 },
  UA: { name: "Ukraine", lon: 32, lat: 49 },
  TR: { name: "Türkiye", lon: 35, lat: 39 },
  IL: { name: "Israel", lon: 35, lat: 31 },
  AE: { name: "United Arab Emirates", lon: 54, lat: 24 },
  SA: { name: "Saudi Arabia", lon: 45, lat: 24 },
  EG: { name: "Egypt", lon: 30, lat: 27 },
  MA: { name: "Morocco", lon: -7, lat: 32 },
  NG: { name: "Nigeria", lon: 8, lat: 10 },
  KE: { name: "Kenya", lon: 38, lat: 0 },
  ZA: { name: "South Africa", lon: 24, lat: -29 },
  IN: { name: "India", lon: 79, lat: 22 },
  PK: { name: "Pakistan", lon: 70, lat: 30 },
  BD: { name: "Bangladesh", lon: 90, lat: 24 },
  TH: { name: "Thailand", lon: 101, lat: 15 },
  VN: { name: "Vietnam", lon: 106, lat: 16 },
  PH: { name: "Philippines", lon: 122, lat: 13 },
  ID: { name: "Indonesia", lon: 113, lat: -2 },
  MY: { name: "Malaysia", lon: 102, lat: 4 },
  SG: { name: "Singapore", lon: 104, lat: 1 },
  CN: { name: "China", lon: 105, lat: 35 },
  JP: { name: "Japan", lon: 138, lat: 36 },
  KR: { name: "South Korea", lon: 128, lat: 36 },
  AU: { name: "Australia", lon: 134, lat: -25 },
  NZ: { name: "New Zealand", lon: 172, lat: -41 },
};

export const COUNTRY_OPTIONS = Object.entries(COUNTRIES)
  .map(([code, value]) => ({ code, name: value.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function countryName(code: string | null | undefined): string | null {
  return code ? (COUNTRIES[code]?.name ?? null) : null;
}

export function countryPoint(code: string | null | undefined): { x: number; y: number } {
  const country = code ? COUNTRIES[code] : undefined;
  if (!country) return project(-30, 20);
  return project(country.lon, country.lat);
}

/** Languages offered on the radar. An allowlist, not a free-text field. */
export const RADAR_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Arabic",
  "Hebrew",
  "Turkish",
  "Russian",
  "Ukrainian",
  "Polish",
  "Hindi",
  "Urdu",
  "Bengali",
  "Mandarin",
  "Cantonese",
  "Japanese",
  "Korean",
  "Tagalog",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Swahili",
] as const;

/** What a clinician says they work with. Also an allowlist. */
export const RADAR_SPECIALTIES = [
  "Anxiety",
  "Depression",
  "Trauma & PTSD",
  "Grief & loss",
  "Panic attacks",
  "Suicidal thoughts",
  "Self-harm",
  "Addiction",
  "Eating disorders",
  "OCD",
  "Bipolar",
  "Relationships",
  "Family conflict",
  "Work stress & burnout",
  "Identity & LGBTQ+",
  "Postnatal",
  "Sleep",
  "Chronic illness",
] as const;
