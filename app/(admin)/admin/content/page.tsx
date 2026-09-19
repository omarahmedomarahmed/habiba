import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink, LayoutGrid } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { listAllPages } from "@/lib/content/service";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Site content", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const actor = await requireRole("super_admin");
  const pages = await listAllPages();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Site content</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every public page is edited here. Publishing takes effect immediately.
        </p>
      </div>

      {/*
       * 🔴 76.79 — THE DOOR TO THE UI REFERENCE, and it is a link rather than
       * an allowlist entry.
       *
       * `verify:reachable` 58.3 reported `/design` as a page no principal can
       * get to, which was true: it is `noindex` and nothing pointed at it. The
       * cheap answer was `PAGES_BY_DESIGN`, and that file's own note says why
       * not — its allowlist was emptied because the one entry in it turned out
       * to be a page a shipped code path did link to, and an exemption that has
       * stopped being needed reads as coverage.
       *
       * The better answer is that an unlinked reference is one nobody opens.
       * Somebody editing a block here is exactly the person who wants to see
       * every component the blocks can render, drawn in its frame, by audience.
       */}
      <Link
        href="/design"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
      >
        <LayoutGrid className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">UI reference</span>
          <span className="block text-xs text-slate-500">
            Every component a block can render, by audience. Not indexed.
          </span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </Link>

      {pages.length === 0 ? (
        <Card className="px-4 py-8 text-center">
          <p className="text-sm text-slate-600">
            No pages yet. The site renders the built-in
            defaults, run <code className="rounded bg-slate-100 px-1">npm run db:seed</code> to
            make them editable.
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
                  {formatDateTime(page.updatedAt, actor.timezone, "en")}
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
