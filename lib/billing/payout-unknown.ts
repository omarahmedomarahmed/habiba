/**
 * A payout left `unknown` (the provider gave no answer to the send) and what
 * asking the provider again found. Pure, so the rules are proved without a
 * database; `lib/billing/payouts.ts` does the asking and the writing.
 */

/**
 * What a re-check found.
 *
 *   answered          the provider has a record (sent, failed or pending)
 *   no_record         the provider answered and has no record of it
 *   provider_changed  a different payouts provider is switched on now
 *   no_provider       no payouts provider is switched on now
 *   no_answer         the provider did not answer (an error or a timeout)
 */
export type RecheckFinding = "answered" | "no_record" | "provider_changed" | "no_provider" | "no_answer";

/** How long "nothing found" runs before the errors board hears of it. Money is never failed on its own. */
export const NO_RECORD_ALERT_HOURS = 72;

export function classifyRecheck(input: {
  sentWith: string | null;
  providerNow: string | null;
  /** The provider's answer: `undefined` when it was not asked. */
  asked?: "record" | "no_record" | "error";
}): RecheckFinding {
  if (!input.providerNow) return "no_provider";
  if (input.sentWith && input.providerNow !== input.sentWith) return "provider_changed";
  if (input.asked === "record") return "answered";
  if (input.asked === "no_record") return "no_record";
  return "no_answer";
}

/**
 * When the run of "nothing found" started. A record resets it; no answer is
 * not evidence either way, so it leaves the clock as it was.
 */
export function nextNoRecordSince(previous: Date | null, finding: RecheckFinding, now: Date): Date | null {
  if (finding === "answered") return null;
  if (finding === "no_answer") return previous;
  return previous ?? now;
}

export function noRecordAlertDue(since: Date | null, now: Date): boolean {
  return since !== null && now.getTime() - since.getTime() >= NO_RECORD_ALERT_HOURS * 3_600_000;
}

/** What the staff action and the audit record say the check found, in plain words. */
export function describeRecheck(finding: RecheckFinding, sentWith: string | null, providerNow: string | null): string {
  switch (finding) {
    case "no_record":
      return `${providerNow ?? "the provider"} has no record of it`;
    case "provider_changed":
      return `sent with ${sentWith ?? "a provider"}, and ${providerNow ?? "another provider"} is switched on now, so it cannot be asked`;
    case "no_provider":
      return `no payouts provider is switched on, so ${sentWith ?? "the provider"} cannot be asked`;
    case "no_answer":
      return `${providerNow ?? "the provider"} did not answer`;
    case "answered":
      return `${providerNow ?? "the provider"} has a record of it`;
  }
}
