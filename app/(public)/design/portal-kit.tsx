import { cn } from "@/lib/utils";

/**
 * 🔴 A DESK SCREEN, DRAWN PROPERLY, SO THREE ARRANGEMENTS CAN BE COMPARED.
 *
 * The wireframe kit next door draws these as grey blocks on purpose, which is
 * right for "which arrangement" and wrong for "what would it look like". This
 * is the same set of screens in the product's own palette and type, so a
 * decision can be made on the thing rather than on a diagram of it.
 *
 * Not a route: no `page.tsx`, so Next never serves it. It sits under
 * `app/(public)/design/` because both portal sample pages import it and that
 * directory is exempt from the i18n ratchet. See the note at the top of
 * `design/patient/sample/samples.tsx` about what that exemption is for and
 * why using it here is a decision rather than an oversight.
 */

/** A browser window, with the rail the option chooses (or none). */
export function Console({
  path,
  rail,
  active,
  children,
}: {
  path: string;
  /** The left navigation, when the option has one. Omit for the ones that do not. */
  rail?: readonly string[];
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg shadow-slate-900/5">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="ms-2 truncate rounded bg-white px-2 py-0.5 font-mono text-[10px] tracking-wide text-slate-500">
          {path}
        </span>
      </div>

      <div className="flex min-h-[19rem] bg-slate-50">
        {rail ? (
          <nav className="w-28 shrink-0 border-e border-slate-200 bg-white py-2.5">
            {rail.map((one) => (
              <span
                key={one}
                className={cn(
                  "mx-1.5 mb-0.5 block truncate rounded-lg px-2 py-1.5 text-[11px]",
                  one === active
                    ? "bg-navy-500 font-semibold text-white"
                    : "font-medium text-slate-600",
                )}
              >
                {one}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="min-w-0 flex-1 p-3.5">{children}</div>
      </div>
    </div>
  );
}

/** The screen's own title row. */
export function ConsoleHead({ title, sub, action }: { title: string; sub?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold tracking-tight text-navy-500">{title}</p>
        {sub ? <p className="mt-0.5 truncate text-[11px] text-slate-600">{sub}</p> : null}
      </div>
      {action ? (
        <span className="shrink-0 rounded-lg bg-brand-500 px-2.5 py-1.5 text-[11px] font-bold text-navy-600">
          {action}
        </span>
      ) : null}
    </div>
  );
}

/**
 * 🔴 THE POT AS A VESSEL WITH A DATE ON IT, not four tiles of numbers.
 *
 * A balance is a noun. A date it runs out is a decision, and it is the only
 * thing on this screen that ever makes somebody act.
 */
export function Pot({ loud = false }: { loud?: boolean }) {
  const remaining = 412_000;
  const added = 1_000_000;
  const pct = Math.round((remaining / added) * 100);
  return (
    <div
      className={cn(
        "rounded-xl p-3",
        loud ? "bg-navy-500 text-white" : "border border-slate-200 bg-white",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.12em]",
            loud ? "text-white/60" : "text-slate-500",
          )}
        >
          Left in the pot
        </span>
        <span className={cn("text-[11px] font-semibold", loud ? "text-brand-300" : "text-brand-700")}>
          Runs out 4 March
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight",
          loud ? "text-white" : "text-navy-500",
        )}
      >
        $4,120
      </p>
      <div
        className={cn(
          "mt-2 h-2 overflow-hidden rounded-full",
          loud ? "bg-white/15" : "bg-slate-100",
        )}
      >
        <span
          className="block h-full rounded-full bg-brand-500"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <p className={cn("mt-1.5 text-[11px]", loud ? "text-white/70" : "text-slate-600")}>
        $5,880 of $10,000 spent. 40 sessions this month, at the rate you are going.
      </p>
    </div>
  );
}

/** A small figure with a label, for the row of facts that is not the pot. */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-navy-500">{value}</p>
      {note ? <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{note}</p> : null}
    </div>
  );
}

/** A table, with the columns this product is allowed to have. */
export function Table({
  head,
  rows,
  note,
}: {
  head: readonly string[];
  rows: readonly (readonly (string | React.ReactNode)[])[];
  /** 🔴 The sentence that says what is deliberately NOT a column here. */
  note?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {head.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "px-2.5 py-1.5 font-bold uppercase tracking-wide text-slate-500",
                  i === 0 ? "text-start" : "text-end",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-slate-100 last:border-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-2.5 py-1.5",
                    i === 0
                      ? "text-start font-medium text-slate-900"
                      : "text-end tabular-nums text-slate-700",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note ? (
        <p className="border-t border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[10px] leading-snug text-slate-600">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** The verification state a roster row is allowed to carry, and nothing else. */
export function Verified({ state }: { state: "verified" | "pending" | "none" }) {
  const look = {
    verified: "bg-brand-50 text-brand-800",
    pending: "bg-amber-50 text-amber-800",
    none: "bg-slate-100 text-slate-600",
  }[state];
  const label = { verified: "Verified", pending: "In review", none: "Not sent" }[state];
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", look)}>{label}</span>
  );
}

/** One option's column: the name, the bet, the cost, and the screen. */
export function PortalOption({
  option,
  name,
  bet,
  cost,
  children,
}: {
  option: "A" | "B" | "C";
  name: string;
  bet: string;
  cost: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
        Option {option}
      </p>
      <h3 className="mt-1 text-xl font-bold tracking-tight text-navy-500">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{bet}</p>
      <p className="mt-2 border-s-2 border-slate-200 ps-3 text-sm leading-relaxed text-slate-600">
        {cost}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** The page's own opening, shared by both portals. */
export function SampleIntro({
  eyebrow,
  title,
  body,
  links,
}: {
  eyebrow: string;
  title: string;
  body: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <section className="border-b border-slate-200 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </p>
        <h1 className="mt-2 max-w-3xl text-balance text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-700">{body}</p>
        <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {links.map((one) => (
            <a
              key={one.href}
              href={one.href}
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              {one.label}
            </a>
          ))}
        </p>
      </div>
    </section>
  );
}
