import { scanI18n, surfaceOf } from "../_i18n-coverage";
const want = process.argv[2];
const counts = scanI18n().filter((c) => surfaceOf(c.file) === want && c.literals > 0);
let total = 0;
for (const c of counts) { total += c.literals; console.log(String(c.literals).padStart(4), c.file, JSON.stringify(c.examples[0] ?? "").slice(0,70)); }
console.log("total", total);
