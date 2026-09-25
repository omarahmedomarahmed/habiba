import "server-only";

import type { MessageKey } from "@/lib/i18n/messages";
import type { Translate } from "@/lib/i18n/server";

import { GENERIC, LOCKED } from "./challenge";
import { HANDLE_TAKEN, INVITE_MISMATCH } from "./claims";

/**
 * The claim modules' refusals, in the reader's language.
 *
 * `lib/data/claims.ts` and `lib/data/challenge.ts` answer in English sentences
 * because verifiers assert on them. The screens that show them go through here,
 * so an Arabic reader is not handed an English refusal at the step where they
 * are most likely to give up (B6, B50). A sentence with no entry passes
 * through unchanged rather than being dropped.
 */
const KEYS: Record<string, MessageKey> = {
  "That record no longer exists.": "pclaim.err.gone",
  "That record has already been claimed.": "pclaim.err.alreadyClaimed",
  "That record does not match a number or address you have confirmed.": "pclaim.err.notMatched",
  "Could not start the claim. Try again.": "pclaim.err.couldNotStart",
  "That code is wrong or has expired. Ask for a new one.": "pclaim.err.wrongCode",
  "That link has expired or has already been used.": "pclaim.err.linkDead",
  "That link has already been used.": "pclaim.err.linkUsed",
  "That record is no longer available.": "pclaim.err.gone",
  [HANDLE_TAKEN]: "pclaim.err.handleTaken",
  [INVITE_MISMATCH]: "pclaim.err.inviteMismatch",
  [GENERIC]: "pclaim.err.noMatch",
  [LOCKED]: "pclaim.err.locked",
};

export function claimError(message: string, t: Translate): string {
  const key = KEYS[message];
  return key ? t(key) : message;
}
