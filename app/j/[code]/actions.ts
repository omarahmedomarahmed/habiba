"use server";

import { redirect } from "next/navigation";

import { connectByCode } from "@/lib/data/therapist-codes";
import { requirePatient } from "@/lib/patient-auth/guard";
import { callerKey, consume } from "@/lib/rate-limit";

/**
 * 🔴 W2-P13: a signed-in patient who scans the wall code, connected to its
 * clinician. The person comes from the session; the code is the only thing the
 * form carries, and a dead one connects nothing (`connectByCode`).
 */
export async function connectToTherapist(formData: FormData): Promise<void> {
  const actor = await requirePatient();

  const verdict = await consume(await callerKey("wall-code:connect"), 10, 15 * 60);
  if (verdict.allowed) await connectByCode(String(formData.get("code") ?? ""), actor.personId);

  redirect("/patient");
}
