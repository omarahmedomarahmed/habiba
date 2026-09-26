import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/public/blocks";
import { DEFAULT_PAGES } from "@/lib/content/defaults";
import { getPublicPage } from "@/lib/content/service";
import type { MessageKey } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";

/*
 * Never on a timer. Only when somebody publishes.
 *
 * This was 3600, which meant one visitor an hour was enough to keep the
 * database awake permanently — the same duty cycle as the cron removed for
 * exactly that reason. The page data is cached until `revalidateTag(CMS_TAG)`
 * runs, which is what the admin editor and /api/revalidate do.
 */
export const revalidate = false;
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
  const shell = await untranslatedShell(slug, page.locale);
  if (shell) return { title: shell.title, description: shell.description ?? undefined };
  return { title: page.title, description: page.description ?? undefined };
}

/**
 * 🔴 B32: AN UNTRANSLATED DOCUMENT IS SAID TO BE ONE, IN THE READER'S LANGUAGE.
 *
 * `/ar/privacy` served the English row, because no Arabic legal row exists,
 * and the reader got an English page under an Arabic header and footer. The
 * binding text of a legal page is not something to machine translate, so the
 * page is framed in the reader's language instead: its title, its one line
 * description, and a notice that the English is binding, with the English
 * text one press away and marked as English. Null when the row is the
 * reader's own language, or the slug has no title in the dictionary.
 */
async function untranslatedShell(slug: string, served: string) {
  const { locale, t } = await getI18n();
  if (served === locale) return null;
  /* Through the resolver, so an operator's wording in /admin/content wins here too. */
  const word = (key: string) => {
    const value = t(key as MessageKey);
    return value && value !== key ? value : null;
  };
  const title = word(`page.title.${slug}`);
  if (!title) return null;
  return {
    title,
    description: word(`page.desc.${slug}`),
    notice: t("page.englishBinding"),
    show: t("page.showEnglish"),
  };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) notFound();

  const shell = page.layout === "document" ? await untranslatedShell(slug, page.locale) : null;
  if (shell) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{shell.title}</h1>
        {shell.description ? <p className="mt-2 text-[15px] text-slate-600">{shell.description}</p> : null}
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
          {shell.notice}
        </p>
        <details className="mt-6">
          <summary className="tap-target cursor-pointer text-sm font-semibold text-brand-700">{shell.show}</summary>
          <div lang="en" dir="ltr" className="mt-4 -mx-4 text-start sm:-mx-6">
            <h2 className="px-4 text-2xl font-bold tracking-tight text-slate-900 sm:px-6">{page.title}</h2>
            <BlockRenderer blocks={page.blocks} slug={slug} />
          </div>
        </details>
      </article>
    );
  }

  if (page.layout === "document") {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{page.title}</h1>
        {page.description ? (
          <p className="mt-2 text-[15px] text-slate-600">{page.description}</p>
        ) : null}
        <div className="mt-6 -mx-4 sm:-mx-6">
          <BlockRenderer blocks={page.blocks} slug={slug} />
        </div>
      </article>
    );
  }

  return <BlockRenderer blocks={page.blocks} slug={slug} />;
}
