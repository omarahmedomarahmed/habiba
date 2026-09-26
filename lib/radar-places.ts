/**
 * Where a clinician's dot goes on the globe, from the words they typed.
 *
 * `therapist_radar` stores a country, a region and a city as free text, which is
 * what a clinician is willing to publish about where they work. This turns those
 * words into a point: the district or city they named, never an address. A
 * confirmed practice pin (walk-ins on) still wins, because that one IS an address
 * the clinician chose to publish.
 *
 * No geocoder and no request: a short table of the places this market actually
 * lives in (Greater Cairo by district, Alexandria by district, the Delta and
 * canal cities, the MENA capitals) is enough, and a name it does not know falls
 * back to the country's main city, then to Cairo.
 *
 * 🔴 Why Cairo when we know nothing: every clinician on this product so far
 * practises in Egypt and most of them in Cairo, so a dot there is the least wrong
 * guess, and it keeps a clinician with a blank profile on the map rather than
 * missing from it. A dot in the Atlantic would be a claim about somebody; a dot in
 * Cairo is the market's default.
 */

export type Place = {
  lat: number;
  lon: number;
  /** ISO alpha-2 of the country the place is in. */
  country: string;
  /** The city a district belongs to, for the label on the zoomed map: "cairo", "alexandria". */
  city: string;
};

/** A city the zoomed map can label, in both languages. */
export const CITY_LABELS: Record<string, { en: string; ar: string }> = {
  cairo: { en: "Cairo", ar: "القاهرة" },
  giza: { en: "Giza", ar: "الجيزة" },
  alexandria: { en: "Alexandria", ar: "الإسكندرية" },
  mansoura: { en: "Mansoura", ar: "المنصورة" },
  tanta: { en: "Tanta", ar: "طنطا" },
  zagazig: { en: "Zagazig", ar: "الزقازيق" },
  portsaid: { en: "Port Said", ar: "بورسعيد" },
  ismailia: { en: "Ismailia", ar: "الإسماعيلية" },
  suez: { en: "Suez", ar: "السويس" },
  hurghada: { en: "Hurghada", ar: "الغردقة" },
  sharm: { en: "Sharm El Sheikh", ar: "شرم الشيخ" },
  luxor: { en: "Luxor", ar: "الأقصر" },
  aswan: { en: "Aswan", ar: "أسوان" },
  assiut: { en: "Assiut", ar: "أسيوط" },
  riyadh: { en: "Riyadh", ar: "الرياض" },
  jeddah: { en: "Jeddah", ar: "جدة" },
  dubai: { en: "Dubai", ar: "دبي" },
  abudhabi: { en: "Abu Dhabi", ar: "أبوظبي" },
  doha: { en: "Doha", ar: "الدوحة" },
  kuwait: { en: "Kuwait City", ar: "مدينة الكويت" },
  manama: { en: "Manama", ar: "المنامة" },
  muscat: { en: "Muscat", ar: "مسقط" },
  amman: { en: "Amman", ar: "عمّان" },
  beirut: { en: "Beirut", ar: "بيروت" },
  damascus: { en: "Damascus", ar: "دمشق" },
  baghdad: { en: "Baghdad", ar: "بغداد" },
  ramallah: { en: "Ramallah", ar: "رام الله" },
  tunis: { en: "Tunis", ar: "تونس" },
  algiers: { en: "Algiers", ar: "الجزائر" },
  rabat: { en: "Rabat", ar: "الرباط" },
  casablanca: { en: "Casablanca", ar: "الدار البيضاء" },
  tripoli: { en: "Tripoli", ar: "طرابلس" },
  khartoum: { en: "Khartoum", ar: "الخرطوم" },
  sanaa: { en: "Sanaa", ar: "صنعاء" },
  istanbul: { en: "Istanbul", ar: "إسطنبول" },
  london: { en: "London", ar: "لندن" },
  paris: { en: "Paris", ar: "باريس" },
  berlin: { en: "Berlin", ar: "برلين" },
  newyork: { en: "New York", ar: "نيويورك" },
  toronto: { en: "Toronto", ar: "تورنتو" },
};

/**
 * `[lat, lon, country, city, ...names]`. The names are matched lowercased, in
 * English and Arabic, as whole words anywhere in the city, region or practice
 * address, longest first, so "New Cairo" is never read as "Cairo".
 */
const TABLE: [number, number, string, string, ...string[]][] = [
  /* Greater Cairo, by district. */
  [30.0444, 31.2357, "EG", "cairo", "cairo", "downtown cairo", "wust el balad", "القاهرة", "وسط البلد", "cairo governorate"],
  [30.0609, 31.2197, "EG", "cairo", "zamalek", "الزمالك"],
  [30.0911, 31.3225, "EG", "cairo", "heliopolis", "masr el gedida", "misr el gedida", "مصر الجديدة"],
  [29.9602, 31.2569, "EG", "cairo", "maadi", "degla", "المعادي"],
  [30.0384, 31.2123, "EG", "cairo", "dokki", "الدقي"],
  [30.0561, 31.2001, "EG", "cairo", "mohandessin", "mohandeseen", "المهندسين"],
  [30.0561, 31.3301, "EG", "cairo", "nasr city", "مدينة نصر"],
  [30.0300, 31.4700, "EG", "cairo", "new cairo", "fifth settlement", "tagamoa", "el tagamoa", "التجمع", "القاهرة الجديدة"],
  [30.0360, 31.2310, "EG", "cairo", "garden city", "جاردن سيتي"],
  [30.1040, 31.2440, "EG", "cairo", "shubra", "شبرا"],
  [30.0750, 31.4360, "EG", "cairo", "sheraton", "el sherouk", "shorouk", "الشروق"],
  [30.0131, 31.2089, "EG", "giza", "giza", "giza governorate", "الجيزة"],
  [30.0444, 30.9760, "EG", "giza", "sheikh zayed", "الشيخ زايد"],
  [29.9285, 30.9188, "EG", "giza", "6th of october", "sixth of october", "october", "6 أكتوبر"],
  /* Alexandria, by district. */
  [31.2001, 29.9187, "EG", "alexandria", "alexandria", "alex", "alexandria governorate", "الإسكندرية", "الاسكندرية"],
  [31.2135, 29.9430, "EG", "alexandria", "smouha", "سموحة"],
  [31.2190, 29.9330, "EG", "alexandria", "sporting", "سبورتنج"],
  [31.2447, 29.9632, "EG", "alexandria", "gleem", "glim", "جليم"],
  [31.2350, 29.9490, "EG", "alexandria", "stanley", "ستانلي"],
  [31.2210, 29.9420, "EG", "alexandria", "sidi gaber", "سيدي جابر"],
  [31.2290, 29.9560, "EG", "alexandria", "roushdy", "rushdy", "رشدي"],
  [31.2680, 30.0000, "EG", "alexandria", "miami", "ميامي"],
  [31.2880, 30.0160, "EG", "alexandria", "montaza", "المنتزه"],
  /* The rest of Egypt. */
  [31.0409, 31.3785, "EG", "mansoura", "mansoura", "dakahlia", "المنصورة", "الدقهلية"],
  [30.7865, 31.0004, "EG", "tanta", "tanta", "gharbia", "طنطا"],
  [30.5877, 31.5020, "EG", "zagazig", "zagazig", "sharqia", "الزقازيق"],
  [31.2653, 32.3019, "EG", "portsaid", "port said", "بورسعيد"],
  [30.5965, 32.2715, "EG", "ismailia", "ismailia", "الإسماعيلية"],
  [29.9668, 32.5498, "EG", "suez", "suez", "السويس"],
  [27.2579, 33.8116, "EG", "hurghada", "hurghada", "red sea governorate", "الغردقة"],
  [27.9158, 34.3300, "EG", "sharm", "sharm el sheikh", "sharm", "south sinai", "شرم الشيخ"],
  [25.6872, 32.6396, "EG", "luxor", "luxor", "الأقصر"],
  [24.0889, 32.8998, "EG", "aswan", "aswan", "أسوان"],
  [27.1809, 31.1837, "EG", "assiut", "assiut", "asyut", "أسيوط"],
  /* The region. */
  [24.7136, 46.6753, "SA", "riyadh", "riyadh", "الرياض"],
  [21.4858, 39.1925, "SA", "jeddah", "jeddah", "jedda", "جدة"],
  [25.2048, 55.2708, "AE", "dubai", "dubai", "دبي"],
  [24.4539, 54.3773, "AE", "abudhabi", "abu dhabi", "أبوظبي", "أبو ظبي"],
  [25.2854, 51.531, "QA", "doha", "doha", "الدوحة"],
  [29.3759, 47.9774, "KW", "kuwait", "kuwait city", "kuwait", "الكويت"],
  [26.2285, 50.586, "BH", "manama", "manama", "المنامة"],
  [23.588, 58.3829, "OM", "muscat", "muscat", "مسقط"],
  [31.9454, 35.9284, "JO", "amman", "amman", "عمّان"],
  [33.8938, 35.5018, "LB", "beirut", "beirut", "بيروت"],
  [33.5138, 36.2765, "SY", "damascus", "damascus", "دمشق"],
  [33.3152, 44.3661, "IQ", "baghdad", "baghdad", "بغداد"],
  [31.9038, 35.2034, "PS", "ramallah", "ramallah", "رام الله"],
  [36.8065, 10.1815, "TN", "tunis", "tunis", "تونس"],
  [36.7538, 3.0588, "DZ", "algiers", "algiers", "الجزائر"],
  [34.0209, -6.8416, "MA", "rabat", "rabat", "الرباط"],
  [33.5731, -7.5898, "MA", "casablanca", "casablanca", "الدار البيضاء"],
  [32.8872, 13.1913, "LY", "tripoli", "tripoli", "طرابلس"],
  [15.5007, 32.5599, "SD", "khartoum", "khartoum", "الخرطوم"],
  [15.3694, 44.191, "YE", "sanaa", "sanaa", "صنعاء"],
  [41.0082, 28.9784, "TR", "istanbul", "istanbul", "إسطنبول"],
  /* Where the diaspora books from. */
  [51.5074, -0.1278, "GB", "london", "london", "لندن"],
  [48.8566, 2.3522, "FR", "paris", "paris", "باريس"],
  [52.52, 13.405, "DE", "berlin", "berlin", "برلين"],
  [40.7128, -74.006, "US", "newyork", "new york", "نيويورك"],
  [43.6532, -79.3832, "CA", "toronto", "toronto", "تورنتو"],
];

/** Each country's main city: where a clinician who named no city we know is drawn. */
const MAIN_CITY: Record<string, string> = {
  EG: "cairo",
  SA: "riyadh",
  AE: "dubai",
  QA: "doha",
  KW: "kuwait city",
  BH: "manama",
  OM: "muscat",
  JO: "amman",
  LB: "beirut",
  SY: "damascus",
  IQ: "baghdad",
  PS: "ramallah",
  TN: "tunis",
  DZ: "algiers",
  MA: "casablanca",
  LY: "tripoli",
  SD: "khartoum",
  YE: "sanaa",
  TR: "istanbul",
  GB: "london",
  FR: "paris",
  DE: "berlin",
  US: "new york",
  CA: "toronto",
};

type Named = { name: string; place: Place };

/** Every name, longest first, so the most specific one wins. */
const NAMES: Named[] = TABLE.flatMap(([lat, lon, country, city, ...names]) =>
  names.map((name) => ({ name: name.toLowerCase(), place: { lat, lon, country, city } })),
).sort((a, b) => b.name.length - a.name.length);

const BY_NAME = new Map(NAMES.map((n) => [n.name, n.place]));

/** Lowercase, hyphens and commas to spaces, and "el-"/"al " noise kept as words. */
function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[-_,.()/]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** The first known place named anywhere in these words, in this country when there is one. */
export function findPlace(texts: (string | null | undefined)[], country?: string | null): Place | null {
  const code = country?.toUpperCase() ?? null;
  for (const text of texts) {
    if (!text) continue;
    const haystack = normalise(text);
    for (const { name, place } of NAMES) {
      if (code && place.country !== code) continue;
      if (haystack.includes(` ${name} `)) return place;
    }
  }
  return null;
}

/** The fallback for a country: its main city, or nothing when we have none. */
export function mainCity(country: string | null | undefined): Place | null {
  const name = country ? MAIN_CITY[country.toUpperCase()] : undefined;
  return name ? (BY_NAME.get(name) ?? null) : null;
}

export const CAIRO: Place = BY_NAME.get("cairo")!;

/**
 * A clinician's point, and whether it came from something they told us.
 *
 * Order: a confirmed practice pin, then the city, the region and the practice
 * address in that order, then the country's main city, then Cairo. `country` is
 * what the dot is grouped under; a clinician with none is counted in Egypt,
 * because that is where the Cairo default puts them.
 */
export function placeOf(entry: {
  country: string | null;
  region: string | null;
  city: string | null;
  practice?: { address: string; lat: string | null; lon: string | null } | null;
}): Place & { exact: boolean } {
  const country = entry.country?.toUpperCase() || null;
  const named =
    findPlace([entry.city, entry.region, entry.practice?.address], country) ??
    (country ? null : findPlace([entry.city, entry.region, entry.practice?.address]));

  const pinLat = entry.practice?.lat ? Number(entry.practice.lat) : NaN;
  const pinLon = entry.practice?.lon ? Number(entry.practice.lon) : NaN;
  if (Number.isFinite(pinLat) && Number.isFinite(pinLon)) {
    return {
      lat: pinLat,
      lon: pinLon,
      country: country ?? named?.country ?? "EG",
      city: named?.city ?? mainCity(country)?.city ?? "cairo",
      exact: true,
    };
  }

  if (named) return { ...named, country: country ?? named.country, exact: false };
  const main = mainCity(country);
  if (main) return { ...main, exact: false };
  if (country) return { ...CAIRO, country, city: "", exact: false, lat: NaN, lon: NaN };
  return { ...CAIRO, exact: false };
}

/**
 * A small, fixed nudge so two clinicians in one district are two dots.
 *
 * Keyed on the id, so a dot never moves between refreshes, and at most about a
 * kilometre and a half: enough to separate them when zoomed in, never enough to
 * put somebody in a different neighbourhood.
 */
export function jitter(id: string): { dLat: number; dLon: number } {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) % 3600) / 3600 * Math.PI * 2;
  const distance = 0.004 + (((hash >>> 12) % 1000) / 1000) * 0.01;
  return { dLat: Math.sin(angle) * distance, dLon: Math.cos(angle) * distance };
}
