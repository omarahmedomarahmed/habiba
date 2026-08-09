import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/public/blocks";
import { DEFAULT_PAGES } from "@/lib/content/defaults";
import { getPublicPage } from "@/lib/content/service";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  // Prerender the known set from the built-in definitions. Pages an admin adds
  // later are rendered on demand and then cached.
  return DEFAULT_PAGES.filter((p) => p.slug !== "home").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) return {};
  return { title: page.title, description: page.description ?? undefined };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) notFound();

  if (page.layout === "document") {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{page.title}</h1>
        {page.description ? (
          <p className="mt-2 text-[15px] text-slate-500">{page.description}</p>
        ) : null}
        <div className="mt-6 -mx-4 sm:-mx-6">
          <BlockRenderer blocks={page.blocks} slug={slug} />
        </div>
      </article>
    );
  }

  return <BlockRenderer blocks={page.blocks} slug={slug} />;
}
