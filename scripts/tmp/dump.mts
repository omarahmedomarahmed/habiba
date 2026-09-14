import { DICTIONARIES } from "../../lib/i18n/messages";
const keys = process.argv.slice(2);
for (const k of keys) {
  const en = (DICTIONARIES.en as Record<string, string>)[k];
  const ar = (DICTIONARIES.ar as Record<string, string>)[k];
  console.log(`### ${k}  [${en.trim().split(/\s+/).length}]`);
  console.log(`EN: ${en}`);
  console.log(`AR: ${ar}\n`);
}
