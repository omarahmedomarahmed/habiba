/**
 * 🔴 F14, review fix: WHO MAY CAUSE A RESET EMAIL, WITHOUT LETTING A STRANGER
 * LOCK THE OWNER OUT.
 *
 * The first limit was three resets per ADDRESS per hour, silent. Anybody who
 * knew a clinician's email could spend those three and the real person, asking
 * from home, was told "check your inbox" and got nothing for an hour.
 *
 * Two limits replace it, and neither can be spent by somebody else:
 *
 * 1. Per address AND per network (3 an hour). The bucket a stranger fills is
 *    the stranger's own: the owner, on any other network, has a full one.
 * 2. One email per address every `RESET_GAP_SECONDS`, whoever asked. When a
 *    request falls inside that gap, a reset email went to that inbox at most
 *    two minutes ago, and its link (good for an hour, and never cancelled by a
 *    later request) works for the owner. So "check your inbox" is still true:
 *    there is a fresh, working link in it.
 *
 * Email bombing stays bounded: three an hour from any one network, and never
 * more than one every two minutes to any one address, however many networks.
 *
 * Pure apart from the `consume` it is handed, so the attack is a test.
 */

export const RESET_PER_ADDRESS_NETWORK = 3;
export const RESET_PER_ADDRESS_NETWORK_WINDOW_SECONDS = 60 * 60;
export const RESET_GAP_SECONDS = 2 * 60;

export type ResetMailVerdict =
  /** Send a new reset email. */
  | "send"
  /** Do not send: a reset email went to this address within the gap, and its link works. */
  | "recent"
  /** Do not send: this network has asked for this address too often. */
  | "quiet";

export async function resetMailVerdict(input: {
  /** The address, already trimmed and lower-cased. */
  email: string;
  /** An opaque key for the requester's network (already a digest). */
  network: string;
  consume: (key: string, limit: number, windowSeconds: number) => Promise<{ allowed: boolean }>;
  keyOf: (scope: string, subject: string) => string;
}): Promise<ResetMailVerdict> {
  const mine = await input.consume(
    input.keyOf("password-reset:address-network", `${input.email}\n${input.network}`),
    RESET_PER_ADDRESS_NETWORK,
    RESET_PER_ADDRESS_NETWORK_WINDOW_SECONDS,
  );
  if (!mine.allowed) return "quiet";
  const gap = await input.consume(input.keyOf("password-reset:address-gap", input.email), 1, RESET_GAP_SECONDS);
  return gap.allowed ? "send" : "recent";
}
