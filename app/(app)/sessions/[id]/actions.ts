"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { getSession } from "@/lib/data/sessions";
import { issueIngestToken, revokeIngestToken } from "@/lib/data/session-sources";
import { bindVoice, unbindVoice } from "@/lib/data/session-voices";
import type { VoiceRoleColumn } from "@/lib/db/schema";

export type SessionPanelState = { error?: string; ok?: boolean; token?: string };

/**
 * The session's source and its voices. PLAN.md 51.6, 37R.21, 37R.22, C179.
 *
 * Both tables had a migration, a service, a trigger and no screen. These are
 * the actions behind the two panels that close that, and every one of them
 * re-fetches the session through `getSession` first: the id in the URL is a
 * claim, and `getSession` is the function that decides whether this clinician
 * may act on it.
 */
async function gate(sessionId: string) {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "That session is not in your practice." } as const;
  return { actor, patientId: row.session.patientId ?? null } as const;
}

/**
 * 🔴 36.2 — mint the upload credential, and hand it back exactly once.
 *
 * The token is returned to this one render and stored only as a hash, so the
 * screen says so rather than offering a "show it again" nobody can honour.
 */
export async function issueUploadCredential(sessionId: string): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  try {
    const minted = await issueIngestToken(g.actor, sessionId, g.patientId);
    revalidatePath(`/sessions/${sessionId}`);
    return { ok: true, token: minted.token };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "That credential could not be issued.",
    };
  }
}

export async function revokeUploadCredential(sessionId: string): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  await revokeIngestToken(g.actor, sessionId, g.patientId);
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * A named human says who a voice is. 37.2.
 *
 * 🔴 There is no third option here and there must not be. `bindVoice` writes
 * `bound_by = 'operator'` because a person decided; the only other value the
 * column accepts is `track`, which the recording writes when it already knew.
 * Neither is a model's guess, and this action offers no way to record one.
 */
export async function nameVoice(
  sessionId: string,
  voiceId: string,
  role: VoiceRoleColumn,
): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  await bindVoice(g.actor, {
    voiceId,
    sessionId,
    role,
    patientId: role === "patient" ? g.patientId : null,
    patientRegionId: g.patientId,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * Take a name back off.
 *
 * The `session_voices_unbind_clears_lines` trigger puts every line that
 * claimed that person back to unknown in the same statement, so a correction
 * does not leave a transcript still asserting the thing just corrected.
 * Unbinding is also the only route from one person to another: the no-repoint
 * trigger refuses a direct swap.
 */
export async function unnameVoice(
  sessionId: string,
  voiceId: string,
): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  await unbindVoice(g.actor, { voiceId, sessionId, patientRegionId: g.patientId });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}
