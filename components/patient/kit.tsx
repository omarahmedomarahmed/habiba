import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The patient app's building blocks, drawn from the approved sample at
 * `/design/patient`: a night-navy hero with the teal light behind it, white
 * cards with a soft lift on a navy-50 ground, bold section heads, and rows
 * you tap. Server-safe on purpose (no client hooks), so every page can use
 * them without becoming a client component.
 *
 * Colours stay on the design system's pairs: navy ink on white and navy-50,
 * white ink on navy-900, navy ink on brand-500, amber only for money owed.
 */

/** The page column: phone width first, a little wider on a desk. */
export function Screen({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col gap-5 px-5 pb-10",
        wide ? "max-w-2xl" : "max-w-lg",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** The soft teal light behind whatever matters most on a surface. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full blur-3xl", className)}
      style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
    />
  );
}

/**
 * The dark hero at the top of a screen. Full bleed on a phone, a rounded
 * panel on a desk. Its top padding clears the language corner.
 */
export function Hero({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative -mx-5 overflow-hidden rounded-b-[36px] bg-navy-900 px-5 pb-6 pt-16 text-white sm:mx-0 sm:mt-4 sm:rounded-[32px] sm:px-6",
        className,
      )}
    >
      <Glow className="-end-24 -top-24 h-72 w-72" />
      <div className="relative">{children}</div>
    </section>
  );
}

/**
 * A light screen's title. `pt-16` leaves the language corner its own space,
 * so a long title in either language never runs under it.
 */
export function Title({
  title,
  sub,
  back,
  eyebrow,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  back?: React.ReactNode;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="pt-16">
      {back ? <div className="mb-3">{back}</div> : null}
      {eyebrow ? (
        <p className="text-[13px] font-bold tracking-wide text-brand-700 uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">
        {title}
      </h1>
      {sub ? <p className="mt-1.5 text-[15px] leading-relaxed text-navy-400">{sub}</p> : null}
      {children}
    </header>
  );
}

/** The card: white, rounded, a soft lift. `tone` only ever tints, never shouts. */
export function Panel({
  children,
  className,
  tone = "plain",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "brand" | "amber" | "dark";
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-3xl p-4",
        tone === "plain" &&
          "border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]",
        tone === "brand" && "border border-brand-200 bg-brand-50",
        tone === "amber" && "border border-amber-200 bg-amber-50",
        tone === "dark" && "relative overflow-hidden bg-navy-900 text-white",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * The same card with the shared `Card`'s props, so a screen that already
 * builds from `Card` takes the patient look by changing one import.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-navy-100/80 bg-white shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

/** A section's head: a bold title and, when there is one, a link to all of it. */
export function SectionHead({
  title,
  href,
  action,
  as: Tag = "h2",
}: {
  title: React.ReactNode;
  href?: string;
  action?: React.ReactNode;
  as?: "h2" | "h3" | "p";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Tag className="text-[17px] font-bold text-navy-700">{title}</Tag>
      {href && action ? (
        <Link href={href} className="shrink-0 text-[14px] font-semibold text-brand-700">
          {action}
        </Link>
      ) : null}
    </div>
  );
}

/** A row you tap: an icon tile, a label, an optional detail, a chevron. */
export function RowLink({
  href,
  icon,
  label,
  detail,
  className,
}: {
  href: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-navy-100 transition-colors hover:bg-navy-50 active:scale-[0.99]",
        className,
      )}
    >
      {icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-navy-700">{label}</span>
        {detail ? <span className="block text-[13px] text-navy-400">{detail}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

const TONES = [
  ["#0a2342", "#2ec4b6"],
  ["#15746c", "#9ae9de"],
  ["#07182e", "#5fdccc"],
  ["#4a5d72", "#cbf4ed"],
  ["#0e544e", "#38d0be"],
] as const;

/**
 * A face for somebody with no photo: initials on a navy-to-teal field chosen
 * from the name, so each person keeps one colour everywhere. With a photo,
 * the photo.
 */
export function Face({
  name,
  photoUrl = null,
  size = 44,
  live = false,
  ring = false,
  square = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  live?: boolean;
  ring?: boolean;
  square?: boolean;
}) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [from, to] = TONES[hash % TONES.length]!;
  const initials = name
    .replace(/^(Dr\.?|د\.)\s*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-bold text-white",
        square ? "rounded-2xl" : "rounded-full",
        ring && "ring-2 ring-white",
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn("h-full w-full object-cover", square ? "rounded-2xl" : "rounded-full")}
        />
      ) : (
        <span
          aria-hidden
          className={cn("flex h-full w-full items-center justify-center", square ? "rounded-2xl" : "rounded-full")}
          /*
           * The navy end is also the element's own colour, as the clinician
           * kit's avatar does: a gradient is an image, so without it the white
           * initials sit on a transparent box and the contrast gate (and a
           * forced colours mode) reads white on white.
           */
          style={{ backgroundColor: from, backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          {initials}
        </span>
      )}
      {live ? (
        <span className="absolute -end-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
        </span>
      ) : null}
    </span>
  );
}

/** The one filled action on a screen: navy ink on the brand ground. */
export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 text-[15px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] transition-colors hover:bg-brand-400 disabled:opacity-50";

/** The quiet action beside it. */
export const ghostButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-navy-200 bg-white px-5 text-[15px] font-semibold text-navy-600 transition-colors hover:bg-navy-50 disabled:opacity-50";
