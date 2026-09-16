import "server-only";

import { eq } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { checkQuota, getMessages, getOrCreateThread } from "@/lib/data/copilot";
import { dbFor } from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { users, type Citation } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
 *
 * Lifted from `app/(app)/copilot/[patientId]/page.tsx`, which carried the same
 * pin for the same reason. Moving it here does not add one: the page's own pin
 * goes as this replaces the read it was for.
 */
const db = dbFor(
  pinnedToDefaultRegion(
    "lib/data/copilot-view.ts",
    "not routed yet: this call site has no entity in hand, so 30.x threads one",
  ),
);

/**
 * 🔴 76.39 — EVERYTHING `CopilotChat` NEEDS, ASSEMBLED ONCE.
 *
 * ## Why this exists
 *
 * The copilot thread for a patient is rendered in two places now: its own page
 * at `/copilot/<id>`, and the patient's profile, where a clinician reading a
 * record wants to ask about it without losing their place.
 *
 * Two pages gathering the same six things independently is two places to get
 * the quota wrong, two places to forget the reply language, and eventually two
 * threads. The thread is the patient's, not the page's, so the load is the
 * patient's too.
 *
 * 🔴 `getOrCreateThread` IS THE SCOPE CHECK. It returns null for a patient this
 * actor may not read, which is why every caller can treat null as "not found"
 * rather than doing its own ownership query and hoping the two agree.
 */
export type CopilotView = {
  threadId: string;
  patientFirstName: string;
  patientLastName: string | null;
  replyLanguage: string;
  guidance: string | null;
  quota: { used: number; limit: number };
  voice: string;
  voiceSpeed: number;
  messages: {
    id: string;
    role: "therapist" | "copilot" | "session_note" | "correction";
    content: string;
    citations: Citation[];
    createdAt: string;
  }[];
};

export async function copilotViewFor(
  actor: Actor,
  patientId: string,
): Promise<CopilotView | null> {
  const found = await getOrCreateThread(actor, patientId);
  if (!found) return null;

  const [messages, quota, [me]] = await Promise.all([
    getMessages(actor, found.thread.id),
    checkQuota(actor, found.thread.id),
    db.select({ profile: users.profile }).from(users).where(eq(users.id, actor.userId)).limit(1),
  ]);

  return {
    threadId: found.thread.id,
    patientFirstName: found.patient.firstName,
    patientLastName: found.patient.lastName ?? null,
    replyLanguage: found.thread.replyLanguage,
    guidance: found.thread.guidance,
    quota: { used: quota.used, limit: quota.limit },
    /*
     * The clinician's own voice settings, because the copilot reads aloud and
     * the speed is a preference they set once in settings rather than per
     * patient.
     */
    voice: me?.profile?.voice ?? "british_female",
    voiceSpeed: me?.profile?.voiceSpeed ?? 1,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citations: m.citations,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
