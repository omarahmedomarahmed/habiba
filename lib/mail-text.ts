/**
 * 🔴 Board 641: THE PLAIN-TEXT PART OF AN EMAIL, FROM ITS HTML.
 *
 * Every dynamic value in a mail body is escaped for HTML (`esc` in
 * `lib/mail.ts`), which is right in the HTML and wrong anywhere the HTML is read
 * as text: "Helio Health's developer account" arrived as
 * "Helio Health&#39;s developer account" in the text a reader saw. So the text
 * is derived here, once, with every entity `esc` writes turned back into its
 * character (`&amp;` last, so `&amp;lt;` stays the text `&lt;`), and a link
 * keeps its address, since a text reader has no button to press.
 *
 * Pure, so a test holds it.
 */
const NAMED: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(lt|gt|quot|apos|nbsp);/g, (_, name: string) => NAMED[name]!)
    .replace(/&amp;/g, "&");
}

export function htmlToText(html: string): string {
  const withoutHead = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const linked = withoutHead.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, label: string) => {
      /* Still escaped here: the one decode below turns both back. */
      const words = label.replace(/<[^>]+>/g, "").trim();
      return words && words !== href ? `${words}: ${href}` : href;
    },
  );

  const text = linked
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
