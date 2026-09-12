import type { IntegrationState } from "@/lib/integrations/registry";

/**
 * The dot beside an integration's state. PLAN.md 28.5.
 *
 * Colour carries the meaning and the label beside it repeats it in words,
 * because a page whose only signal is a shade of green is a page half its
 * readers cannot use.
 */
export function StateDot({ state }: { state: IntegrationState }) {
  const tone =
    state === "live" ? "bg-teal-500" : state === "partial" ? "bg-amber-500" : "bg-slate-300";
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${tone}`} />;
}
