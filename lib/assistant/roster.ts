/**
 * Turning names in an answer into links. PLAN.md 10.3.
 *
 * > Patient names as links, **validated server-side against the real roster**
 * > so a hallucinated name can never become one.
 *
 * Pure, so the rule can be tested rather than trusted. The rule itself is one
 * sentence: **a link exists only where the text matches a roster entry the
 * server supplied.** The model's output is treated as prose, never as data —
 * it is not asked for links, it is not asked for ids, and nothing it writes is
 * parsed as a reference.
 *
 * ## Why this direction and not the other
 *
 * The obvious design is to ask the model for `[[patient:uuid]]` markers and
 * resolve them. That fails in the way that matters: a model that invents a
 * uuid produces a broken link, and a model that invents a *plausible* one
 * produces a link to the wrong patient. Matching the other way round —
 * scanning the answer for names we already know — cannot produce a link to
 * somebody who is not on the roster, because the only ids in play came from
 * the roster in the first place.
 */

export type RosterEntry = { patientId: string; name: string };

export type Span =
  { kind: "text"; text: string } | { kind: "link"; text: string; patientId: string };

/**
 * Split an answer into text and links.
 *
 * Longest name first, so "Sara Mahmoud" wins over "Sara" when both are on the
 * roster — otherwise the longer name renders as a link to the wrong person
 * followed by a stray surname.
 *
 * Matching is case-insensitive and requires a boundary on both sides, so
 * "Sam" does not light up inside "Samir". Boundaries are checked against
 * letters and digits in **any** script: a JavaScript `\b` is ASCII-only, and
 * this product's roster is largely Arabic.
 */
export function linkRoster(answer: string, roster: RosterEntry[]): Span[] {
  const entries = roster
    .filter((entry) => entry.name.trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length);

  if (entries.length === 0) return answer ? [{ kind: "text", text: answer }] : [];

  const spans: Span[] = [];
  let rest = answer;

  outer: while (rest.length > 0) {
    let best: { at: number; entry: RosterEntry } | null = null;

    for (const entry of entries) {
      const at = indexOfName(rest, entry.name);
      if (at === -1) continue;
      // Earliest match wins; ties go to the longer name, which is already
      // first in the sorted list.
      if (!best || at < best.at) best = { at, entry };
    }

    if (!best) break outer;

    if (best.at > 0) spans.push({ kind: "text", text: rest.slice(0, best.at) });
    spans.push({
      kind: "link",
      // The text as it appears in the answer, not the roster's spelling — a
      // link that silently rewrites what the sentence said is a link that
      // makes the sentence untrue.
      text: rest.slice(best.at, best.at + best.entry.name.length),
      patientId: best.entry.patientId,
    });
    rest = rest.slice(best.at + best.entry.name.length);
  }

  if (rest.length > 0) spans.push({ kind: "text", text: rest });
  return spans;
}

/** The links a given answer produces, deduplicated. Stored on the message. */
export function mentionsIn(answer: string, roster: RosterEntry[]): RosterEntry[] {
  const seen = new Set<string>();
  const out: RosterEntry[] = [];

  for (const span of linkRoster(answer, roster)) {
    if (span.kind !== "link") continue;
    if (seen.has(span.patientId)) continue;
    seen.add(span.patientId);
    const entry = roster.find((r) => r.patientId === span.patientId);
    if (entry) out.push(entry);
  }

  return out;
}

/**
 * Case-insensitive `indexOf` that requires a word boundary on both sides.
 *
 * `\b` in JavaScript is defined against `[A-Za-z0-9_]`, so every Arabic letter
 * counts as a boundary and "سارة" would match inside a longer word. This
 * checks the neighbouring characters against a Unicode letter/digit class
 * instead, which behaves the same way in both scripts.
 */
function indexOfName(haystack: string, name: string): number {
  const lowerHay = haystack.toLowerCase();
  const lowerName = name.toLowerCase();

  let from = 0;
  for (;;) {
    const at = lowerHay.indexOf(lowerName, from);
    if (at === -1) return -1;

    const before = at === 0 ? "" : haystack[at - 1]!;
    const afterIndex = at + name.length;
    const after = afterIndex >= haystack.length ? "" : haystack[afterIndex]!;

    if (!isWordChar(before) && !isWordChar(after)) return at;
    from = at + 1;
  }
}

function isWordChar(char: string): boolean {
  if (!char) return false;
  return /[\p{L}\p{N}]/u.test(char);
}
