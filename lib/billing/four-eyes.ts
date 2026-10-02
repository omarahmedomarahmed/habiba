/**
 * 🔴 W2-A01 / D9: the four-eyes rules, stated once for every manual money queue.
 *
 * The founder opened payouts and verifications to staff (D9), which turns the
 * two-person rule from "two founders" into "two members of a team working the
 * same queue at the same hour". That is only safe if every act on the money
 * asks the same questions, so the payout queue and the refund queue (W1-12)
 * both ask them here rather than each keeping a version:
 *
 *   1. Nobody acts on money they are the payee of.
 *   2. Nobody acts on money sent to details they last edited. Somebody who can
 *      change the destination and then send to it needs no accomplice (C74).
 *   3. Above `settings.payouts.twoPersonThresholdCents`, the act that moves the
 *      money needs a different person to have taken the request on first.
 *
 * Pure, so `tests/admin-access.test.ts` proves each refusal without a database.
 * The database keeps the two C74 constraints on approval as well; this is what
 * gives every other button the same answer.
 */

export type FourEyesProblem = "payee" | "editor" | "second_person";

export function fourEyesProblem(input: {
  actorUserId: string;
  /** Who receives the money. Null when the payee has no account (a guest refund). */
  payeeUserId: string | null;
  /** Who last edited where the money goes, or who opened the request. */
  editorUserId: string | null;
  amountCents: number;
  thresholdCents: number;
  ownerUserId: string | null;
  /** Rule 3 applies only to the act that moves money past the threshold. */
  movesMoney: boolean;
  /**
   * 🔴 0161 / ruling 13 — whether this queue needs two people at all, from
   * `settings.rules.approvals`. Off, only rule 1 is asked: nobody ever acts on
   * money they are the payee of, whatever the switches say.
   */
  twoPeople: boolean;
}): FourEyesProblem | null {
  if (input.payeeUserId && input.payeeUserId === input.actorUserId) return "payee";
  if (!input.twoPeople) return null;
  if (input.editorUserId && input.editorUserId === input.actorUserId) return "editor";
  if (
    input.movesMoney &&
    input.amountCents > input.thresholdCents &&
    (!input.ownerUserId || input.ownerUserId === input.actorUserId)
  ) {
    return "second_person";
  }
  return null;
}

/**
 * 🔴 0188: MAKER AND CHECKER FROM THE TRANSFER TO THE PAYOUT.
 *
 * One person could confirm a bank transfer, approve the payout it funded and
 * send it. With `separate` on (`rules.approvals.payoutSeparation`):
 *
 *   approve  not by anyone who confirmed a transfer behind this payout
 *   send     not by the person who approved it
 *   confirm_not_sent  not by the person who pressed Send for a payout the
 *            provider gave no answer on (it moves `unknown` to `failed`, which
 *            lets the money be sent again)
 *
 * Pure, like the rules above, so each refusal is proved without a database.
 */
export type SeparationProblem = "confirmed_transfer" | "approved_it" | "sent_it";

export function payoutSeparationProblem(input: {
  act: "approve" | "send" | "confirm_not_sent";
  actorUserId: string;
  /** Who confirmed the transfers that paid for the money in this payout. */
  transferConfirmers: readonly (string | null)[];
  approvedByUserId: string | null;
  /** Who pressed Send through the provider, for `confirm_not_sent`. */
  sentByUserId?: string | null;
  separate: boolean;
}): SeparationProblem | null {
  if (!input.separate) return null;
  if (input.act === "confirm_not_sent") {
    return input.sentByUserId && input.sentByUserId === input.actorUserId ? "sent_it" : null;
  }
  if (input.act === "approve" && input.transferConfirmers.includes(input.actorUserId)) return "confirmed_transfer";
  if (input.act === "send" && input.approvedByUserId && input.approvedByUserId === input.actorUserId) {
    return "approved_it";
  }
  return null;
}
