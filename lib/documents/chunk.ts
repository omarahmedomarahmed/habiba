/**
 * Turning a document into citable passages. PLAN.md 8.3 / 8.5 / 8.6.
 *
 * Pure, so the two properties that matter can be tested rather than trusted:
 *
 *   1. **Every chunk is findable in the source.** A citation the reader cannot
 *      verify by eye is worse than no citation — it looks like evidence. So
 *      chunking never rewrites, normalises, or summarises; it only cuts.
 *   2. **Numbering is deterministic.** `[D7:3]` written into a copilot answer
 *      last month must still point at the same words. Given the same text,
 *      this returns the same chunks with the same sequence numbers, forever.
 */

/**
 * Roughly a paragraph and a half.
 *
 * Chosen for the reader, not the model: a citation opens to the exact passage
 * (8.6), and a passage should be short enough that somebody can check it in
 * one glance. A 2,000-character chunk is a wall of text with the relevant
 * sentence hidden in it, which is how a citation stops being read.
 */
export const TARGET_CHARS = 700;
/** Never cut below this — a two-word chunk cites nothing. */
export const MIN_CHARS = 120;
/** A hard ceiling, for text with no paragraph or sentence breaks at all. */
export const MAX_CHARS = 1200;

export type Chunk = { sequence: number; text: string };

/**
 * Cut text into chunks, preferring paragraph breaks, then sentence ends.
 *
 * The preference order is the whole design. A cut across a sentence produces a
 * citation that reads as a fragment and, worse, one that can invert a meaning —
 * "no history of self-harm" cut after "history of" is a citation that says the
 * opposite of the document. Sprint 3 learned this on turn boundaries (C35);
 * the same rule applies to prose.
 */
export function chunkText(raw: string): Chunk[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let rest = text;

  while (rest.length > 0) {
    if (rest.length <= MAX_CHARS) {
      chunks.push(rest.trim());
      break;
    }

    const cut = cutPoint(rest);
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  return chunks.filter((t) => t.length > 0).map((text, i) => ({ sequence: i + 1, text }));
}

/**
 * Where to cut, in order of preference.
 *
 * A blank line is a paragraph the author chose. A sentence end is a boundary
 * the language provides. A space is a last resort that at least does not split
 * a word. Cutting mid-word is not an option at all — a chunk beginning "…orbid
 * ideation" is unreadable and unsearchable.
 */
function cutPoint(text: string): number {
  const window = text.slice(0, MAX_CHARS);

  const paragraph = lastIndexAfter(window, /\n\s*\n/g, MIN_CHARS);
  if (paragraph !== null) return paragraph;

  // `.`, `?`, `!`, and their Arabic counterpart `؟`, followed by whitespace.
  // Arabic is the majority language in this product's transcripts; a sentence
  // splitter that only knows ASCII punctuation cuts Arabic text at random.
  const sentence = lastIndexAfter(window, /[.!?؟。]\s/g, MIN_CHARS);
  if (sentence !== null) return sentence;

  const space = window.lastIndexOf(" ");
  if (space > MIN_CHARS) return space;

  return MAX_CHARS;
}

/** The last match ending after `floor`, or null if there is none. */
function lastIndexAfter(text: string, pattern: RegExp, floor: number): number | null {
  let found: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const end = match.index + match[0].length;
    if (end > floor) found = end;
  }
  return found;
}

/* ------------------------------------------------------------ citations -- */

export type DocumentRef = { ordinal: number; sequence: number };

/**
 * `[D7:3]` — document 7 of this person, passage 3.
 *
 * Matched loosely on the way in (lower-case `d`, stray spaces) because the
 * model writes these and will not be perfectly consistent; emitted strictly on
 * the way out.
 */
const CITATION = /\[\s*[Dd]\s*(\d{1,4})\s*:\s*(\d{1,4})\s*\]/g;

export function parseCitations(answer: string): DocumentRef[] {
  const seen = new Set<string>();
  const refs: DocumentRef[] = [];

  for (const match of answer.matchAll(CITATION)) {
    const ordinal = Number(match[1]);
    const sequence = Number(match[2]);
    if (!Number.isFinite(ordinal) || !Number.isFinite(sequence)) continue;
    if (ordinal < 1 || sequence < 1) continue;

    const key = `${ordinal}:${sequence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ ordinal, sequence });
  }

  return refs;
}

export function formatCitation(ref: DocumentRef): string {
  return `[D${ref.ordinal}:${ref.sequence}]`;
}

/**
 * 8.5 — **citations that resolve or are discarded.**
 *
 * A model asked for citations will occasionally invent one. A citation that
 * points at nothing is not a small cosmetic defect: it is a clinician clicking
 * it, seeing an error, and losing the ability to distinguish "the copilot made
 * this up" from "the app is broken". So an unresolvable citation is removed
 * from the answer text entirely, and the answer is left to stand on its own
 * words.
 *
 * Returns the cleaned answer and the refs that survived, so the caller stores
 * only citations it can actually open.
 */
export function keepResolvableCitations(
  answer: string,
  resolves: (ref: DocumentRef) => boolean,
): { answer: string; refs: DocumentRef[] } {
  const kept: DocumentRef[] = [];

  const cleaned = answer.replace(CITATION, (whole, d: string, s: string) => {
    const ref = { ordinal: Number(d), sequence: Number(s) };
    if (!resolves(ref)) return "";
    if (!kept.some((k) => k.ordinal === ref.ordinal && k.sequence === ref.sequence)) {
      kept.push(ref);
    }
    // Normalised on the way out, so the rendered answer is consistent even
    // when the model wrote `[d7 : 3]`.
    return formatCitation(ref);
  });

  // Removing a citation can leave " ." or a double space behind. Tidied here
  // rather than left for the renderer, which would have to know that citations
  // are sometimes deleted.
  const tidy = cleaned
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return { answer: tidy, refs: kept };
}
