import { DICTIONARIES } from "../../lib/i18n/messages";
const seen = new Map<string, string[]>();
for (const [k, v] of Object.entries(DICTIONARIES.en)) {
  const t = String(v).trim().toLowerCase();
  if (t.split(/\s+/).length < 8) continue;
  (seen.get(t) ?? seen.set(t, []).get(t)!).push(k);
}
let words = 0;
for (const [text, keys] of seen) {
  if (keys.length < 2) continue;
  words += text.split(/\s+/).length * (keys.length - 1);
  console.log(`${keys.join("  ==  ")}\n   ${text.slice(0, 110)}\n`);
}
console.log(`# duplicated words: ${words}`);
