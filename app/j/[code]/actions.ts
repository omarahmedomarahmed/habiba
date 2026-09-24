"use server";

import { redirect } from "next/navigation";

import { connectByCode } from "@/lib/data/therapist-codes";
import type { MessageKey } from "@/lib/i18n/messages";
import { requirePatient } from "@/lib/patient-auth/guard";
import { callerKey, consume } from "@/lib/rate-limit";

/** What the button shows when it did not connect. A dictionary key, said in the reader's language. */
export type ConnectState = { error?: MessageKey };

/**
 * 🔴 W2-P13: a signed-in patient who scans the wall code, connected to its
 * clinician. The person comes from the session; the code is the only thing the
 * form carries, and a dead one connects nothing (`connectByCode`).
 *
 * 🔴 P15: AND A PRESS THAT CONNECTED NOTHING SAYS SO. Both failures, the
 * throttle and a code that no longer connects, used to redirect to `/patient`
 * exactly as a success does, so somebody in front of the poster was told by
 * silence that they had joined a clinician they had not. Only a real
 * connection leaves the page now; anything else comes back as a sentence.
 */
export async function connectToTherapist(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const actor = await requirePatient();

  const verdict = await consume(await callerKey("wall-code:connect"), 10, 15 * 60);
  /* The join form's own sentence for the same limit, so a reader learns one. */
  if (!verdict.allowed) return { error: "join.tooManyAttempts" };

  const connected = await connectByCode(String(formData.get("code") ?? ""), actor.personId);
  if (!connected.ok) return { error: "pcode.connectFailed" };

  redirect("/patient");
}
