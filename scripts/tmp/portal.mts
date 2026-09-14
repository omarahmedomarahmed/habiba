import { DICTIONARIES } from "../../lib/i18n/messages";

const PORTALS: Record<string, readonly string[]> = {
  patient: ["home","room","preset","pclaim","pbook","prating","pinvite","benefit","checkin","consent","browse","cassess","feedback","homework","jconsent","join","journal","residency","risk"],
  clinician: ["portal","import","note","spec","pted","pracc","cassess"],
  clinic: ["clinic","records"],
  sponsor: ["sponsor","sint"],
  partner: ["dev","devs"],
  public: ["pricing","contact","public","marketing","blocks"],
  admin: ["admin","aclinic","apartner","asponsor","acheckin"],
  shared: ["common","nav","lang","tab","when","urgent","crisis","radar"],
};
const map = new Map<string, string>();
for (const [portal, ps] of Object.entries(PORTALS)) for (const p of ps) map.set(p, portal);
function portalOf(prefix: string) {
  const e = map.get(prefix);
  if (e) return e;
  if (/^p[a-z]/.test(prefix)) return "patient";
  if (/^t[a-z]/.test(prefix)) return "clinician";
  if (/^a[a-z]/.test(prefix)) return "admin";
  return "other";
}
const want = process.argv[2];
const min = Number(process.argv[3] ?? 15);
const max = Number(process.argv[4] ?? 999);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const rows: [string, number, string][] = [];
for (const [k, v] of Object.entries(DICTIONARIES.en)) {
  if (portalOf(k.split(".")[0]!) !== want) continue;
  const n = words(String(v));
  if (n < min || n > max) continue;
  rows.push([k, n, String(v)]);
}
rows.sort((a, b) => b[1] - a[1]);
let total = 0;
for (const [k, n, v] of rows) { total += n; console.log(`${k}\t${n}\t${v}`); }
console.log(`\n# ${rows.length} keys, ${total} words`);
