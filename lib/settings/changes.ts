/**
 * 🔴 0161 — WHAT A SETTINGS SAVE CHANGED, FIELD BY FIELD.
 *
 * `settings_history` keeps the whole value before and after; this turns the
 * pair into lines a person reads ("approvals.payouts true to false"), for the
 * audit row and the history list on the settings screen. Pure, so a verifier
 * can check it without a database.
 */
export function settingsChanges(before: unknown, after: unknown): string[] {
  const out: string[] = [];
  walk("", before, after, out);
  return out;
}

function flat(value: unknown): string {
  if (value === null || value === undefined) return "none";
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(",");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function walk(path: string, before: unknown, after: unknown, out: string[]) {
  if (isPlainObject(before) || isPlainObject(after)) {
    const b = isPlainObject(before) ? before : {};
    const a = isPlainObject(after) ? after : {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
    for (const key of keys) walk(path ? `${path}.${key}` : key, b[key], a[key], out);
    return;
  }
  if (flat(before) !== flat(after)) out.push(`${path || "value"} ${flat(before)} to ${flat(after)}`);
}
