import type { Metadata } from "next";

import { TeamManager } from "@/components/admin/team-manager";
import { requireRole } from "@/lib/auth/guard";
import { listBackOffice } from "@/lib/data/admin-team";

export const metadata: Metadata = { title: "Team", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-A06: who can open the console, and a way to change it.
 *
 * The settings page could add a member with a password the owner typed, and
 * nothing else: no list, no role change, and a leaver kept access until
 * somebody edited the database. The owner's page, because who may reach the
 * money is the owner's decision.
 */
export default async function TeamPage() {
  const actor = await requireRole("super_admin");
  const members = await listBackOffice();
  return <TeamManager members={members} actorUserId={actor.userId} />;
}
