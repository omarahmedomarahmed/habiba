import { readFileSync } from "node:fs";
import { literalsIn } from "../_i18n-coverage";
for (const f of process.argv.slice(2)) {
  const lits = literalsIn(readFileSync(f, "utf8"));
  console.log(f, lits.length, JSON.stringify(lits.slice(0, 10)));
}
