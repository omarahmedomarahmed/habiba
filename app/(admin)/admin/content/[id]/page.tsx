import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageEditor } from "@/components/admin/page-editor";
import { requireRole } from "@/lib/auth/guard";
import { getPageById } from "@/lib/content/service";

export const metadata: Metadata = { title: "Edit page", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("super_admin");
  const { id } = await params;

  const page = await getPageById(id);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content"
        className="tap-target -ms-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Site content
      </Link>

      <PageEditor
        pageId={page.id}
        slug={page.slug}
        initial={{
          title: page.title,
          description: page.description ?? "",
          status: page.status,
          blocks: page.blocks,
        }}
      />
    </div>
  );
}
