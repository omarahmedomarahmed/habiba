import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireUser } from "@/lib/auth/guard";
import { env, features } from "@/lib/env";
import { providerSpec, scopesAreMeetingOnly } from "@/lib/meetings/providers";

export const dynamic = "force-dynamic";

/**
 * Start the OAuth dance. PLAN.md 41.3.
 *
 * A GET that redirects, so the "Connect" control on the settings page is an
 * anchor rather than a form. That is not a styling choice: a form implies a
 * field, and 41.3 is that a therapist never sees an API key. There is no
 * shape of this route that accepts a credential.
 *
 * ## 🔴 The scope check, here rather than only in the registry
 *
 * `scopesAreMeetingOnly` runs before the redirect is built. C132 says no
 * calendar is ever read, and the strongest form of that is an access token
 * that was never granted a calendar scope — a rule a future call site cannot
 * get around, because the permission does not exist on the token.
 *
 * If somebody adds a calendar scope to `PROVIDERS`, this route refuses to
 * start rather than quietly requesting it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const actor = await requireUser();
  const { provider } = await params;

  const spec = providerSpec(provider);
  if (!spec) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  if (!features.meetingBots) {
    return NextResponse.redirect(`${env.appUrl}/settings/integrations`);
  }

  /* 🔴 C132, enforced before a single byte leaves for the provider. */
  if (!scopesAreMeetingOnly(spec)) {
    return NextResponse.json(
      { error: "that provider asks for a scope this product does not request" },
      { status: 500 },
    );
  }

  /*
   * CSRF state, bound to this clinician, in an httpOnly cookie.
   *
   * Without it the callback would accept a code anybody could deliver, and
   * "anybody" here means attaching a stranger's Zoom account to this
   * clinician's sessions. Short-lived because an OAuth round trip is a minute,
   * not a day.
   */
  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set(`24t_oauth_${provider}`, `${state}.${actor.userId}`, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL(spec.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env[`${provider.toUpperCase()}_CLIENT_ID`] ?? "");
  url.searchParams.set("redirect_uri", `${env.appUrl}/api/meetings/callback/${provider}`);
  url.searchParams.set("scope", spec.scopes.join(" "));
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
