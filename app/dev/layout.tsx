import { notFound } from "next/navigation";

import { env } from "@/lib/env";

/**
 * 🔴 EVERY /dev PAGE IS A 404 ON THE LIVE DEPLOYMENT, whatever the page says.
 *
 * Each simulator page already asks `simulatorOn`, which is false there. That
 * is a rule each page has to remember; this is the one it cannot forget, so a
 * /dev page added later without the check is still nothing on 24therapy.app.
 * The payouts desk is also the owner's (`requireRole` on the page), because it
 * answers for a provider and moves a payout. The checkout stays open to the
 * payer it was made for, since that is who a card page serves.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (env.liveDeployment) notFound();
  return <>{children}</>;
}
