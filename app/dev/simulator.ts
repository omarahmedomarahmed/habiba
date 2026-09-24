import "server-only";

import { env } from "@/lib/env";

/**
 * The simulator's pages exist only where the simulator is switched on and
 * nobody real can reach them: `EGYPT_GATEWAY=fake` or `EGYPT_PAYOUTS=fake`, on
 * anything but the live deployment. Everywhere else they are a 404.
 */
export function simulatorOn(kind: "gateway" | "payouts"): boolean {
  if (env.liveDeployment) return false;
  return (kind === "gateway" ? env.egyptGateway : env.egyptPayouts) === "fake";
}
