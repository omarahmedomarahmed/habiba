/**
 * Sprint 45 acceptance: every string admin editable, on both halves of the app.
 *
 *   npm run verify:sprint45
 *
 * ## What this sprint turned out to be
 *
 * C217 was written from a measurement that said the strings editor writes
 * `ui_strings`, read by four public marketing files, and that every other
 * screen reads `messages.ts`. Three of its four premises were wrong:
 *
 *   - `lib/i18n/strings.ts` imports the dictionary and resolves
 *     `override ?? dictionary ?? en`. The two paths have read each other
 *     since sprint 21.
 *   - `getI18n()` — the universal server resolver — goes through that
 *     resolver, so every server component already honoured an override.
 *   - Arabic was already complete, and `ar: Record<MessageKey, string>`
 *     already made a gap a compile error rather than a blank screen.
 *
 * So 45.1, 45.2 and 45.4 were struck as already built, and what was left was
 * one real defect: **the client provider read the bundled dictionary
 * directly.** Roughly seventy client components — the patient app's whole
 * interactive surface, the room, every form — ignored every admin edit while
 * the fifty-three server ones honoured it. An admin published a change, saw
 * half a page move, and got no error on either half.
 *
 * ## The checks that matter here are the two-sided ones
 *
 * A check that an unpublished draft is invisible passes against a resolver
 * that returns nothing at all. Every absence assertion below is paired with
 * the presence assertion that makes it mean something — the §6 rule in its
 * i18n costume.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { reporter, readSource, required, writesTo } from "./_verify";
import { walk } from "./_i18n-coverage";

const { check, finish } = reporter();

/** A key nobody renders on a critical path, so a stray row cannot hurt. */
const KEY = "tled.patient";
const LOCALE = "en";

async function main() {
  writesTo();

  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const { overridesFor, invalidateStrings } = await import("../lib/i18n/strings");
  const { saveString, publishString, clearString } = await import("../lib/i18n/authoring");
  const { controlDb } = await import("../lib/db");
  const { users } = await import("../lib/db/schema");

  const shipped = DICTIONARIES[LOCALE][KEY];

  /* ------------------------------------------ 45.3 · the client provider -- */

  /*
   * 🔴 The render happens in a CHILD PROCESS, and that is not a workaround.
   *
   * This verifier runs under `--conditions=react-server`, which every sprint
   * verifier needs in order to import the server modules it checks — and which
   * `react-dom/server` refuses to load under, by design. The child renders
   * without that condition, which is also a more honest simulation: the
   * provider is a client component and this is the environment it actually
   * runs in.
   *
   * The alternative was reading `client.tsx` and asserting on its source. That
   * is exactly how this defect survived four sprints: the old provider looked
   * correct, imported the right dictionary and returned a working translator.
   * What it did not do was consult the override layer, and only a render can
   * tell you that.
   */
  const RENDER = String.raw`
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * The app compiles JSX with the automatic runtime, so the client provider has
 * no React import of its own. This child runs outside the app's build, where
 * the classic runtime applies and React.createElement must be reachable by
 * name. Hence the global, set before the dynamic import that needs it.
 */
(globalThis as { React?: unknown }).React = React;

const KEY = ${JSON.stringify(KEY)};

void (async () => {
  const { I18nProvider, useT } = await import(${JSON.stringify(resolve("lib/i18n/client.tsx"))});

  function Word() {
    const t = useT();
    return <span>{t(KEY)}</span>;
  }

  const withOverride = renderToStaticMarkup(
    <I18nProvider locale="en" overrides={{ [KEY]: "OVERRIDDEN-BY-ADMIN" }}>
      <Word />
    </I18nProvider>,
  );

  const withoutOverride = renderToStaticMarkup(
    <I18nProvider locale="en">
      <Word />
    </I18nProvider>,
  );

  process.stdout.write(JSON.stringify({ withOverride, withoutOverride }));
})();
`;

  /*
   * Inside the repository, not in `/tmp`: Node resolves `react` by walking up
   * from the file, and a child in the system temp directory finds no
   * `node_modules` at all. Dot-prefixed and gitignored, removed in a `finally`.
   */
  const dir = mkdtempSync(join(process.cwd(), ".verify-tmp-"));
  let rendered = { withOverride: "", withoutOverride: "" };
  try {
    const file = join(dir, "render.tsx");
    writeFileSync(file, RENDER, "utf8");
    const out = execFileSync(process.execPath, ["--import", "tsx", file], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    rendered = JSON.parse(out) as typeof rendered;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  check(
    "🔴 45.3 a client component renders the admin's override, not the bundled dictionary",
    rendered.withOverride.includes("OVERRIDDEN-BY-ADMIN"),
    rendered.withOverride,
  );

  /*
   * 🔴 CONTROL — and with no override it renders the shipped wording.
   *
   * Without this, the check above passes against a provider that renders
   * whatever it is handed and has lost the dictionary entirely, which would be
   * a worse defect than the one being fixed: every un-overridden key blank.
   */
  check(
    "🔴 CONTROL with no override the same component renders the shipped wording",
    rendered.withoutOverride.includes(shipped) &&
      !rendered.withoutOverride.includes("OVERRIDDEN-BY-ADMIN"),
    `shipped ${JSON.stringify(shipped)}, rendered ${rendered.withoutOverride}`,
  );

  /*
   * The root layout is the only place the two halves are joined, and it must
   * pass overrides in. Source, because there is no way to render a root layout
   * outside a request — but read through `readSource`, so the sentence in the
   * comment explaining the fix cannot be mistaken for the fix (C205, §6).
   */
  const layout = readSource("app/layout.tsx");
  check(
    "45.3 the root layout reads overrides and hands them to the provider",
    /overridesFor\(/.test(layout) && /overrides=\{overrides\}/.test(layout),
    "app/layout.tsx",
  );

  /*
   * 🔴 And it carries the overrides ONLY.
   *
   * The rejected design was serialising a resolved dictionary, which would put
   * 1,536 rows into the RSC payload of every layout and undo the tree-shaking
   * trade `client.tsx:9-17` made on purpose. A regression to that would still
   * pass every check above, because the strings would all be correct. This is
   * the one that would catch it.
   */
  const client = readSource("lib/i18n/client.tsx");
  check(
    "🔴 45.3 the provider layers overrides over the bundled dictionary rather than replacing it",
    /DICTIONARIES\[locale\]/.test(client) && /edited\[key\] \?\? dictionary\[key\]/.test(client),
    "overrides first, dictionary second, English last, the same order as stringsFor",
  );

  /* ----------------------------------- 45.5 · a save is a draft until published -- */

  const admin = required(
    (await controlDb.select({ id: users.id, organizationId: users.organizationId }).from(users).limit(1))[0],
    "user to attribute a string edit to",
  );
  const actor = { userId: admin.id, organizationId: admin.organizationId, role: "super_admin" };

  // Start from a known state, whatever a previous run left behind.
  await clearString({ key: KEY, locale: LOCALE, actor });
  await invalidateStrings();

  const saved = await saveString({ key: KEY, locale: LOCALE, value: "DRAFT-ONLY", actor });
  await invalidateStrings();
  const afterSave = await overridesFor(LOCALE);

  check(
    "🔴 45.5 a save is a draft, and a draft reaches no reader",
    saved.ok === true && afterSave[KEY] === undefined,
    saved.error ?? `overridesFor returned ${JSON.stringify(afterSave[KEY])}`,
  );

  /*
   * 🔴 CONTROL — publishing makes the same value appear.
   *
   * "The draft is invisible" is also true of a resolver that returns an empty
   * object forever, of a save that silently failed, and of a key that does not
   * exist. The check above is worth nothing on its own; this is what makes it
   * an assertion about drafts rather than about nothing.
   */
  const published = await publishString({ key: KEY, locale: LOCALE, actor });
  await invalidateStrings();
  const afterPublish = await overridesFor(LOCALE);

  check(
    "🔴 CONTROL publishing the same row makes it reach readers",
    published.ok === true && afterPublish[KEY] === "DRAFT-ONLY",
    published.error ?? `overridesFor returned ${JSON.stringify(afterPublish[KEY])}`,
  );

  /*
   * 21.5 still holds after all of this: clearing restores the shipped wording
   * rather than blanking the control. It is asserted here because 45.5 added a
   * second state to the same row and a status machine is exactly where a
   * delete stops being a delete.
   */
  await clearString({ key: KEY, locale: LOCALE, actor });
  await invalidateStrings();
  const afterClear = await overridesFor(LOCALE);

  check(
    "45.5 / 21.5 clearing removes the row, so the shipped wording comes back",
    afterClear[KEY] === undefined && DICTIONARIES[LOCALE][KEY] === shipped,
    `shipped wording is still ${JSON.stringify(shipped)}`,
  );

  /* ------------------------------- 45.7 · overridability, the other number -- */

  /*
   * 🔴 45.7 — count what reaches a screen, not what is imported.
   *
   * C157's defect was counting the wrong thing, and C217's was measuring the
   * table rather than the resolver. The literal ratchet in
   * `_i18n-coverage.json` answers "how much English is left"; it says nothing
   * about whether the English that IS translated can be changed by an
   * administrator, which is the entire subject of sprint 45.
   *
   * A component that reads `DICTIONARIES` as a value bypasses the override
   * layer and looks completely correct doing it: right strings, right
   * language, no error, and an admin's edit silently ignored. That was the
   * defect for 72 components until 45.3. Zero is the only acceptable number,
   * because `useT` and `getI18n` both consult overrides and there is no case
   * where bypassing them is right.
   *
   * `type` imports are fine and are not counted: `MessageKey` is erased at
   * build time and naming a key is how a lib module defers to a translator.
   */
  const BYPASSES_RESOLVER =
    /^import\s+(?!type\b)[^;]*\b(?:DICTIONARIES|en|ar)\b[^;]*from\s+["'][^"']*i18n\/messages["']/m;

  const renderedFiles = walk("app").concat(walk("components"));
  const bypassing = renderedFiles.filter((file) => BYPASSES_RESOLVER.test(readSource(file)));

  check(
    "🔴 45.7 every rendered component reads its strings through a resolver that consults overrides",
    renderedFiles.length > 200 && bypassing.length === 0,
    bypassing.length === 0
      ? `${renderedFiles.length} components, none reading the dictionary as a value`
      : bypassing.join(", "),
  );

  /*
   * 🔴 CONTROL — the pattern above is proved against planted offenders.
   *
   * "Zero components bypass the resolver" is exactly what a regex that matches
   * nothing reports, and it would report it forever. These are the two shapes
   * the defect actually takes, plus the two shapes that are fine, because a
   * pattern that also flags the legitimate ones gets switched off within a
   * week.
   */
  const PLANTED = [
    { source: `import { DICTIONARIES } from "@/lib/i18n/messages";`, bypasses: true },
    { source: `import { en, ar } from "@/lib/i18n/messages";`, bypasses: true },
    { source: `import type { MessageKey } from "@/lib/i18n/messages";`, bypasses: false },
    { source: `import { useT } from "@/lib/i18n/client";`, bypasses: false },
  ];
  const wrong = PLANTED.filter((c) => BYPASSES_RESOLVER.test(c.source) !== c.bypasses);

  check(
    "🔴 CONTROL the bypass pattern catches a planted dictionary import and spares a type import",
    wrong.length === 0,
    wrong.length === 0
      ? "2 offenders caught, 2 legitimate imports spared"
      : wrong.map((c) => c.source).join(" · "),
  );

  /*
   * 🔴 45.8 — and the literal ratchet may not rise.
   *
   * Every sprint from 46 to 52 adds copy. This is what makes "added as a
   * MessageKey" a fact rather than an intention: a sentence typed straight
   * into a component moves one of these numbers the moment it is written, and
   * the sprint fails.
   */
  const { scanI18n, bySurface } = await import("./_i18n-coverage");
  const ratchet = JSON.parse(readFileSync("scripts/_i18n-coverage.json", "utf8")) as {
    surfaces: Record<string, number>;
  };
  const now = bySurface(scanI18n());
  const risen = Object.entries(now).filter(
    ([surface, count]) => count > (ratchet.surfaces[surface] ?? 0),
  );

  check(
    "🔴 45.8 no surface has more English in its markup than its high-water mark",
    risen.length === 0,
    risen.length === 0
      ? Object.entries(now)
          .map(([surface, count]) => `${surface} ${count}/${ratchet.surfaces[surface]}`)
          .join(", ")
      : risen.map(([s, c]) => `${s} rose to ${c} from ${ratchet.surfaces[s]}`).join(", "),
  );

  /* ------------------------------------------------- 45.0 · the NUL rule -- */

  check(
    "45.0 / C245 lib/data/facts.ts is text, so grep can read the evidence layer",
    !readFileSync("lib/data/facts.ts").includes(0),
    "verify:nul scans all 524 source files with a planted-NUL control",
  );

  finish("sprint 45");
}

void main();
