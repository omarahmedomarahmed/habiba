import Link from "next/link";

import { getI18n } from "@/lib/i18n/server";

/**
 * One section of the settings page. PLAN.md 24.4.
 *
 * ## Why the old page needed rebuilding
 *
 * It was six cards in a column with no headings: your name, your password,
 * your zone, the copilot's voice, Stripe, and a link to the admin console, all
 * the same size and all the same weight. A therapist looking for "how do I get
 * paid" had to read every card to find out which one it was in, and the page
 * had grown a card per sprint since sprint 2 without anybody deciding what it
 * was for.
 *
 * A section carries a heading, a one-line reason it exists, and an anchor. The
 * reason is not decoration: a settings page is where somebody goes when
 * something is wrong, and a heading that says what the section is *for* is the
 * difference between finding it and scrolling twice.
 */
export function SettingsSection({
  id,
  title,
  why,
  children,
}: {
  id: string;
  title: string;
  why: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36 space-y-3 pt-2 lg:scroll-mt-24">
      <div>
        <h2 className="flex items-center gap-2 text-[19px] font-bold text-navy-700">
          <span aria-hidden className="h-5 w-1.5 rounded-full bg-brand-500" />
          {title}
        </h2>
        <p className="mt-0.5 text-sm leading-relaxed text-navy-400">{why}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The jump list.
 *
 * Chips rather than a sidebar, because this page is read on a phone and a
 * sidebar on a phone is a menu nobody opens. It scrolls sideways when there
 * are more sections than fit, which is the one place a horizontal scroll is
 * the right answer.
 */
export async function SettingsNav({
  sections,
}: {
  sections: { id: string; title: string }[];
}) {
  const { t } = await getI18n();
  return (
    <nav
      aria-label={t("tset.sections")}
      className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {sections.map((section) => (
        <Link
          key={section.id}
          href={`#${section.id}`}
          className="inline-flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-navy-500 ring-1 ring-navy-100 hover:bg-navy-50 hover:text-navy-700"
        >
          {section.title}
        </Link>
      ))}
    </nav>
  );
}
