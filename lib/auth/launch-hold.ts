import "server-only";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { env } from "@/lib/env";
import type { Actor } from "./session";
import { AuthorizationError } from "./guard";

/** A clinician session opened by a partner launch link (F6). */
export function isLaunchedSession(actor: Actor): boolean {
  return Boolean(actor.partnerScope);
}

/**
 * 🔴 F6: the restriction on a partner-opened session, on every page and action
 * that comes through `requireUser` (which is all of them: `requireRole`,
 * `requireVerified` and the staff guards call it). See `lib/partner/launch-scope.ts`.
 */
export async function holdLaunchedSession(actor: Actor): Promise<void> {
  const { LAUNCH_LANDING, patientInLaunchScope, scopedRoute, scopeVerdict, validScopeSignature } =
    await import("@/lib/partner/launch-scope");
  const hdrs = await headers();
  const path = hdrs.get("x-pathname") ?? "";
  const method = (hdrs.get("x-request-method") ?? "").toUpperCase();
  /*
   * Believed only when middleware signed them. `/api/` skips middleware, so an
   * unsigned path or method is a caller's own claim: treated as an API call.
   */
  const signed = validScopeSignature({ method, path, signature: hdrs.get("x-scope-sig"), secret: env.authSecret });
  const route = signed ? scopedRoute(path) : null;
  const verdict = scopeVerdict({
    path,
    /* A POST without JS has no `next-action` header, so the method decides too. */
    isAction: Boolean(hdrs.get("next-action")) || !["GET", "HEAD"].includes(method),
    isApi: !signed || path.startsWith("/api/"),
    patientInScope:
      route?.kind === "patient"
        ? await patientInLaunchScope({
            partnerId: actor.partnerScope!.partnerId,
            userId: actor.userId,
            patientId: route.patientId,
          })
        : null,
  });
  if (verdict === "admit") return;
  if (route?.kind === "landing") throw new AuthorizationError("A launched session is read only");
  redirect(LAUNCH_LANDING);
}
