"use server";

import { revalidatePath } from "next/cache";

import { mute, unmute } from "@/lib/data/checkins";
import { requirePatient } from "@/lib/patient-auth/guard";

/**
 * 🔴 44.1 / C97 — THE OPT-OUT AS A SCREEN, beside the opt-out as a reply.
 *
 * Two ways to stop, because the two kinds of person are different. Somebody who has had enough
 * replies "stop" to the message in front of them; somebody deciding calmly comes to a screen. C97
 * asks for *an opt-out*, and one route to it would have been enough to satisfy the words and not the
 * person.
 *
 * 🔴 `via: "screen"` rather than `"reply"`, and the distinction is the measurement: a mute rate that
 * mixed a person who had had enough with a person making a settings choice would hide the number the
 * founder asked for.
 */
export async function setCheckins(on: boolean): Promise<{ ok: true }> {
  const actor = await requirePatient();

  if (on) await unmute(actor.personId);
  else await mute(actor.personId, "screen");

  revalidatePath("/patient/messages");
  return { ok: true };
}
