import "server-only";

import { requireUser } from "@/lib/auth/guard";
import type { Actor } from "@/lib/auth/session";

/**
 * 🔴 W1-02: a clinician acting on their ORGANISATION's account: seats, plan,
 * bills, the records connection. Allowed for a solo practice only; see
 * `mayRunOrgAccount`. Kept out of `guard.ts`, which by C264 knows nothing of
 * clinics. Returns the refusal as a sentence rather than throwing,
 * because the callers are server actions with a form state to put it in.
 */
export async function requireOrgAccount(): Promise<{ actor: Actor; refused: string | null }> {
  const actor = await requireUser();
  const { orgKindOf } = await import("@/lib/data/org-kind");
  const { mayRunOrgAccount } = await import("./org-authority");
  if (mayRunOrgAccount(await orgKindOf(actor.organizationId))) return { actor, refused: null };

  const { getI18n } = await import("@/lib/i18n/server");
  const { t } = await getI18n();
  return { actor, refused: t("w1a.clinicRunsAccount") };
}
