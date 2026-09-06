/**
 * Is this page laid out in columns? PLAN.md 11R.23, C50.
 *
 * Pure and dependency-free, so the decision that stops a wrong passage
 * reaching a citation is asserted in a test rather than trusted.
 *
 * ## The failure this exists to catch
 *
 * A PDF has no paragraphs. It has glyphs at coordinates, and a text extractor
 * emits them in the order the file happens to store them. For a single-column
 * page that order is the reading order and everything is fine. For a
 * two-column discharge summary it very often is not: the extractor walks each
 * horizontal band left to right, so the first line of the left column is
 * followed by the first line of the *right* column, and the resulting text
 * reads:
 *
 *   "Patient reports low mood        Sertraline 50mg once daily"
 *
 * as one sentence. Chunk that, embed it, cite it as `[D7:3]`, and a clinician
 * reads a dose attached to a symptom that was never next to it. That is C35's
 * lesson again: a confident wrong answer is worse than an admitted gap.
 *
 * ## The heuristic
 *
 * Per page: group items into lines by their y coordinate, and look for a
 * horizontal gap inside a line that is both wide and near the middle of the
 * page. A page where enough lines have one is a page whose reading order we
 * cannot vouch for.
 *
 * ## What it gets wrong, deliberately
 *
 * A wide two-column **table** — a medication list, a results panel — looks
 * exactly like a two-column layout to this function, and is marked
 * unsupported. That is a false positive we accept: the cost is a document
 * stored and honestly labelled "not searchable", and the cost of the other
 * error is a wrong number behind a citation.
 */

export type LayoutItem = {
  /** Left edge, in the PDF's own coordinate space. */
  x: number;
  /** Baseline, origin bottom-left. */
  y: number;
  width: number;
  str: string;
};

/**
 * How wide an internal gap has to be, as a fraction of the page's text width,
 * before it looks like a column boundary rather than a wide word space.
 *
 * Twelve per cent of an A4 text block is about 60pt — roughly ten characters
 * at body size. Ordinary justified text does not produce that.
 */
const GAP_FRACTION = 0.12;

/** The middle band a gap must touch. A hanging indent is at the left margin. */
const MIDDLE_FROM = 0.28;
const MIDDLE_UNTIL = 0.72;

/** Below this, a page has too few lines for the proportion to mean anything. */
const MIN_LINES = 8;

/** The proportion of split lines that makes a page multi-column. */
const SPLIT_RATIO = 0.4;

/**
 * Lines, grouped by baseline.
 *
 * Tolerance is derived from the text itself rather than fixed: a page set in
 * 7pt has tighter leading than one set in 12pt, and a constant that suits one
 * merges every line of the other into a single row.
 */
export function linesOf(items: LayoutItem[]): LayoutItem[][] {
  const real = items.filter((item) => item.str.trim().length > 0);
  if (real.length === 0) return [];

  const ys = [...real].sort((a, b) => a.y - b.y).map((item) => item.y);
  const spread = ys[ys.length - 1]! - ys[0]!;
  const tolerance = Math.max(1, spread / Math.max(1, real.length)) * 1.5;

  const sorted = [...real].sort((a, b) => b.y - a.y);
  const lines: LayoutItem[][] = [];
  let current: LayoutItem[] = [];
  let baseline: number | null = null;

  for (const item of sorted) {
    if (baseline === null || Math.abs(item.y - baseline) <= tolerance) {
      if (baseline === null) baseline = item.y;
      current.push(item);
    } else {
      lines.push(current);
      current = [item];
      baseline = item.y;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines.map((line) => [...line].sort((a, b) => a.x - b.x));
}

/**
 * How many text columns this page appears to have. 1, or 2 meaning "more than
 * one, and we are not going to guess the order".
 */
export function columnCount(items: LayoutItem[]): number {
  const lines = linesOf(items);
  if (lines.length < MIN_LINES) return 1;

  const left = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const width = right - left;
  if (!Number.isFinite(width) || width <= 0) return 1;

  let split = 0;

  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i += 1) {
      const gapFrom = line[i]!.x + line[i]!.width;
      const gapTo = line[i + 1]!.x;
      const gap = gapTo - gapFrom;
      if (gap < width * GAP_FRACTION) continue;

      // The gap has to *touch* the middle band. A wide space after a short
      // heading at the left margin is not a column boundary.
      const from = (gapFrom - left) / width;
      const until = (gapTo - left) / width;
      if (until < MIDDLE_FROM || from > MIDDLE_UNTIL) continue;

      split += 1;
      break;
    }
  }

  return split / lines.length >= SPLIT_RATIO ? 2 : 1;
}

/**
 * The verdict for a whole document.
 *
 * **One** multi-column page makes the document unsupported, not a majority.
 * A ten-page letter with one two-column results table still produces one
 * interleaved passage, and that passage is citable as `[D7:6]` exactly like
 * the nine good ones.
 */
export function isInterleaved(pages: LayoutItem[][]): boolean {
  return pages.some((page) => columnCount(page) > 1);
}
