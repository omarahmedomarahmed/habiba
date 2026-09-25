import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChevronDown } from "lucide-react";

import { BlockRenderer } from "@/components/public/blocks";
import { ContentIconMark } from "@/components/public/icons";
import { DarkBand, Eyebrow, Glow } from "@/components/public/site-ui";
import { DEFAULT_PAGES } from "@/lib/content/defaults";
import { getPublicPage } from "@/lib/content/service";
import { DICTIONARIES } from "@/lib/i18n/messages";
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
  const words = DICTIONARIES[locale] as Record<string, string>;
  const title = words[`page.title.${slug}`];
  if (!title) return null;
  return {
    title,
    description: words[`page.desc.${slug}`] ?? null,
    notice: t("page.englishBinding"),
    show: t("page.showEnglish"),
  };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) notFound();

  /*
   * 🔴 A DOCUMENT OPENS ON ONE HEADING, NOT TWO.
   *
   * A legal page's first block is a `hero` whose heading is the page title
   * again, and it rendered as a second `h1` under the first. The dark band at
   * the top now carries the title, and the hero's eyebrow and icon with it, so
   * nothing the row holds is lost and the reader meets the title once. The
   * rest of the blocks follow on white, at reading width.
   */
  const [lead, ...rest] = page.blocks;
  const leadHero = page.layout === "document" && lead?.type === "hero" ? lead : null;
  const body = leadHero ? rest : page.blocks;

  const shell = page.layout === "document" ? await untranslatedShell(slug, page.locale) : null;
  if (shell) {
    return (
      <article>
        <DocumentHead
          eyebrow={leadHero?.eyebrow}
          icon={leadHero?.icon}
          title={shell.title}
          description={shell.description}
        />
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <p className="rounded-2xl bg-amber-50 p-5 text-[16px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
            {shell.notice}
          </p>
          <details className="group mt-6 rounded-2xl bg-navy-50 ring-1 ring-navy-100">
            <summary className="tap-target flex cursor-pointer items-center justify-between gap-3 p-5 text-[15px] font-semibold text-navy-700">
              {shell.show}
              <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div lang="en" dir="ltr" className="-mx-5 pb-4 text-start sm:-mx-6">
              <h2 className="px-10 text-[26px] font-bold tracking-tight text-navy-700 sm:px-12">{page.title}</h2>
              <BlockRenderer blocks={body} slug={slug} />
            </div>
          </details>
        </div>
      </article>
    );
  }

  if (page.layout === "document") {
    return (
      <article>
        <DocumentHead
          eyebrow={leadHero?.eyebrow}
          icon={leadHero?.icon}
          title={page.title}
          description={page.description}
          body={leadHero?.body}
        />
        <div className="mx-auto max-w-3xl py-10 sm:py-14">
          <BlockRenderer blocks={body} slug={slug} />
        </div>
      </article>
    );
  }

  return <BlockRenderer blocks={page.blocks} slug={slug} />;
}

/** The dark band a document opens on: the mockups' hero, quieter, with no picture beside it. */
function DocumentHead({
  eyebrow,
  icon,
  title,
  description,
  body,
}: {
  eyebrow?: string;
  icon?: string;
  title: string;
  description?: string | null;
  body?: string;
}) {
  return (
    <DarkBand className="px-5 pt-12 pb-14 sm:px-6 sm:pt-20 sm:pb-20">
      <Glow className="-start-40 -top-20 h-[440px] w-[440px] opacity-50" />
      <div className="mx-auto max-w-3xl">
        {eyebrow || icon ? (
          <div className="flex flex-wrap items-center gap-3">
            {icon ? <ContentIconMark name={icon} tone="light" /> : null}
            {eyebrow ? <Eyebrow dark>{eyebrow}</Eyebrow> : null}
          </div>
        ) : null}
        <h1 className="mt-5 text-balance text-[34px] font-bold leading-[1.08] tracking-tight text-white sm:text-[48px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-pretty text-[17px] leading-relaxed text-white/85">{description}</p>
        ) : null}
        {body && body !== description ? (
          <p className="mt-3 max-w-2xl text-pretty text-[16px] leading-relaxed text-white/85">{body}</p>
        ) : null}
      </div>
    </DarkBand>
  );
}
