import { cn } from "@/lib/utils";

/**
 * The heading every company page opens with, as in the approved mockups
 * (`app/design/_ds/portal.tsx`, `H2`): a large navy title and one quiet line.
 * The desk's column already pads the page, so this carries no padding of its own.
 */
export function SponsorHeading({
  title,
  subtitle,
  note,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A smaller line under the subtitle, such as a count. */
  note?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-navy-700">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] leading-relaxed text-navy-400">{subtitle}</p> : null}
        {note ? <p className="mt-1 text-[13px] font-semibold text-navy-400">{note}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
