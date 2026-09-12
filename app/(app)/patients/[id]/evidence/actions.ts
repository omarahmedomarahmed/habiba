"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { disputeFact, verifyFact } from "@/lib/data/facts";
import { accessFor } from "@/lib/data/grants";
import { getPatient } from "@/lib/data/patients";
import { ensurePersonForPatient } from "@/lib/data/people";

export type FactActionState = { error?: string; ok?: boolean };

/**
 * Agreeing and disagreeing with what the system believes. PLAN.md 33.6.
 *
 * Gated exactly like homework and documents: a clinician whose access has
 * ended may not change the clinical record. Verification in particular is the
 * act that turns a model's output into something the product will state
 * plainly, so it is the last thing that should be reachable by somebody the
 * patient has revoked.
 */
async function gate(patientId: string) {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." } as const;

  const access = await accessFor(actor, patientId);
  if (access.state === "revoked") {
    return { error: "This person has not granted you access to their record." } as const;
  }

  const personId = await ensurePersonForPatient(patientId);
  if (!personId) return { error: "That patient no longer exists." } as const;

  return { actor, personId } as const;
}

export async function confirmFact(patientId: string, factId: string): Promise<FactActionState> {
  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  await verifyFact(g.actor, factId, g.personId);
  revalidatePath(`/patients/${patientId}/evidence`);
  return { ok: true };
}

/**
 * 🔴 A reason is required, and it is not decoration.
 *
 * `disputed` is a state the next clinician will read, and "somebody disagreed
 * with this in March" without a sentence explaining why is worse than the fact
 * itself: it leaves the reader with a flag and no way to act on it. The reason
 * goes to the audit log rather than onto the fact, because the fact's own
 * words are immutable by design.
 */
export async function rejectFact(
  patientId: string,
  factId: string,
  reason: string,
): Promise<FactActionState> {
  if (reason.trim().length < 3) {
    return { error: "Say briefly why, so the next clinician reading this knows." };
  }

  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  await disputeFact(g.actor, factId, g.personId, reason.trim());
  revalidatePath(`/patients/${patientId}/evidence`);
  return { ok: true };
}
