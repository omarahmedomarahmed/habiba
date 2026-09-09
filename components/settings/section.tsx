import Link from "next/link";

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
    <section id={id} className="scroll-mt-20 space-y-3">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-slate-900 uppercase">{title}</h2>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{why}</p>
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
export function SettingsNav({ sections }: { sections: { id: string; title: string }[] }) {
  return (
    <nav
      aria-label="Settings sections"
      className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {sections.map((section) => (
        <Link
          key={section.id}
          href={`#${section.id}`}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {section.title}
        </Link>
      ))}
    </nav>
  );
}
