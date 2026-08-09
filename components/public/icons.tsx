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
  tone?: "brand" | "teal" | "light";
}) {
  const Icon = name && name in ICONS ? ICONS[name as ContentIcon] : Sparkles;

  const tones = {
    brand: "bg-brand-50 text-brand-600",
    teal: "bg-teal-50 text-teal-600",
    light: "bg-white/10 text-white",
  };

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]} ${className ?? ""}`}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}
