import { redirect } from "next/navigation";

/**
 * W1-21: hidden until it is rebuilt (FIX-PLAN D4). The page this replaced is
 * `hidden.tsx` beside this file, kept and unreachable. See the note there.
 */
export default function SponsorIntegrationsPage(): never {
  redirect("/sponsor");
}
