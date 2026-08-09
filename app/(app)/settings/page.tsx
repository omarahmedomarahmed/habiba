import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { SettingsForms } from "@/components/settings/settings-forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const actor = await requireUser();

  const [user] = await db.select().from(users).where(eq(users.id, actor.userId)).limit(1);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle={actor.email} />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <SettingsForms
          initial={{
            firstName: user?.firstName ?? "",
            lastName: user?.lastName ?? "",
            credentials: user?.profile?.credentials ?? "",
            licenseType: user?.profile?.licenseType ?? "",
            licenseNumber: user?.profile?.licenseNumber ?? "",
            licenseState: user?.profile?.licenseState ?? "",
          }}
          isAdmin={actor.role === "super_admin"}
        />

        {actor.role === "super_admin" ? (
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">Admin console</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage clinicians, review the audit log and edit the public site.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white"
            >
              Open admin
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
