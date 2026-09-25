/**
 * A tier's name in the reader's language.
 *
 * The three tiers this product ships are named in the dictionary; anything an
 * admin adds later keeps the name they typed. Falling back to their English
 * beats inventing an Arabic name for a tier nobody translated.
 *
 * B36: this lived inside the pricing page only, so the dashboard and the plan
 * card printed the stored English name ("Pay as you go") on Arabic screens.
 * Client-safe, so the plan card can call it with `useT`.
 */
const SHIPPED = ["payg", "practice", "clinic"] as const;
type ShippedKey = `pricing.tier.${(typeof SHIPPED)[number]}`;

export function tierName(
  tier: { key: string; name: string },
  t: (key: ShippedKey) => string,
): string {
  return (SHIPPED as readonly string[]).includes(tier.key)
    ? t(`pricing.tier.${tier.key}` as ShippedKey)
    : tier.name;
}
