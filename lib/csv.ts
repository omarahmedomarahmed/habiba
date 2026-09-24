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
  /*
   * T12: a string that is exactly a two-place decimal (`-12.50`, from the clinic
   * export's `amount`) is a number that kept its second decimal place, not a
   * formula, so it is left alone. Anything with an operator after the sign
   * (`-1+2`, `-12.50+1`) still gets the quote.
   */
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^-?\d+\.\d{2}$/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
