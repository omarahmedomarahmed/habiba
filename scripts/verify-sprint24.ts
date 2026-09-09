/**
 * Sprint 24 acceptance: content law. PLAN.md 24.1-24.6, C113, C117.
 *
 *   npm run verify:sprint24
 *
 * Two rules, both structural, because both are the kind that decay quietly.
 *
 *   - **24.1** No em dash and no en dash in anything a person reads. Source
 *     copy, `content_pages`, `ui_strings`, email bodies, WhatsApp templates.
 *   - **24.2** Nothing under `app/(patient)` may reach `lib/ai/*`, directly or
 *     through anything it imports. A patient never converses with a model.
 *
 * Both are proved against a planted offender of the shape they claim to catch,
 * because a scan that has never found anything has not been shown to work.
 */
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { and, notLike } from "drizzle-orm";

import { db } from "../lib/db";
import { contentPages, uiStrings } from "../lib/db/schema";
import { ALLOWED, dashesIn, dashesInText, EM_DASH } from "./_dashes";
import { reporter } from "./_verify";

const { check, finish } = reporter();

/** Every source file under a directory, at any depth. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/* --------------------------------------------------- 24.2 · the import graph */

/**
 * Does anything reachable from `entry` import `lib/ai`?
 *
 * Transitive on purpose. A direct-import scan proves that no patient page
 * types the import itself, which is the easy half; the way this rule actually
 * breaks is a patient page importing a data module that grows a model call six
 * sprints later. The walk follows relative and `@/` imports and stops at
 * packages, which cannot reach `lib/ai` without going through this repository.
 */
function reachesAi(entry: string): string[] | null {
  const seen = new Set<string>();
  const stack: { file: string; path: string[] }[] = [{ file: entry, path: [entry] }];

  while (stack.length > 0) {
    const { file, path } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    if (/(^|\/)lib\/ai\//.test(file)) return path;

    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const specifier of specifiers) {
      const resolved = resolve(file, specifier);
      if (resolved) stack.push({ file: resolved, path: [...path, resolved] });
    }
  }

  return null;
}

/** `@/lib/x` and `./x` to a file on disk. Packages resolve to nothing. */
function resolve(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? `${from.split("/").slice(0, -1).join("/")}/${specifier}`.replace(/\/\.\//g, "/")
      : null;

  if (!base) return null;

  const normalised: string[] = [];
  for (const part of base.split("/")) {
    if (part === "..") normalised.pop();
    else if (part !== "." && part !== "") normalised.push(part);
  }
  const path = normalised.join("/");

  for (const candidate of [
    path,
    `${path}.ts`,
    `${path}.tsx`,
    `${path}/index.ts`,
    `${path}/index.tsx`,
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  /* ------------------------------------------------------ 24.1 · the source */

  const sources = ["lib", "components", "app", "scripts", "tests"].flatMap(walk);
  const inSource = sources.flatMap((file) => dashesIn(file, readFileSync(file, "utf8")));

  check(
    "🔴 24.1 / C117 no em dash and no en dash in any product copy, comments stripped first",
    inSource.length === 0,
    inSource.length === 0
      ? `${sources.length} source files scanned, ${ALLOWED.length} allowed by name`
      : inSource.slice(0, 4).map((hit) => `${hit.file}:${hit.line} ${hit.text}`).join(" · "),
  );

  /*
   * 🔴 The control, planted as a FILE, because the scan walks directories.
   *
   * A pattern tested against a literal in this script proves the pattern. The
   * offender is written with the character built from its code point, so this
   * file stays clean for its own scan, and it is planted where real copy lives
   * rather than in a fixture directory nothing else reads.
   */
  const planted = "lib/content/_verify24-offender.ts";
  try {
    writeFileSync(planted, `export const copy = "A sentence ${EM_DASH} with a dash in it.";\n`);
    const caught = dashesIn(planted, readFileSync(planted, "utf8"));
    check(
      "🔴 24.1 CONTROL, the same scan CATCHES a dash planted in a copy module",
      caught.length === 1,
      caught[0]?.text ?? "THE SCAN IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  /*
   * …and the other half of the control: a dash inside a COMMENT is not copy,
   * and must not be reported. Without this the rule would be unusable, every
   * explanation in the repository would trip it, and somebody would delete the
   * check rather than the dashes.
   */
  const commented = `/* A comment ${EM_DASH} with a dash. */\nexport const copy = "Clean.";\n`;
  check(
    "24.1 …and a dash in a COMMENT is not reported, comments are for developers",
    dashesIn("lib/content/_comment-control.ts", commented).length === 0,
  );

  /* -------------------------------------------------- 24.1 · the database */

  const pages = await db
    .select({ slug: contentPages.slug, locale: contentPages.locale, blocks: contentPages.blocks })
    .from(contentPages)
    .where(and(notLike(contentPages.locale, "%-x-staging")));

  const inPages = pages.flatMap((page) =>
    dashesInText(`${page.slug}[${page.locale}]`, JSON.stringify(page.blocks)),
  );

  check(
    "🔴 24.1 no published page carries one either, the rows are the copy people actually read",
    inPages.length === 0,
    inPages.map((hit) => hit.file).join(", ") || `${pages.length} pages scanned`,
  );

  const strings = await db
    .select({ key: uiStrings.key, locale: uiStrings.locale, value: uiStrings.value })
    .from(uiStrings);

  const inStrings = strings.flatMap((row) =>
    dashesInText(`${row.key}[${row.locale}]`, row.value),
  );

  check(
    "24.1 …nor any string an admin has overridden",
    inStrings.length === 0,
    inStrings.map((hit) => hit.file).join(", ") || `${strings.length} overrides scanned`,
  );

  /* ------------------------------------------------ 24.2 · patients and models */

  const patientFiles = walk("app/(patient)");
  const leaks = patientFiles
    .map((file) => ({ file, path: reachesAi(file) }))
    .filter((row) => row.path !== null);

  check(
    "🔴 24.2 / C113 nothing under app/(patient) can reach lib/ai, directly or through what it imports",
    leaks.length === 0,
    leaks.length === 0
      ? `${patientFiles.length} patient files walked to their imports`
      : leaks
          .slice(0, 2)
          .map((row) => row.path!.join(" -> "))
          .join(" · "),
  );

  /*
   * 🔴 The control, and it is deliberately INDIRECT.
   *
   * A patient page importing `lib/ai` directly is the version everybody
   * imagines and nobody writes. The way this rule dies is a patient page
   * importing a helper that grows a model call later, so the planted offender
   * is two hops away and the walk has to follow it.
   */
  const helper = "lib/data/_verify24-helper.ts";
  const page = "app/(patient)/patient/_verify24-page.tsx";
  try {
    writeFileSync(helper, `import { MODELS } from "@/lib/ai/client";\nexport const m = MODELS;\n`);
    writeFileSync(page, `import { m } from "@/lib/data/_verify24-helper";\nexport default () => m;\n`);
    const path = reachesAi(page);
    check(
      "🔴 24.2 CONTROL, the walk FINDS a patient page that reaches a model two hops away",
      path !== null && path.length === 3,
      path ? path.join(" -> ") : "THE WALK IS BLIND",
    );
  } finally {
    rmSync(helper, { force: true });
    rmSync(page, { force: true });
  }

  /* ------------------------------------------------------------- 24.3 */

  check(
    "24.3 the clinician's per-patient copilot is named for what it is",
    !sources.includes("lib/ai/patient-copilot.ts") && sources.includes("lib/ai/case-copilot.ts"),
    sources.filter((file) => /copilot/.test(file)).join(", "),
  );

  finish("sprint 24");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
