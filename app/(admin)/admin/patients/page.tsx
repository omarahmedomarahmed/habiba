import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";

import { ListControls } from "@/components/admin/list-controls";
import { Card, PageHeader } from "@/components/ui";
import { likePattern, pageOf, paging, searchTerm } from "@/lib/admin/paging";
import { requireStaff } from "@/lib/auth/guard";
import { controlDb as db } from "@/lib/db";
import { patientAccounts, people } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Patients", robots: { index: false } };

/**
 * 🔴 25 September inventory: a patient's account page existed and was reachable
 * only from a link in the transfer queue. Support needs to find a person by the
 * email or phone they give on the call. Account details only: nothing clinical
 * is read here, the same boundary the account page keeps.
 */
export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const q = searchTerm(params.q);
  const { page, offset, fetch } = paging(params);

  const pattern = q ? likePattern(q) : null;
  const fetched = await db
    .select({
      id: patientAccounts.id,
      email: patientAccounts.email,
      phone: patientAccounts.phone,
      firstName: people.firstName,
      lastName: people.lastName,
    })
    .from(patientAccounts)
    .leftJoin(people, eq(people.id, patientAccounts.personId))
    .where(
      pattern
        ? or(
            ilike(patientAccounts.email, pattern),
            ilike(patientAccounts.phone, pattern),
            ilike(people.firstName, pattern),
            ilike(people.lastName, pattern),
          )
        : undefined,
    )
    .orderBy(desc(patientAccounts.createdAt))
    .limit(fetch)
    .offset(offset);
  const { rows, hasMore } = pageOf(fetched);

  return (
    <div className="space-y-5">
      <PageHeader title="Patients" subtitle="Find an account by email, phone or name." />
      <ListControls base="/admin/patients" params={{}} q={q} page={page} hasMore={hasMore} />
      <Card className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No account matches.</p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/patients/${row.id}`}
              className="flex flex-wrap items-baseline justify-between gap-2 p-4 text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">
                {[row.firstName, row.lastName].filter(Boolean).join(" ") || "No name yet"}
              </span>
              <span className="text-slate-600">{[row.email, row.phone].filter(Boolean).join(" · ")}</span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
