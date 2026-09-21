import { cn } from "@/lib/utils";

/**
 * Wireframe primitives, for choosing a layout before anybody builds one.
 *
 * ## Why these are grey and not the real components
 *
 * `/design` renders the real thing, which is right for "does this component
 * exist and what does it look like". It is wrong for "which of these three
 * arrangements should we build", because a wireframe drawn in the finished
 * visual language gets judged on its colour and its shadow rather than on where
 * things are. Grey blocks and a label make the question unavoidable: is this
 * the right screen, with the right things on it, in the right order.
 *
 * ## The one rule they follow
 *
 * A block is drawn at roughly the height it will really be, and an empty state
 * is drawn as what it really is. A wireframe that draws an empty list as a
 * neat 60px row when the product renders a 400px card is a wireframe that
 * hides the defect it was meant to help decide about.
 */

export function Phone({
  path,
  children,
  note,
}: {
  /** The route this screen lives at, shown as the frame's label. */
  path: string;
  children: React.ReactNode;
  /** One line under the frame, for a decision this option is making. */
  note?: string;
}) {
  return (
    <figure className="m-0 min-w-0">
      <div className="mx-auto w-full max-w-[17rem]">
        <div className="rounded-[1.75rem] border-[6px] border-slate-300 bg-white p-0 shadow-sm">
          <div className="flex h-5 items-center justify-center rounded-t-[1.25rem] bg-slate-100">
            <span className="font-mono text-[9px] tracking-wide text-slate-500">{path}</span>
          </div>
          <div className="flex min-h-[22rem] flex-col rounded-b-[1.25rem] bg-white">{children}</div>
        </div>
      </div>
      {note ? (
        <figcaption className="mx-auto mt-2 max-w-[17rem] text-[11px] leading-relaxed text-slate-600">
          {note}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A desktop screen. The company and clinic portals are used at a desk, and
 * drawing them in a phone frame would decide the layout question by accident.
 */
export function Browser({
  path,
  children,
  note,
  nav,
}: {
  path: string;
  children: React.ReactNode;
  note?: string;
  /** The left rail, when the option has one. Omit for the options that do not. */
  nav?: string[];
}) {
  return (
    <figure className="m-0 min-w-0">
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="ms-2 font-mono text-[9px] tracking-wide text-slate-500">{path}</span>
        </div>
        <div className="flex min-h-[15rem]">
          {nav ? (
            <div className="w-24 shrink-0 border-e border-slate-200 bg-slate-50 py-2">
              {nav.map((one, i) => (
                <span
                  key={one}
                  className={cn(
                    "block px-2 py-1 text-[9px]",
                    i === 0 ? "font-bold text-navy-500" : "text-slate-600",
                  )}
                >
                  {one}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col py-2">{children}</div>
        </div>
      </div>
      {note ? (
        <figcaption className="mt-2 text-[11px] leading-relaxed text-slate-600">{note}</figcaption>
      ) : null}
    </figure>
  );
}

/** A desktop wireframe inside a compare row. */
export function PickWide({
  option,
  path,
  note,
  nav,
  children,
}: {
  option: "A" | "B" | "C";
  path: string;
  note?: string;
  nav?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Option {option}
      </p>
      <Browser path={path} note={note} nav={nav}>
        {children}
      </Browser>
    </div>
  );
}

/** The screen's own title row, which is where a patient reads what they opened. */
export function Head({ children, action }: { children: React.ReactNode; action?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2">
      <span className="text-[13px] font-bold text-navy-500">{children}</span>
      {action ? <span className="text-[10px] font-semibold text-brand-700">{action}</span> : null}
    </div>
  );
}

/** A labelled region. `h` is its real height in the built screen, in px. */
export function Block({
  label,
  h = 44,
  tone = "grey",
  className,
}: {
  label: string;
  h?: number;
  tone?: "grey" | "line" | "navy" | "teal" | "dashed";
  className?: string;
}) {
  return (
    <div
      style={{ minHeight: `${String(Math.round(h * 0.62))}px` }}
      className={cn(
        "mx-3 mb-1.5 flex items-center rounded-lg px-2.5 text-[10px] leading-tight",
        tone === "grey" && "bg-slate-100 text-slate-600",
        tone === "line" && "border border-slate-200 bg-white text-slate-600",
        tone === "navy" && "bg-navy-500 text-white",
        tone === "teal" && "bg-teal-500 text-navy-600",
        tone === "dashed" && "border border-dashed border-slate-300 bg-white text-slate-500",
        className,
      )}
    >
      {label}
    </div>
  );
}

/** Two or more blocks across. */
export function Cols({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 flex gap-1.5 px-3 [&>*]:mx-0 [&>*]:mb-0 [&>*]:flex-1">{children}</div>;
}

/** A row of small pills: filters, chips, segmented controls. */
export function Chips({ items, active = 0 }: { items: string[]; active?: number }) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1 px-3">
      {items.map((one, i) => (
        <span
          key={one}
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-medium",
            i === active ? "bg-navy-500 text-white" : "border border-slate-200 text-slate-600",
          )}
        >
          {one}
        </span>
      ))}
    </div>
  );
}

/**
 * 🔴 An empty state drawn at the size it really is.
 *
 * `size="card"` is what the app does today on eleven screens: a ~100px card at
 * the top of a `min-h-dvh` column with seventy per cent white under it.
 * `size="line"` is the rule the rebuild is proposing: one row, the action on
 * it, and the rest of the screen free for whatever comes next.
 */
export function Empty({
  label,
  action,
  size,
}: {
  label: string;
  /*
   * 🔴 A prop, not a literal, and the reason is a gate rather than taste.
   *
   * `verify:sprint37l` ratchets the English left in `components/`, and a word
   * typed here counted against that floor. `app/(public)/` is exempt because
   * its text comes from CMS rows, so the wireframe pages can carry their own
   * labels; this kit cannot. Passing the word in keeps the count honest
   * without adding an exemption, and an exemption is the obvious way to make
   * a ratchet meaningless.
   */
  action: string;
  size: "card" | "line";
}) {
  if (size === "line") {
    return (
      <div className="mx-3 mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
        <span className="text-[10px] text-slate-600">{label}</span>
        <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[9px] font-semibold text-navy-600">
          {action}
        </span>
      </div>
    );
  }
  return (
    <div className="mx-3 mb-1.5 flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center">
      <span className="text-[10px] text-slate-600">{label}</span>
      <span className="rounded-md bg-brand-500 px-2 py-0.5 text-[9px] font-semibold text-navy-600">
        {action}
      </span>
    </div>
  );
}

/** Pushes whatever follows to the bottom of the frame. */
export function Fill() {
  return <div className="flex-1" />;
}

/** The tab bar, and the thing the three options disagree about most. */
export function Tabs({
  items,
  active = 0,
  lifted,
}: {
  items: string[];
  active?: number;
  /** The index drawn as a raised circle, as the radar tab is today. */
  lifted?: number;
}) {
  return (
    <div className="mt-auto flex items-end justify-around rounded-b-[1.25rem] border-t border-slate-200 bg-white px-1 pt-1.5 pb-2">
      {items.map((one, i) =>
        i === lifted ? (
          <span key={one} className="flex flex-col items-center gap-0.5">
            <span className="-mt-3 grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-[8px] font-bold text-navy-600">
              ●
            </span>
            <span className="text-[8px] font-medium text-slate-600">{one}</span>
          </span>
        ) : (
          <span
            key={one}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[8px]",
              i === active ? "font-bold text-navy-500" : "text-slate-500",
            )}
          >
            <span
              className={cn(
                "h-3 w-3 rounded",
                i === active ? "bg-navy-500" : "bg-slate-300",
              )}
            />
            {one}
          </span>
        ),
      )}
    </div>
  );
}

/** The SOS orb. On every patient screen, which is a rule rather than a choice. */
export function Orb() {
  return (
    <div className="pointer-events-none relative">
      <span className="absolute -top-9 end-3 grid h-7 w-7 place-items-center rounded-full bg-red-600 text-[8px] font-bold text-white shadow">
        SOS
      </span>
    </div>
  );
}

/** One option's column: a name, the argument for it, and the screens under it. */
export function Option({
  name,
  tagline,
  children,
}: {
  name: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
          {name}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{tagline}</p>
      </div>
      {children}
    </div>
  );
}

/** One screen, across all three options. */
export function Compare({
  n,
  title,
  question,
  children,
}: {
  n: number;
  title: string;
  /** The decision this row is asking you to make. */
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 py-10">
      <div className="mb-6 max-w-2xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          [ {String(n).padStart(2, "0")} ]
        </p>
        <h3 className="mt-1 text-xl font-bold tracking-tight text-navy-500">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{question}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** A wireframe inside a compare row, labelled with which option it belongs to. */
export function Pick({
  option,
  path,
  note,
  children,
}: {
  option: "A" | "B" | "C";
  path: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Option {option}
      </p>
      <Phone path={path} note={note}>
        {children}
      </Phone>
    </div>
  );
}
