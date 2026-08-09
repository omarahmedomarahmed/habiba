import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { listAllPages } from "@/lib/content/service";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Site content", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requireRole("super_admin");
  const pages = await listAllPages();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Site content</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every public page is edited here. Publishing takes effect immediately.
        </p>
      </div>

      {pages.length === 0 ? (
        <Card className="px-4 py-8 text-center">
          <p className="text-sm text-slate-600">
            No pages in the database yet. The public site is currently rendering the built-in
            defaults — run <code className="rounded bg-slate-100 px-1">npm run db:seed</code> to
            import them so they become editable.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center gap-3 px-4 py-3.5">
              <Link href={`/admin/content/${page.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{page.title}</p>
                <p className="truncate text-xs text-slate-500">
                  /{page.slug === "home" ? "" : page.slug} · updated{" "}
                  {formatDateTime(page.updatedAt)}
                </p>
              </Link>

              <Badge tone={page.status === "published" ? "green" : "amber"}>{page.status}</Badge>

              <Link
                href={page.slug === "home" ? "/" : `/${page.slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${page.title}`}
                className="tap-target flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>

              <Link
                href={`/admin/content/${page.id}`}
                aria-label={`Edit ${page.title}`}
                className="tap-target flex items-center justify-center text-slate-300"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
