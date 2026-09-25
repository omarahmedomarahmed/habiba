/*
 * 🔴 30.1: the CONTROL PLANE, part of signing in.
 */
"use server";

import { redirect } from "next/navigation";

import { landingFor, mayOpen } from "@/lib/admin/access";
import { getI18n } from "@/lib/i18n/server";
import { emailSecondStepCode, passSecondStep } from "./second-factor";
import { getSessionState } from "./session";
import { needsSecondFactor } from "./totp";

export type SecondStepState = { error?: string; sent?: boolean };

/**
 * 🔴 Task 40: the two actions a PENDING back office session may run.
 *
 * These are the only callers in the product of `getSessionState` that act on
 * a session `getActor` would call signed out, and each does exactly one thing
 * for the person it resolves: send them a code, or check the one they typed.
 * Neither reads or writes anything else, and neither accepts a user id from
 * the form: who is asking is the cookie, and nothing else.
 */

async function pendingStaff() {
  const state = await getSessionState();
  if (!state || !needsSecondFactor(state.actor.role)) return null;
  return state;
}

/** Only a console path this role can open, so the step is never an open redirect. */
function destination(role: Parameters<typeof landingFor>[0], next: string): string {
  return next.startsWith("/admin") && mayOpen(role, next) ? next : landingFor(role);
}

export async function sendSecondStepCode(
  _prev: SecondStepState,
  _formData: FormData,
): Promise<SecondStepState> {
  const state = await pendingStaff();
  if (!state) redirect("/staff/sign-in");

  const result = await emailSecondStepCode(state.actor, state.sessionId);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  return { sent: true };
}

export async function verifySecondStep(
  _prev: SecondStepState,
  formData: FormData,
): Promise<SecondStepState> {
  const state = await pendingStaff();
  if (!state) redirect("/staff/sign-in");

  const next = String(formData.get("next") ?? "");
  if (!state.pendingSecondFactor) redirect(destination(state.actor.role, next));

  const code = String(formData.get("code") ?? "").trim().slice(0, 40);
  const result = await passSecondStep(state.actor, state.sessionId, code);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };

  redirect(destination(state.actor.role, next));
}
