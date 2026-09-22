/**
 * Every page in the product, every control on it, and whether it does anything.
 *
 *     npm run inventory            # print it
 *     npm run inventory -- --write # …and write docs/INVENTORY.md
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
import { ranDirectly } from "./_verify";

/**
 * 🔴 EVERY PORTAL, NOT JUST THE ADMIN ONE.
 *
 * This started as an admin inventory because the admin side is the one with 32
 * pages and a navigation three rows deep. But every instrument downstream takes
 * its list of places to go from here, and a list that covers one portal
 * produces a crawler that covers one portal.
 *
 * `verify:contrast` learned that the hard way twice: it walked nine therapist
 * pages it had never loaded, and reported `/earnings` as fine while never
 * visiting it, because its paths were a hand typed array rather than a derived
 * one. A hand typed list of routes is wrong the week after it is written.
 */
const PORTALS = [
  { who: "admin", root: "app/(admin)" },
  { who: "therapist", root: "app/(app)" },
  { who: "patient", root: "app/(patient)" },
  { who: "company", root: "app/(sponsor)" },
  { who: "clinic", root: "app/(clinic)" },
  { who: "partner", root: "app/(partner)" },
  { who: "public", root: "app/(public)" },
];

type Control = {
  kind: "form" | "button" | "link" | "select" | "input";
  label: string;
  wiring: string;
  ok: boolean;
};

type Surface = {
  who: string;
  route: string;
  file: string;
  title: string;
  components: string[];
  controls: Control[];
  reads: string[];
};

/**
 * 🔴 EVERY ROUTE THE PRODUCT HAS, for anything that wants to claim one exists.
 *
 * `verify-machines.ts` imports this so that a state machine naming `/earnings`
 * as the screen where a person sees their payout is making a checkable claim
 * rather than a decorative one. The alternative is a second hand-typed route
 * list, and this file's own header says what those are worth.
 */
export function routes(): string[] {
  return routesByPortal().map((r) => r.route);
}

/**
 * 🔴 THE SAME WALK, KEEPING WHO EACH PAGE BELONGS TO.
 *
 * `verify:contrast` needs the public pages specifically, and hand typed its
 * own list of nine. Its own comment says why that is dangerous, in its own
 * words: "A path that is not listed is not measured, and that is the quiet way
 * an audit like this lies. `/earnings` was missing from the first list, so a
 * whole page of money went unlooked at while the run reported green."
 *
 * It knew, and typed the list anyway, which is the argument for deriving it
 * rather than for writing the warning again.
 */
export function routesByPortal(): { who: string; route: string }[] {
  const out: { who: string; route: string }[] = [];
  for (const portal of PORTALS) {
    for (const file of walk(portal.root).filter((f) => f.endsWith("page.tsx"))) {
      out.push({
        who: portal.who,
        route: `/${file
          .replace(`${portal.root}/`, "")
          .replace("/page.tsx", "")
          .replace(/^page\.tsx$/, "")}`,
      });
    }
  }
  return out;
}

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

  /*
   * 🔴 AN ACTION CAN ARRIVE AS A PROP, AND THEN THERE IS NOTHING TO LOOK UP.
   *
   * `useActionState(actions.begin, {})` in `components/ehr/records-panel.tsx`
   * takes its action off a `PanelActions` prop the caller supplies. So does the
   * patient's auth form. A rule that demanded an exported name in this file
   * called four of those dead.
   *
   * A member expression and a destructured prop are wired by construction: the
   * caller provides them and the compiler checks the type. What remains
   * suspicious is a BARE identifier that is not an export, not a dispatch and
   * not a prop of this component, which is the only shape that can really
   * dangle.
   */
  const props = new Set(
    [...s.matchAll(/[{,]\s*(\w+)\s*[,}:]/g)].map((m) => m[1]!),
  );

  /*
   * 🔴 AND A LOCAL THAT IS AN ALIAS FOR REAL ACTIONS.
   *
   * `components/patient/auth-form.tsx` picks its action at render:
   *
   *     const action = mode === "signup" ? patientSignUp : patientSignIn;
   *
   * `action` is not an export, not a dispatch and not a prop, so the rule above
   * still called the patient's sign-in and sign-up forms dead. They are the two
   * doors every patient comes through.
   *
   * A local whose right hand side mentions a known action is an alias for it.
   * That is the last shape, and with it the detector reports nothing dead,
   * which is why the control at the bottom of this file matters more than the
   * number does.
   */
  const aliases = new Set(
    [...s.matchAll(/const\s+(\w+)\s*=\s*([^;\n]+)/g)]
      .filter((m) =>
        (m[2]!.match(/\w+/g) ?? []).some((word) => actions.has(word)),
      )
      .map((m) => m[1]!),
  );

  const reachable = (name: string) =>
    name.includes(".") ||
    actions.has(name) ||
    dispatches.has(name) ||
    props.has(name) ||
    aliases.has(name);

  for (const m of s.matchAll(/<form[^>]*\saction=\{([\w.]+)\}/g)) {
    const name = m[1]!;
    out.push({
      kind: "form",
      label: labelNear(s, m.index),
      wiring: dispatches.has(name) ? `dispatch ${name}` : `action ${name}`,
      ok: reachable(name),
    });
  }

  for (const m of s.matchAll(/useActionState(?:<[^>]*>)?\(\s*([\w.]+)/g)) {
    const name = m[1]!;
    out.push({
      kind: "form",
      label: name,
      wiring: `useActionState ${name}`,
      ok: reachable(name),
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
  /*
   * 🔴 ANY HANDLER, NOT JUST `onClick`, AND THE FIRST RULE FAILED THE ONE
   * BUTTON IT COULD LEAST AFFORD TO.
   *
   * `components/patient/sos-orb.tsx` is the crisis orb: the button a patient
   * presses when somebody is in danger. It is draggable, so it carries
   * `onPointerDown`, `onPointerMove` and `onPointerUp`, and the pointer-up
   * handler is what tells a drag from a tap and opens the sheet. It has no
   * `onClick` at all.
   *
   * A rule that knew only `onClick` reported it as having nothing attached. If
   * that had gone out as a finding it would have read as "the crisis button is
   * dead", which is false and is the most alarming false thing this tool could
   * possibly say.
   *
   * So the test is any React event prop. A button that handles pointers,
   * keys or focus is wired; only a button with no handler of any kind and no
   * submit is not.
   */
  for (const m of s.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = m[1]!;
    const handler = /\bon[A-Z]\w*=/.exec(attrs);
    const submit = /type=["'`]submit/.test(attrs);
    const named = /\bon[A-Z]\w*=\{(?:\(\)\s*=>\s*)?(\w+)/.exec(attrs);
    out.push({
      kind: "button",
      label: labelNear(s, m.index),
      wiring: submit
        ? "submit"
        : handler
          ? `${handler[0].replace("=", "")} ${named?.[1] ?? "inline"}`
          : "NOTHING",
      ok: Boolean(handler) || submit,
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
  const surfaces: Surface[] = [];
  const pages: { file: string; who: string; root: string }[] = [];
  for (const portal of PORTALS) {
    for (const file of walk(portal.root).filter((f) =>
      f.endsWith("page.tsx"),
    )) {
      pages.push({ file, who: portal.who, root: portal.root });
    }
  }

  for (const { file, who, root } of pages.sort((a, b) =>
    a.file.localeCompare(b.file),
  )) {
    const source = readFileSync(file, "utf8");
    const route = `/${file
      .replace(`${root}/`, "")
      .replace("/page.tsx", "")
      .replace(/^page\.tsx$/, "")}`;

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
      who,
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
    "Generated by `npm run inventory`. Do not edit by hand: a hand written",
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
    lines.push(`### \`${s.route}\`, ${s.title}`);
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
    writeFileSync("docs/INVENTORY.md", `${text}\n`);
    console.log("wrote docs/INVENTORY.md");
  }
  console.log(
    `${String(surfaces.length)} pages · ` +
      `${String(surfaces.reduce((n, s) => n + s.controls.length, 0))} controls · ` +
      `${String(dead.length)} with nothing attached`,
  );
  for (const d of dead.slice(0, 20))
    console.log(`  ⚠ ${d.route}  ${d.kind}  ${d.label}`);
}

/*
 * Only walk the whole product when somebody asked for the inventory. Other
 * scripts import `routes()` from here, and an import that prints 125 pages and
 * sets an exit code is an import that breaks the thing importing it.
 */
if (ranDirectly("inventory.ts")) main();
