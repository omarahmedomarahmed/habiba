/**
 * A minimal, valid, single-page PDF, built from text placements.
 *
 * Written by hand rather than pulled from a fixture file so the test says what
 * the document *is*: "these strings, at these coordinates". A committed binary
 * would make the two-column case an article of faith.
 *
 * Only what pdf.js needs: a catalog, a pages node, one page with one Type1
 * font, a content stream of `Td`/`Tj` pairs, and a correct xref table.
 */

export type Placement = { x: number; y: number; text: string };

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

export function makePdf(placements: Placement[]): Uint8Array {
  const content = [
    "BT",
    "/F1 11 Tf",
    ...placements.map((p) => `1 0 0 1 ${p.x} ${p.y} Tm (${escapeText(p.text)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/** Parentheses and backslashes are the string delimiters in a content stream. */
function escapeText(text: string): string {
  return text.replace(/([\\()])/g, "\\$1");
}

/** Twenty lines down one column, starting at the left margin. */
export function singleColumn(): Placement[] {
  return Array.from({ length: 20 }, (_, i) => ({
    x: 60,
    y: PAGE_HEIGHT - 80 - i * 18,
    text: `Patient reports low mood and poor sleep, line ${i + 1} of the letter.`,
  }));
}

/**
 * The same twenty lines, plus a second column starting past the middle.
 *
 * This is the discharge summary that breaks a naive extractor: read band by
 * band, "Patient reports low mood" is followed by "Sertraline 50mg daily".
 */
export function twoColumn(): Placement[] {
  return Array.from({ length: 20 }, (_, i) => [
    { x: 60, y: PAGE_HEIGHT - 80 - i * 18, text: `Presenting concern line ${i + 1}` },
    { x: 340, y: PAGE_HEIGHT - 80 - i * 18, text: `Sertraline 50mg daily ${i + 1}` },
  ]).flat();
}
