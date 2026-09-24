/**
 * 🔴 A19: WHAT COUNTS AS THE RECEIPT FOR A PAYOUT MARKED SENT.
 *
 * "Mark sent" is where a manual payout leaves the books, and the field beside
 * it is the only evidence the clinician and a later dispute will ever have.
 * It accepted any five characters, so `sent.`, `done!` and `12345` were all a
 * receipt, and a payout marked sent with nothing checkable on it is the state
 * 16.3c says a dispute cannot be settled from.
 *
 * Two shapes are plausible, and anything else is refused:
 *
 *   - A LINK to the receipt: our own upload (`/api/uploads/...`) or an
 *     `https` address with a real host. Never `http`, and never a scheme a
 *     browser would run, because the clinician's earnings page renders it as
 *     a link.
 *   - The BANK'S REFERENCE, as the banking app prints it: 6 to 40 letters,
 *     digits and the separators banks use (`-`, `/`, `.`, `_`), with at least
 *     four digits and at least three different characters. InstaPay, CIB and
 *     NBE references all fit; a word, a date typed as `000000`, or a sentence
 *     does not.
 *
 * "Plausible" is the honest word. Nothing here can prove the transfer
 * happened; it can only refuse what could not be a receipt, so the text on
 * the row is something a person can look up at the bank. Pure, so the
 * clinician's screen can ask the same question to decide link or text.
 */

const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9\-/._]{4,38}[A-Za-z0-9]$/;

/** A receipt the clinician can open, rather than a reference they read. */
export function isReceiptLink(text: string): boolean {
  if (/^\/api\/uploads\/[^\s]+$/.test(text)) return true;
  if (!text.startsWith("https://")) return false;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function plausibleTransferReceipt(raw: string): boolean {
  const text = raw.trim();
  if (isReceiptLink(text)) return true;
  if (!REFERENCE.test(text)) return false;
  const digits = text.replace(/\D/g, "");
  const distinct = new Set(text.replace(/[^A-Za-z0-9]/g, "").toUpperCase()).size;
  return digits.length >= 4 && distinct >= 3;
}
