/**
 * 🔴 Board 276: the channel a proving code reached, and whether it reached any.
 *
 * The claim page said "WhatsApp codes are not on yet, ask your therapist for an
 * invite link" whenever the account had a number, even when the code had gone
 * to their email instead (WhatsApp is not on, ruling 23). What the page says
 * now comes from where the code went. Pure, so the rule is a test
 * (`tests/board-care.test.ts`).
 */
export function handleDelivery(
  meant: "whatsapp" | "email",
  reached: readonly string[],
): { channel: "whatsapp" | "email"; channelDown: boolean } {
  if (reached.includes("whatsapp")) return { channel: "whatsapp", channelDown: false };
  if (reached.includes("email")) return { channel: "email", channelDown: false };
  return { channel: meant, channelDown: true };
}
