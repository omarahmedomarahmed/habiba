import { Lede, Rise, SiteTitle } from "@/components/public/site-ui";
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
 * ## Why the audience name is an eyebrow and not a coloured chip
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
    <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        {heading ? <SiteTitle className="max-w-3xl">{heading}</SiteTitle> : null}
        {body ? <Lede className="mt-4">{body}</Lede> : null}

        <div className="mt-12 grid items-start gap-x-8 gap-y-14 lg:grid-cols-2">
          {items.map((item, i) => (
            <Rise key={`${item.audience}-${item.title}`} delay={(i % 2) * 0.06} className="min-w-0">
              <p
                className={cn(
                  "text-[13px] font-bold uppercase tracking-[0.16em] rtl:tracking-normal",
                  /*
                    The audience name changes every two tiles, so the pair
                    reads as a pair. The second of each pair is quieter,
                    because repeating the word at full weight makes the eye
                    read it as a new section rather than the same one.
                  */
                  i % 2 === 0 ? "text-brand-700" : "text-navy-400",
                )}
              >
                {item.audience}
              </p>
              <h3 className="mt-2 text-[22px] font-bold leading-snug tracking-tight text-navy-700">{item.title}</h3>
              {item.body ? (
                <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-navy-500">{item.body}</p>
              ) : null}
              <div className="mt-5 rounded-[28px] bg-navy-50 p-3 ring-1 ring-navy-100 sm:p-4">{item.demo}</div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}
