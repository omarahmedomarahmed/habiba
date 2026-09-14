import {
  Baby,
  Brain,
  CloudRain,
  Flame,
  HeartHandshake,
  HeartPulse,
  Moon,
  Tag,
  Users,
  Wine,
  Zap,
} from "lucide-react";

import { IconGrid } from "@/components/visual/primitives";

/**
 * 🔴 65.7 / 65.9 / 65.22 — EXPLORE BY CATEGORY, AS AN ICON GRID.
 *
 * The patient homepage had these as a row of grey pills that scrolled sideways: the
 * least scannable form a list of eight things can take, on the one screen whose reader
 * may be in distress.
 *
 * ## 🔴 65.9 — A NEW SPECIALTY APPEARS WITHOUT A DEPLOY
 *
 * The categories come from the taxonomy an admin already edits, counted by how many
 * clinicians actually cover them. `ICONS` below maps the codes we have a meaningful
 * glyph for, and everything else gets a neutral tag.
 *
 * 🔴 THE FALLBACK IS NEUTRAL RATHER THAN ARBITRARY, and that is 65.22.
 *
 * *An icon chosen because the row looked bare.* The tempting build hashes the code to
 * pick one of twelve glyphs, which makes every category look considered and means
 * nothing: a person scanning for "grief" would find a lightning bolt. A tag says
 * "this is a category and we have no picture for it", which is true.
 *
 * ## 🔴 AND THE COUNT IS NOT SHOWN
 *
 * `categories()` returns one and the grid drops it. "Anxiety (3)" reads as an
 * inventory; a patient choosing where to start is not shopping, and a small number
 * beside the thing they came for is a reason not to tap it.
 */

const ICONS: Record<string, React.ReactNode> = {
  anxiety: <Zap className="h-4 w-4" aria-hidden />,
  depression: <CloudRain className="h-4 w-4" aria-hidden />,
  trauma: <HeartPulse className="h-4 w-4" aria-hidden />,
  ptsd: <HeartPulse className="h-4 w-4" aria-hidden />,
  relationships: <HeartHandshake className="h-4 w-4" aria-hidden />,
  couples: <HeartHandshake className="h-4 w-4" aria-hidden />,
  family: <Users className="h-4 w-4" aria-hidden />,
  child: <Baby className="h-4 w-4" aria-hidden />,
  adolescent: <Baby className="h-4 w-4" aria-hidden />,
  grief: <Moon className="h-4 w-4" aria-hidden />,
  sleep: <Moon className="h-4 w-4" aria-hidden />,
  addiction: <Wine className="h-4 w-4" aria-hidden />,
  substance: <Wine className="h-4 w-4" aria-hidden />,
  anger: <Flame className="h-4 w-4" aria-hidden />,
  ocd: <Brain className="h-4 w-4" aria-hidden />,
  adhd: <Brain className="h-4 w-4" aria-hidden />,
};

/**
 * 🔴 EXPORTED, so a verifier can assert that an unknown code gets the neutral one
 * rather than a glyph somebody would read as meaning something.
 */
export function iconFor(code: string): React.ReactNode {
  const key = code.toLowerCase();

  /*
   * A prefix match, so `anxiety_gad` and `trauma-ptsd` find their icon without the map
   * needing a line each. The taxonomy is admin-editable and its codes are whatever
   * somebody typed.
   */
  const hit = Object.keys(ICONS).find((candidate) => key.includes(candidate));
  return hit ? ICONS[hit] : <Tag className="h-4 w-4" aria-hidden />;
}

export function CategoryGrid({
  categories,
}: {
  categories: { code: string; label: string }[];
}) {
  return (
    <IconGrid
      items={categories.map((category) => ({
        key: category.code,
        label: category.label,
        icon: iconFor(category.code),
        href: `/patient/browse?q=${encodeURIComponent(category.code)}`,
      }))}
    />
  );
}
