import { DICTIONARIES } from "../../lib/i18n/messages";
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const buckets: Record<string, { keys: number; words: number }> = {};
let total = 0;
for (const [k, v] of Object.entries(DICTIONARIES.en)) {
  const n = words(String(v));
  total += n;
  const b = n >= 25 ? "25+" : n >= 15 ? "15-24" : n >= 10 ? "10-14" : n >= 5 ? "5-9" : "1-4";
  buckets[b] ??= { keys: 0, words: 0 };
  buckets[b].keys++;
  buckets[b].words += n;
}
console.log("ALL PORTALS total", total);
for (const [b, v] of Object.entries(buckets)) console.log(b, v);
