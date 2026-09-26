import {
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  Clock,
  FileText,
  Heart,
  Lock,
  Mail,
  Mic,
  Phone,
  Shield,
  Sparkles,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { ContentIcon } from "@/lib/db/schema";

/**
 * Icon names an admin can type, mapped to components.
 *
 * An allowlist rather than a dynamic import by string: the set of icons that
 * ship in the bundle should be decided at build time, not by whatever someone
 * types into the CMS.
 */
const ICONS: Record<ContentIcon, LucideIcon> = {
  sparkles: Sparkles,
  mic: Mic,
  fileText: FileText,
  shield: Shield,
  heart: Heart,
  clock: Clock,
  users: Users,
  video: Video,
  lock: Lock,
  zap: Zap,
  check: Check,
  brain: Brain,
  phone: Phone,
  mail: Mail,
  chart: BarChart3,
  alert: AlertTriangle,
};

export const ICON_NAMES = Object.keys(ICONS) as ContentIcon[];

export function ContentIconMark({
  name,
  className,
  tone = "brand",
}: {
  name?: string;
  className?: string;
  tone?: "brand" | "navy" | "light" | "dark" | "card";
}) {
  const Icon = name && name in ICONS ? ICONS[name as ContentIcon] : Sparkles;

  /*
   * 🔴 THE ALTERNATION IS BETWEEN THE TWO INKS, NOT BETWEEN TWO TEALS.
   *
   * `blocks.tsx` alternates these down a list to give it rhythm. The second
   * tone used to be `teal`, back when `teal-*` and `brand-*` were two ramps
   * that diverged; once the interface moved onto one ramp it resolved to
   * `bg-brand-50 text-brand-600` against `bg-brand-50 text-brand-700` — the
   * same ground and one step of ink apart, which is an alternation nobody can
   * see and a name that no longer describes anything.
   *
   * The palette has exactly two inks and this is what the second one is for.
   * Navy against teal is the mark's own pairing, so the rhythm is visible and
   * it is the rhythm the brand already has.
   */
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    navy: "bg-navy-50 text-navy-500",
    light: "bg-white/10 text-white",
    /* The mockups' two badges: navy with a teal glyph, and white on a tinted card. */
    dark: "bg-navy-900 text-brand-300",
    card: "bg-white text-brand-700 ring-1 ring-navy-100",
  };

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]} ${className ?? ""}`}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}
