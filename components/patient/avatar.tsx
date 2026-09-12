import { cn } from "@/lib/utils";

/**
 * A patient's face, or their initial. PLAN.md 25.7, C115.
 *
 * The `src` is `/api/patient/avatar/:personId`, which carries no secret: the
 * route asks who is calling on every request. That is the whole point of C115
 * and it means this component can be rendered anywhere without thinking about
 * whether the surrounding page leaks a URL.
 *
 * `hasPhoto` is passed in rather than discovered, so a person with no picture
 * costs no request at all. A 404 per empty avatar in a caseload list is a
 * hundred requests to say nothing.
 */
export function PatientAvatar({
  personId,
  hasPhoto,
  name,
  size = 40,
  className,
}: {
  personId: string;
  hasPhoto: boolean;
  name: string;
  size?: number;
  className?: string;
}) {
  const shared = cn(
    "shrink-0 overflow-hidden rounded-full object-cover ring-1 ring-slate-200",
    className,
  );

  if (!hasPhoto) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        className={cn(
          shared,
          "flex items-center justify-center bg-slate-100 font-semibold text-slate-500",
        )}
      >
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/patient/avatar/${personId}`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={shared}
    />
  );
}
