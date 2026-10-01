/*
 * 🔴 30.1: the CONTROL PLANE, part of signing in.
 */
"use server";

import { redirect } from "next/navigation";

import { staffDestination } from "@/lib/admin/access";
import { getI18n } from "@/lib/i18n/server";
import { safeNext } from "./safe-redirect";
import { beginEnrolment, confirmEnrolment, passSecondStep } from "./second-factor";
import { getSessionState, type SessionState } from "./session";
import { needsSecondFactor } from "./totp";

export type SecondStepState = { error?: string };
export type StepEnrolState = { error?: string; recoveryCodes?: string[]; next?: string };

/**
 * 🔴 Task 40: the actions a PENDING session may run.
 *
 * These are the only callers in the product of `getSessionState` that act on
 * a session `getActor` would call signed out, and each does exactly one thing
 * for the person it resolves: check the code they typed, or (a back office
 * member with no app yet, DD-2 B2.3) enrol one. Neither accepts a user id from
 * the form: who is asking is the cookie, and nothing else.
 */

async function pending(): Promise<SessionState | null> {
  const state = await getSessionState();
  if (!state || !state.pendingSecondFactor) return null;
  return state;
}

/** Only a path this person can open, so the step is never an open redirect. */
async function destination(state: SessionState, next: string): Promise<string> {
  if (needsSecondFactor(state.actor.role)) return staffDestination(state.actor.role, next);
  /* A clinician with an app (DD-2 B2.4): where sign-in would have sent them. */
  const { practiceState, isCleared } = await import("@/lib/data/verification");
  return isCleared(state.actor, await practiceState(state.actor.userId)) ? safeNext(next, "/dashboard") : "/onboarding";
}

export async function verifySecondStep(
  _prev: SecondStepState,
  formData: FormData,
): Promise<SecondStepState> {
  const next = String(formData.get("next") ?? "");
  const state = await getSessionState();
  if (!state) redirect("/staff/sign-in");
  if (!state.pendingSecondFactor) redirect(await destination(state, next));

  const code = String(formData.get("code") ?? "").trim().slice(0, 40);
  const result = await passSecondStep(state.actor, state.sessionId, code);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };

  redirect(await destination(state, next));
}

/** DD-2 B2.3: a back office member with no app is enrolled here, before anything else. */
export async function startStepEnrolment(_prev: StepEnrolState, _formData: FormData): Promise<StepEnrolState> {
  const state = await pending();
  if (!state || !needsSecondFactor(state.actor.role)) redirect("/staff/sign-in");
  const result = await beginEnrolment(state.actor);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/staff/second-step");
  return {};
}

export async function finishStepEnrolment(_prev: StepEnrolState, formData: FormData): Promise<StepEnrolState> {
  const state = await pending();
  if (!state || !needsSecondFactor(state.actor.role)) redirect("/staff/sign-in");
  const result = await confirmEnrolment(state.actor, state.sessionId, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  /* The codes go back in the answer and nowhere else, shown once. */
  return { recoveryCodes: result.recoveryCodes, next: await destination(state, String(formData.get("next") ?? "")) };
}
