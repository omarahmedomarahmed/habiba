import type { Metadata } from "next";

import { ComponentShowcase } from "@/components/demo/component-showcase";
import { DeviceFrame } from "@/components/demo/device-frame";
import { getDemoContent } from "@/lib/content/demo";
import { CONTENT_DEMOS } from "@/lib/db/schema";

/**
 * 🔴 76.65 — THE PIECES, BEFORE THEY ARE WIRED INTO FIFTEEN PAGES.
 *
 * The public site is being rebuilt so that every section shows the product
 * rather than describing it: no icon-title-paragraph cards, a real component in
 * every hero, and each one framed as a screen so a reader can tell they are
 * looking at the actual interface.
 *
 * That is a large change to apply blind. This page renders every demo the CMS
 * can name, in the frame it will wear, at the sizes the grid will use, so the
 * direction can be judged and corrected before thirteen more pages inherit it.
 *
 * ## It is `noindex`, and that is the only thing protecting it
 *
 * There is nothing secret here — every fixture is synthetic and every component
 * already appears on a public page — but a design reference competing with
 * `/features` in search results would be a self-inflicted wound. `robots` is set
 * below rather than inherited, because the public layout's default is to index.
 */
export const metadata: Metadata = {
  title: "Design reference",
  robots: { index: false, follow: false },
};

/** Every demo but the sentinel. */
const DEMOS = CONTENT_DEMOS.filter((name) => name !== "none");

export default async function DesignReferencePage() {
  const content = await getDemoContent();

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">
            Internal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Design reference
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            Every component the public site can render, in the frame it wears. Not linked from
            anywhere and not indexed.
          </p>
        </header>

        {/* ------------------------------------------------ the frames themselves -- */}

        <Section
          n="1"
          title="The frame"
          note="A rendered component is not obviously a screen. The chrome is what says it is."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Labelled label="Browser, for a screen used at a desk">
              <DeviceFrame as="browser" path="/admin/actuals">
                <div className="grid h-56 place-items-center bg-slate-50 text-sm text-slate-400">
                  any desk screen
                </div>
              </DeviceFrame>
            </Labelled>

            <Labelled label="Phone, for a screen used in the room">
              <DeviceFrame as="phone">
                <div className="grid h-56 place-items-center bg-slate-50 text-sm text-slate-400">
                  any phone screen
                </div>
              </DeviceFrame>
            </Labelled>
          </div>
        </Section>

        {/* ------------------------------------------------- every product demo -- */}

        <Section
          n="2"
          title={`Every demo, framed (${String(DEMOS.length)})`}
          note="Each one renders the product's own component against synthetic fixtures. The frame is chosen from the demo's name, not by the page author."
        >
          <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
            {DEMOS.map((name) => (
              <Labelled key={name} label={name}>
                <ComponentShowcase demo={name} content={content} />
              </Labelled>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------- the grid rules -- */}

        <Section
          n="3"
          title="The grid, and the rule about counts"
          note="Four items are two by two. Six are two by three. Never a lone card on its own row, and never a body paragraph under a component."
        >
          <div className="space-y-10">
            <Labelled label="Four items, two by two">
              <div className="grid gap-5 sm:grid-cols-2">
                {DEMOS.slice(0, 4).map((name) => (
                  <Tile key={name} title={name}>
                    <ComponentShowcase demo={name} content={content} />
                  </Tile>
                ))}
              </div>
            </Labelled>

            <Labelled label="Six items, two by three">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {DEMOS.slice(0, 6).map((name) => (
                  <Tile key={name} title={name}>
                    <ComponentShowcase demo={name} content={content} />
                  </Tile>
                ))}
              </div>
            </Labelled>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 border-t border-slate-200 pt-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{n}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

/**
 * A grid tile: a title and a component, and deliberately no room for a body.
 * The type has no `body` field, which is the point rather than an omission.
 */
function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
      {children}
    </div>
  );
}
