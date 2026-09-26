import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The website's shared shapes, drawn from the approved mockups under
 * `app/design/website/`. Server components only: nothing here holds state, so
 * a page built from them stays a server page and pays for no JavaScript.
 *
 * The rhythm the mockups set: a dark band (navy-900, a faint grid, a slow teal
 * light) for the fold and the closing call, white or navy-50 between them.
 * Teal is the thing you press, always with navy ink on it; red is for help
 * alone.
 */

/** A dark band with a faint grid, the ground the heroes and closing calls stand on. */
export function DarkBand({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag id={id} className={cn("relative isolate overflow-hidden bg-navy-900 text-white", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
        }}
      />
      {children}
    </Tag>
  );
}

/** A soft teal light behind whatever matters most on a band. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10 rounded-full blur-3xl", className)}
      style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
    />
  );
}

export function Eyebrow({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "text-[13px] font-bold uppercase tracking-[0.18em] rtl:tracking-normal",
        dark ? "text-brand-300" : "text-brand-700",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A section's heading. Balanced, large, and never a paragraph. */
export function SiteTitle({
  children,
  dark = false,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={cn(
        "text-balance text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[44px]",
        dark ? "text-white" : "text-navy-700",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Lede({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "max-w-2xl text-pretty text-[17px] leading-relaxed sm:text-[18px]",
        /* 🔴 76.83: 85% white is the floor for body text on the dark band. */
        dark ? "text-white/85" : "text-navy-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Button looks for links. A `Link` carries one of these rather than wrapping a
 * `<button>`, so there is one focusable thing per call to action.
 */
const BTN_BASE =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold outline-none transition-[background-color,transform] duration-200 hover:-translate-y-px active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900";

export const btn = {
  /** Teal ground, navy ink: the one thing to press. */
  primary: cn(BTN_BASE, "bg-brand-500 text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] hover:bg-brand-400"),
  /** On the dark band, the second choice. */
  light: cn(BTN_BASE, "border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15"),
  /** On a light ground, a solid navy choice. */
  dark: cn(BTN_BASE, "bg-navy-600 text-white hover:bg-navy-500"),
  /** On a light ground, the second choice. */
  ghost: cn(BTN_BASE, "border border-navy-200 bg-white text-navy-600 hover:bg-navy-50"),
  /** Taller, for a hero. Added to one of the above. */
  lg: "h-14 px-7 text-[16px]",
} as const;

/**
 * A block that rises into place as it scrolls into view, the mockups' "rise on
 * enter", done by the browser rather than by script.
 *
 * 🔴 ALWAYS DRAWN, and that is why it moves and never fades. A script-driven
 * rise renders the block at opacity 0 and waits for hydration to show it, and
 * a fade tied to scroll leaves everything below the fold transparent, so a
 * slow phone, a full-page capture, a crawler or a contrast check reads a blank
 * section. This is a scroll-driven `site-rise` (app/globals.css), transform
 * only: where the browser supports `animation-timeline` the block slides up as
 * it enters; where it does not, the animation has no length. The global
 * reduced-motion rule stops it.
 */
export function Rise({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** A small stagger, as a share of the entry range. */
  delay?: number;
}) {
  const start = Math.round(Math.min(0.3, delay) * 100);
  return (
    <div
      className={className}
      style={
        {
          animationName: "site-rise",
          animationTimingFunction: "ease-out",
          animationFillMode: "both",
          animationTimeline: "view()",
          animationRange: `entry ${start}% entry ${start + 70}%`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/** The rounded white card the mockups stand content on. */
export function SiteCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[28px] bg-white p-6 ring-1 ring-navy-100 shadow-[0_20px_50px_-40px_rgba(10,35,66,0.5)] sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}
