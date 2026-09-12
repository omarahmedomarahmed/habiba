import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireUser } from "@/lib/auth/guard";
import { saveConnection } from "@/lib/data/meeting-connections";
import type { MeetingProvider } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import { providerSpec } from "@/lib/meetings/providers";

export const dynamic = "force-dynamic";

/**
 * Where the provider sends them back. PLAN.md 41.3.
 *
 * ## 🔴 Three things that must all be true before a token is stored
 *
 *   1. **The state matches**, and matches THIS clinician. Without it the
 *      callback accepts a code anybody could deliver, which means attaching a
 *      stranger's Zoom account to somebody else's sessions.
 *   2. **The signed-in user is the one who started it.** The cookie carries
 *      the user id for exactly this: a code delivered to a different logged-in
 *      session is refused rather than silently connected.
 *   3. **The token can be sealed.** `saveConnection` calls `encryptSecret`,
 *      which throws with no key configured, so a deployment missing
 *      `TOKEN_ENCRYPTION_KEY` fails the connection instead of writing a
 *      refresh token in plaintext.
 *
 * Every failure goes back to the settings page rather than rendering an error
 * page: a clinician who could not connect has lost nothing, because the
 * 24Therapy room already works.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const actor = await requireUser();
  const { provider } = await params;
  const back = `${env.appUrl}/settings/integrations`;

  const spec = providerSpec(provider);
  if (!spec) return NextResponse.redirect(back);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const stored = jar.get(`24t_oauth_${provider}`)?.value ?? "";
  jar.delete(`24t_oauth_${provider}`);

  const [expectedState, startedBy] = stored.split(".");

  /*
   * 🔴 All three, and none of them reports which one failed.
   *
   * "State mismatch" on a screen tells somebody probing exactly how far they
   * got. The clinician sees the same settings page either way and tries again.
   */
  if (!code || !state || state !== expectedState || startedBy !== actor.userId) {
    log.warn("meeting oauth callback refused", { provider });
    return NextResponse.redirect(back);
  }

  try {
    const response = await fetch(spec.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${env.appUrl}/api/meetings/callback/${provider}`,
        client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`] ?? "",
        client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] ?? "",
      }),
    });

    if (!response.ok) {
      log.warn("meeting oauth exchange failed", { provider, status: response.status });
      return NextResponse.redirect(back);
    }

    const body = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!body.access_token) return NextResponse.redirect(back);

    await saveConnection({
      actor,
      provider: provider as MeetingProvider,
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
      /*
       * The account label is fetched separately by each provider and is not
       * worth a round trip on the connect path. Null renders as the date
       * instead, which still answers "which connection is this".
       */
      accountLabel: null,
    });
  } catch (error) {
    log.warn("meeting oauth callback threw", { provider, reason: safeErrorMessage(error) });
  }

  return NextResponse.redirect(back);
}
