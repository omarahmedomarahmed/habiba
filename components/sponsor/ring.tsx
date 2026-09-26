/**
 * The pot as a ring, as in the approved mockup (`app/design/_ds/ui.tsx`, `Ring`),
 * drawn on the server: no motion library, nothing to hydrate.
 *
 * 🔴 It is only ever drawn from a PUBLISHED balance. A caller holding a
 * suppressed one renders no ring at all, because an arc drawn from a figure we
 * refuse to publish is the suppression undone by a shape.
 */
export function PotRing({
  value,
  size = 128,
  stroke = 12,
  children,
}: {
  /** 0 to 1, what is left. Clamped. */
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-navy-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left)}
          className="stroke-brand-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
