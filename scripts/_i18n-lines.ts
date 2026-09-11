/** Ad-hoc: the lines of one file that still carry English, with numbers. */
import { readFileSync } from "node:fs";

import { literalsIn } from "./_i18n-coverage";

const file = process.argv[2]!;
const source = readFileSync(file, "utf8");
const literals = new Set(literalsIn(source).map((text) => text.slice(0, 24)));

source.split("\n").forEach((line, index) => {
  for (const literal of literals) {
    if (line.includes(literal.split(" ").slice(0, 3).join(" "))) {
      console.log(String(index + 1).padStart(4), line);
      break;
    }
  }
});
