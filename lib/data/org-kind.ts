import "server-only";

import { eq } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { organizations, type OrganizationKind } from "@/lib/db/schema";

/** W1-02 — the organisation's kind, or null when there is no such row. */
export async function orgKindOf(organizationId: string): Promise<OrganizationKind | null> {
  const [row] = await controlDb
    .select({ kind: organizations.kind })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row?.kind ?? null;
}
