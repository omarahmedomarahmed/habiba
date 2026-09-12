/** Ad-hoc: which files still carry English, filtered by path fragment. */
import { scanI18n, surfaceOf } from "./_i18n-coverage";

const filter = process.argv[2] ?? "";
let total = 0;

for (const count of scanI18n()) {
  if (count.literals === 0) continue;
  if (filter && !count.file.includes(filter)) continue;
  total += count.literals;
  console.log(
    String(count.literals).padStart(4),
    count.translates ? "t" : " ",
    surfaceOf(count.file).padEnd(7),
    count.file,
  );
}

console.log(`${String(total).padStart(4)}  total`);
