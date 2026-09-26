import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PARTNER_COOKIE, orgBounce } from "@/lib/routing";
import { getPartnerActor, type PartnerActor } from "./session";

/**
 * The partner authorization boundary. PLAN.md 55.2, 55.3, C264.
 *
 * Mirrors `requireSponsor`, and for the same reason: middleware runs on the edge with no
 * database, so it can see that a cookie exists and nothing else. Every partner page and
 * action calls this.
 *
 * ## 🔴 IT RETURNS A `PartnerActor`, AND THAT TYPE CANNOT BECOME AN `Actor`
 *
 * No organisation id of any spelling, no clinical `Role`. So there is no call site
 * anywhere that could pass the result of this function to `getPatient`, `listPatients`,
 * `getSession` or anything else that scopes on clinical tenancy: not because a guard
 * refuses, but because the shape does not fit and the compiler says so.
 *
 * That is 55.3 from the other end. The reason a therapist never sees an API key is that
 * keys live behind this function, and the reason a partner never reads a chart is that
 * this function hands back nothing a chart query accepts.
 */
export async function requirePartner(): Promise<PartnerActor> {
  const actor = await getPartnerActor();
  if (!actor) {
    /*
     * 🔴 Board 249 / 327 / 330: never straight to the door while a cookie is
     * still held. Middleware sends a cookie holder at the sign-in page home
     * again, which lands here again, forever. `orgBounce` says why.
     */
    const hasCookie = Boolean((await cookies()).get(PARTNER_COOKIE)?.value);
    redirect(orgBounce("partner", hasCookie));
  }
  return actor;
}

/**
 * 🔴 Only an admin mints, revokes or registers. A developer reads.
 *
 * The same split as the sponsor's, drawn at the same place: reading a list of key
 * prefixes and a delivery log is what somebody debugging an integration needs, and
 * minting a live key that can ask about real people is the one act with a customer at
 * the other end of it. C265's suspension is a real cost to be able to cause by accident.
 */
export async function requirePartnerAdmin(): Promise<PartnerActor> {
  const actor = await requirePartner();
  if (actor.role !== "admin") redirect("/partner");
  return actor;
}
