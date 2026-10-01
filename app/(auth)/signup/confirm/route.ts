import { NextResponse } from "next/server";

import { consumeSignupLink } from "@/lib/auth/signup-link";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F14: the welcome email's link. Signs the new clinician in once and goes on to
 * verification; a used, expired or foreign token goes to sign in with a sentence
 * saying so, and nothing about which of the three it was.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = await consumeSignupLink(token);
  const to = userId ? "/onboarding?welcome=1" : "/login?link=1";
  return NextResponse.redirect(new URL(to, env.appUrl || request.url), { status: 303 });
}
