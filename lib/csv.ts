/**
 * A cell, escaped. Commas, quotes and newlines all survive a round trip.
 *
 * W1-19: and a string a spreadsheet would read as a formula is prefixed with a
 * single quote. A guest name typed into a join link as `=HYPERLINK(...)` would
 * otherwise run in the practice manager's spreadsheet. Numbers are left alone:
 * a negative total is a number, not a formula.
 *
 * W2-S10: moved here from `lib/data/clinic-export.ts`, which re-exports it, so
 * the company's money export escapes its cells with the same function without
 * a company route importing a clinic module.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
