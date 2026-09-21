/**
 * Every admin page, every control on it, and whether the control does anything.
 *
 *     npm run admin:inventory            # print it
 *     npm run admin:inventory -- --write # …and write docs/ADMIN-INVENTORY.md
 *
 * ## Why this exists
 *
 * The admin side grew to 32 pages, 37 components and 14 action files, and the
 * navigation is three rows deep. Nobody can say from memory what is on it,
 * which of it works, or which of it anybody uses. A redesign that starts by
 * adding a page to that is a redesign that makes it worse.
 *
 * So: before anything moves, an inventory that is DERIVED rather than written,
 * because a hand written one is out of date the day after it is written.
 *
 * ## What counts as "does anything"
 *
 * A control is WIRED when it reaches a server action, submits a form, navigates
 * somewhere, or runs a named client handler. It is DEAD when it is a `<button>`
 * with no `onClick`, no `type="submit"` inside a form, no `formAction`, and no
 * `disabled` explaining itself. A dead button is the exact thing this inventory
 * exists to find, because it looks identical to a working one in a screenshot.
 *
 * 🔴 THIS IS STATIC ANALYSIS AND IT HAS LIMITS, STATED.
 *
 * It reads source. It cannot know whether an action's body is correct, whether
 * a page 500s on real data, or whether a button is reachable behind a
 * capability the reader does not hold. It answers "what is wired to what",
 * which is the question the redesign needs first, and it marks its own
 * uncertainty rather than guessing. `verify:contrast` already proves these
 * pages RENDER; a later pass should prove each control's effect.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const ADMIN = "app/(admin)/admin";

type Control = {
  kind: "form" | "button" | "link" | "select" | "input";
  label: string;
  wiring: string;
  ok: boolean;
};

type Surface = {
  route: string;
  file: string;
  title: string;
  components: string[];
  controls: Control[];
  reads: string[];
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Strip comments so a documented example is not counted as a control. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every exported action in the tree, so a reference can be resolved. */
function actionIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const file of walk("app").concat(walk("lib"))) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const source = code(readFileSync(file, "utf8"));
    for (const m of source.matchAll(
      /export\s+(?:async\s+)?function\s+(\w+)/g,
    )) {
      if (!index.has(m[1]!)) index.set(m[1]!, file);
    }
    for (const m of source.matchAll(/export\s+const\s+(\w+)\s*=/g)) {
      if (!index.has(m[1]!)) index.set(m[1]!, file);
    }
  }
  return index;
}

/** The label a person would read on the control, best effort. */
function labelNear(source: string, at: number): string {
  const after = source.slice(at, at + 600);
  const t = /\{t\(\s*["'`]([^"'`]+)["'`]/.exec(after);
  if (t) return t[1]!;
  const text = />\s*([A-Za-z][^<>{}\n]{2,40}?)\s*</.exec(after);
  if (text) return text[1]!.trim();
  const aria = /aria-label=\{?["'`]([^"'`]+)/.exec(after);
  if (aria) return aria[1]!;
  return "(unlabelled)";
}

function controlsIn(source: string, actions: Map<string, string>): Control[] {
  const out: Control[] = [];
  const s = code(source);

  /*
   * 🔴 A FORM'S `action` IS USUALLY A LOCAL NAME, AND THE FIRST DRAFT CALLED
   * THAT DEAD.
   *
   * `const [state, action] = useActionState(setSalaryAction, {})` then
   * `<form action={action}>` is the standard shape in this codebase. `action`
   * is the dispatch React hands back, not an export, so a rule that demanded an
   * exported name flagged 37 perfectly wired forms as having nothing attached.
   *
   * That number would have been the headline of this inventory and every one of
   * them was wrong. So the dispatch names are collected FIRST, and a form
   * pointing at one of them is wired; what gets checked for existence is the
   * action passed INTO the hook, which is the thing that can actually be
   * missing.
   */
  const dispatches = new Set(
    [
      ...s.matchAll(/const\s*\[[^\]]*?,\s*(\w+)\s*\]\s*=\s*useActionState/g),
    ].map((m) => m[1]!),
  );

  for (const m of s.matchAll(/<form[^>]*\saction=\{(\w+)\}/g)) {
    const name = m[1]!;
    out.push({
      kind: "form",
      label: labelNear(s, m.index),
      wiring: dispatches.has(name) ? `dispatch ${name}` : `action ${name}`,
      ok: actions.has(name) || dispatches.has(name),
    });
  }

  /* And the action the hook was given, which is the one that can be absent. */
  for (const m of s.matchAll(
    /useActionState<[^>]*>?\(\s*(\w+)|useActionState\(\s*(\w+)/g,
  )) {
    const name = (m[1] ?? m[2])!;
    out.push({
      kind: "form",
      label: name,
      wiring: `useActionState ${name}`,
      ok: actions.has(name),
    });
  }

  /* A button with a formAction, which is a second action on one form. */
  for (const m of s.matchAll(/formAction=\{(?:\(\)\s*=>\s*)?(\w+)/g)) {
    out.push({
      kind: "button",
      label: labelNear(s, m.index),
      wiring: `formAction ${m[1]!}`,
      ok: actions.has(m[1]!),
    });
  }

  /*
   * 🔴 EVERY `<button>`, AND WHETHER ANYTHING IS ATTACHED TO IT.
   *
   * This is the check the inventory exists for. A button with no handler, no
   * submit type and no explanation renders exactly like one that works.
   */
  for (const m of s.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = m[1]!;
    const onClick = /onClick=/.test(attrs);
    const submit = /type=["'`]submit/.test(attrs);
    const named = /onClick=\{(?:\(\)\s*=>\s*)?(\w+)/.exec(attrs);
    out.push({
      kind: "button",
      label: labelNear(s, m.index),
      wiring: submit
        ? "submit"
        : onClick
          ? `onClick ${named?.[1] ?? "inline"}`
          : "NOTHING",
      ok: onClick || submit,
    });
  }

  /* Navigation. A link is wired if it has an href at all. */
  for (const m of s.matchAll(/<(?:Link|a)\b[^>]*href=\{?["'`]([^"'`}]+)/g)) {
    out.push({
      kind: "link",
      label: labelNear(s, m.index),
      wiring: m[1]!,
      ok: true,
    });
  }

  return out;
}

/*
 * 🔴 CONTROL — "0 with nothing attached" is the answer to distrust.
 *
 * The first draft of this reported 37 dead controls and every one was a false
 * positive. The fix could just as easily have gone too far the other way and
 * made the detector blind, and a blind detector reports a clean sweep. So the
 * detector is asked about a button that is definitely dead and a form that is
 * definitely wired, every run, and says so on the first line.
 */
function selfTest(actions: Map<string, string>): {
  ok: boolean;
  detail: string;
} {
  const DEAD = `<div><button className="rounded">Delete everything</button></div>`;
  const LIVE = `const [s, act] = useActionState(realAction, {});
                <form action={act}><button type="submit">Save</button></form>`;

  const deadFound = controlsIn(DEAD, actions).some(
    (c) => c.kind === "button" && !c.ok,
  );
  const liveClean = controlsIn(LIVE, new Map([["realAction", "x"]])).every(
    (c) => c.ok,
  );

  return {
    ok: deadFound && liveClean,
    detail: deadFound
      ? liveClean
        ? "catches a button with no handler, and passes a dispatch-wired form"
        : "FALSE POSITIVE: it still calls a wired form dead"
      : "BLIND: a button with no handler went unreported",
  };
}

function main() {
  const actions = actionIndex();

  const control = selfTest(actions);
  console.log(`control: ${control.ok ? "ok  " : "FAIL"} ${control.detail}`);
  if (!control.ok) process.exitCode = 1;
  const pages = walk(ADMIN).filter((f) => f.endsWith("page.tsx"));
  const surfaces: Surface[] = [];

  for (const file of pages.sort()) {
    const source = readFileSync(file, "utf8");
    const route = `/${file.replace(`app/(admin)/`, "").replace("/page.tsx", "")}`;

    const title =
      /title:\s*["'`]([^"'`]+)/.exec(source)?.[1] ??
      /<h1[^>]*>\s*\{?\s*(?:t\(["'`])?([A-Za-z][^<{}"'`]{2,50})/
        .exec(source)?.[1]
        ?.trim() ??
      "(untitled)";

    /* Local components the page pulls in, which is where most controls live. */
    const components = [
      ...code(source).matchAll(/from\s+["']@\/(components\/[^"']+)["']/g),
    ].map((m) => m[1]!);

    let controls = controlsIn(source, actions);
    for (const rel of components) {
      for (const ext of [".tsx", ".ts"]) {
        try {
          controls = controls.concat(
            controlsIn(readFileSync(`${rel}${ext}`, "utf8"), actions),
          );
          break;
        } catch {
          /* Not that extension. */
        }
      }
    }

    /* What the page loads, which says what the page is FOR. */
    const reads = [...code(source).matchAll(/await\s+(\w+)\(/g)]
      .map((m) => m[1]!)
      .filter(
        (n) =>
          !["getI18n", "params", "searchParams", "headers", "cookies"].includes(
            n,
          ),
      );

    surfaces.push({
      route,
      file,
      title,
      components,
      controls,
      reads: [...new Set(reads)],
    });
  }

  const dead = surfaces.flatMap((s) =>
    s.controls.filter((c) => !c.ok).map((c) => ({ route: s.route, ...c })),
  );

  const lines: string[] = [];
  lines.push("# The admin side, as it is");
  lines.push("");
  lines.push(
    "Generated by `npm run admin:inventory`. Do not edit by hand: a hand written",
    "inventory is out of date the day after it is written, which is how this",
    "surface reached 32 pages without anybody being able to describe it.",
    "",
    `**${String(surfaces.length)} pages · ${String(
      surfaces.reduce((n, s) => n + s.controls.length, 0),
    )} controls · ${String(dead.length)} with nothing attached**`,
    "",
    "## What this can and cannot tell you",
    "",
    "It reads source, so it answers *what is wired to what*. It does not know",
    "whether an action's body is correct, whether a page survives real data, or",
    "whether a control sits behind a capability you do not hold. Those need a",
    "browser and a cast, which is a later pass.",
    "",
  );

  if (dead.length) {
    lines.push("## Controls with nothing attached", "");
    lines.push("| Page | Control | Reads |", "| --- | --- | --- |");
    for (const d of dead) {
      lines.push(`| \`${d.route}\` | ${d.kind} | ${d.label} |`);
    }
    lines.push("");
  }

  lines.push("## Every page", "");
  for (const s of surfaces) {
    const wired = s.controls.filter((c) => c.ok).length;
    lines.push(`### \`${s.route}\` — ${s.title}`);
    lines.push("");
    lines.push(`- **file** \`${s.file}\``);
    lines.push(
      `- **controls** ${String(s.controls.length)} (${String(wired)} wired, ${String(
        s.controls.length - wired,
      )} not)`,
    );
    if (s.reads.length)
      lines.push(`- **loads** ${s.reads.map((r) => `\`${r}\``).join(", ")}`);
    if (s.components.length)
      lines.push(
        `- **components** ${s.components.map((c) => `\`${c}\``).join(", ")}`,
      );

    const byKind = new Map<string, string[]>();
    for (const c of s.controls) {
      const key = c.kind;
      if (!byKind.has(key)) byKind.set(key, []);
      byKind.get(key)!.push(`${c.label} → ${c.wiring}${c.ok ? "" : "  ⚠"}`);
    }
    for (const [kind, items] of byKind) {
      lines.push(`- **${kind}** ${String(items.length)}`);
      for (const item of [...new Set(items)].slice(0, 14))
        lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  const text = lines.join("\n");
  if (process.argv.includes("--write")) {
    writeFileSync("docs/ADMIN-INVENTORY.md", `${text}\n`);
    console.log("wrote docs/ADMIN-INVENTORY.md");
  }
  console.log(
    `${String(surfaces.length)} pages · ` +
      `${String(surfaces.reduce((n, s) => n + s.controls.length, 0))} controls · ` +
      `${String(dead.length)} with nothing attached`,
  );
  for (const d of dead.slice(0, 20))
    console.log(`  ⚠ ${d.route}  ${d.kind}  ${d.label}`);
}

main();
