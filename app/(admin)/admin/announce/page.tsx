import type { Metadata } from "next";

import { AnnouncementComposer } from "@/components/admin/announcement";
import { Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { allTherapistRecipients } from "@/lib/data/admin";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Announce", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AnnouncePage() {
  await requireRole("super_admin");
  const recipients = await allTherapistRecipients();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Announcement</h1>
        <p className="mt-1 text-sm text-slate-500">
          One email to every active clinician. Suspended and deleted accounts are excluded.
        </p>
      </div>

      {!features.email ? (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          RESEND_API_KEY is not set on this deployment, so nothing will actually send.
        </p>
      ) : null}

      <AnnouncementComposer recipientCount={recipients.length} />

      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Recipients · {recipients.length}
        </p>
        {recipients.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No active clinicians yet.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {recipients.map((person) => (
              <li key={person.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-800">
                  {[person.firstName, person.lastName].filter(Boolean).join(" ") || "Unnamed"}
                </span>
                <span className="truncate text-xs text-slate-500">{person.email}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
