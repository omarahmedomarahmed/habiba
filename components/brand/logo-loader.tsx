import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * The one loading screen: the 24T mark, breathing, in the middle of the space
 * the page is about to fill. Founder, 26 September: "loading indication
 * onscreen with our logo on the loading screen".
 *
 * Used by every `loading.tsx` (through the shared loaders that were grey
 * blocks before) and by the page change overlay, so a reader sees the same
 * thing whether the wait is a stream or a round trip.
 *
 * Pure markup and CSS: no hook, no state, no script, so it can render in a
 * server component, in a client component and before hydration alike. The
 * animation is `nav-breathe` in `globals.css`, which is opacity and transform
 * only (composited, never laid out) and which the reduced motion rule there
 * stops.
 *
 * `label` is what a screen reader hears; nothing is written on screen, because
 * a word under a logo for half a second is a word nobody can read.
 */
export function LogoLoader({
  label,
  tone = "light",
  className,
  size = 44,
}: {
  label: string;
  /** Light ground (navy mark) or the room's and portals' navy ground (white mark). */
  tone?: "light" | "dark";
  className?: string;
  size?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex flex-col items-center justify-center gap-4", className)}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden className="nav-breathe">
        <Logo ink={tone === "dark" ? "white" : "navy"} height={size} title={null} />
      </div>
      <div
        aria-hidden
        className={cn(
          "relative h-0.5 w-20 overflow-hidden rounded-full",
          tone === "dark" ? "bg-white/15" : "bg-navy-100",
        )}
      >
        <div className="nav-sweep absolute inset-y-0 left-0 w-1/2 rounded-full bg-brand-500" />
      </div>
    </div>
  );
}

/**
 * The same loader, filling a route's content area: what every `loading.tsx`
 * renders. `min-h` rather than a fixed height so it never pushes the chrome
 * around it, and centred so the mark lands where the page's content will.
 */
export function RouteLogoLoader({
  label,
  tone = "light",
  className,
}: {
  label: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[55dvh] w-full items-center justify-center px-4 py-10", className)}>
      <LogoLoader label={label} tone={tone} />
    </div>
  );
}
