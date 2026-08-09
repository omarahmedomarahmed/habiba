import type { Metadata } from "next";

import { NewSessionForm } from "@/components/session/new-session-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listPatients } from "@/lib/data/patients";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "New session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const actor = await requireUser();
  const [{ welcome }, patients] = await Promise.all([searchParams, listPatients(actor)]);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="New session" subtitle="One field, then you are recording." />
      <div className="px-4 pb-10 sm:px-6">
        <NewSessionForm
          welcome={welcome === "1"}
          patients={patients.map((p) => ({
            id: p.id,
            name: fullName(p.firstName, p.lastName, "Unnamed"),
            email: p.email,
          }))}
        />
      </div>
    </div>
  );
}
