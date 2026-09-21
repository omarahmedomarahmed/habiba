import { cn } from "@/lib/utils";

/**
 * Eight screens, two per person. Task 137.
 *
 * ## The job this section does
 *
 * After the fold, a homepage has to answer "what does this look like for
 * somebody like me" four times, without making anybody read the other three.
 * Two real screens each, two per row, every one of them the component the
 * product renders rather than a picture of it.
 *
 * ## Why the audience name is a mono eyebrow and not a coloured chip
 *
 * Four colours of chip is a legend, and a legend is a thing the reader has to
 * learn before the section starts working. A word above the tile is read
 * without being learned.
 *
 * ## Why the tiles do not have equal heights forced on them
 *
 * A phone mockup and a browser mockup are different shapes. Stretching both to
 * the taller of the two puts a band of empty card under the shorter one, which
 * is the thing that makes a grid of screens look like a grid of placeholders.
 * They align at the top and end where they end.
 */
export function HowItWorks({
  heading,
  body,
  items,
}: {
  heading?: string;
  body?: string;
  items: { audience: string; title: string; body?: string; demo: React.ReactNode }[];
}) {
  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          [ 02 ] {heading}
        </p>
        {body ? (
          <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-slate-700">{body}</p>
        ) : null}

        <div className="mt-10 grid gap-x-10 gap-y-12 lg:grid-cols-2">
          {items.map((item, i) => (
            <div key={`${item.audience}-${item.title}`} className="min-w-0">
              <p
                className={cn(
                  "font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
                  /*
                    The audience name changes every two tiles, so the pair
                    reads as a pair. The second of each pair is quieter,
                    because repeating the word at full weight makes the eye
                    read it as a new section rather than the same one.
                  */
                  i % 2 === 0 ? "text-navy-500" : "text-slate-500",
                )}
              >
                {item.audience}
              </p>
              <h3 className="mt-1.5 text-lg font-bold leading-snug tracking-tight text-navy-500">
                {item.title}
              </h3>
              {item.body ? (
                <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-slate-700">
                  {item.body}
                </p>
              ) : null}
              <div className="mt-4">{item.demo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
