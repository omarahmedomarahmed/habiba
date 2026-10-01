/**
 * The pure half of `content:rename`: one exact phrase replaced in the copy of a
 * block tree, never in a link, an image, an id or a block's kind.
 */
import { NON_COPY_KEYS } from "../lib/content/claims";

/** The claims guard's list, and the link, image and id keys it has no need to name. */
export const RENAME_SKIPS: ReadonlySet<string> = new Set([...NON_COPY_KEYS, "href", "url", "src", "image", "id"]);

export function renameIn(value: unknown, from: string, to: string, count: { n: number }): unknown {
  if (typeof value === "string") {
    if (!value.includes(from)) return value;
    count.n += value.split(from).length - 1;
    return value.split(from).join(to);
  }
  if (Array.isArray(value)) return value.map((v) => renameIn(v, from, to, count));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, RENAME_SKIPS.has(k) ? v : renameIn(v, from, to, count)]),
    );
  }
  return value;
}

/** Block types and keys, with every string the same: a rename may change nothing else. */
export function shapeOf(blocks: readonly { type: string }[]): string {
  const keys = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(keys)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keys(x)]))
        : typeof v === "string"
          ? "s"
          : v;
  return JSON.stringify(blocks.map((b) => [b.type, keys(b)]));
}
