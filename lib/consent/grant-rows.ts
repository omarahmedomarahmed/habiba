/**
 * 🔴 Board 749: WHO CAN READ THE RECORD NOW, AND WHO COULD BEFORE, APART.
 *
 * "Who has access now" listed every grant a patient ever gave: the live
 * 24-hour one, and beside it three dead rows for the same clinician (one
 * expired, two stopped on the same day) with nothing to tell them apart. The
 * question the heading asks is answered by the live grants alone; ended access
 * is history, one line per clinician (the most recent), and none for a
 * clinician who can read it again now.
 *
 * Pure, so the rule is a test (`tests/board-r3-patient.test.ts`).
 */
export type GrantRow = {
  id: string;
  status: string;
  therapistName: string;
  expiresAt: Date | null;
  decidedAt: Date | null;
  revokedAt: Date | null;
};

export function isLiveGrant(grant: GrantRow, now: number): boolean {
  return grant.status === "granted" && (!grant.expiresAt || grant.expiresAt.getTime() > now);
}

function endedAt(grant: GrantRow): number {
  return (grant.revokedAt ?? grant.expiresAt ?? grant.decidedAt)?.getTime() ?? 0;
}

export function splitGrants<T extends GrantRow>(grants: T[], now: number): { live: T[]; ended: T[] } {
  const live = grants.filter((grant) => isLiveGrant(grant, now));
  const current = new Set(live.map((grant) => grant.therapistName));
  const latest = new Map<string, T>();
  for (const grant of grants) {
    if (isLiveGrant(grant, now) || current.has(grant.therapistName)) continue;
    const seen = latest.get(grant.therapistName);
    if (!seen || endedAt(grant) > endedAt(seen)) latest.set(grant.therapistName, grant);
  }
  return { live, ended: [...latest.values()] };
}
