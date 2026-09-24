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
}): FourEyesProblem | null {
  if (input.payeeUserId && input.payeeUserId === input.actorUserId) return "payee";
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
