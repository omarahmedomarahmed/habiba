/**
 * The typed confirmation a destructive `on:production` command needs. Shared
 * by `scripts/on-production.ts` and its tests; nothing here runs.
 */

/**
 * When a command deletes or rewrites production data. `true` always; an object
 * names the flags that make one run of it harmless (`unless`, a dry run) or
 * the flag that makes it destructive (`onlyWith`).
 */
export type Destroys = true | { unless?: string[]; onlyWith?: string };

export type Allowed = { writes: boolean; why: string; destroys?: Destroys };

/** The typed half of the confirmation. */
export const CONFIRM_FLAG = "--i-understand-this-deletes-production-data";

/** Whether this run of an allowed command deletes or rewrites production data. */
export function isDestructive(entry: Allowed, args: string[]): boolean {
  const d = entry.destroys;
  if (!d) return false;
  if (d === true) return true;
  if (d.onlyWith !== undefined) return args.includes(d.onlyWith);
  return !(d.unless ?? []).some((flag) => args.includes(flag));
}

/**
 * Why a destructive run is refused, or null when it may go ahead. It needs the
 * typed flag AND `CONFIRM_PRODUCTION` naming the production database host, so
 * neither a pasted command line nor an environment left set is enough alone.
 */
export function confirmationRefusal(
  entry: Allowed,
  args: string[],
  confirmHost: string | undefined,
  productionHost: string,
): string | null {
  if (!isDestructive(entry, args)) return null;
  const missing: string[] = [];
  if (!args.includes(CONFIRM_FLAG)) missing.push(`the flag ${CONFIRM_FLAG}`);
  if (confirmHost !== productionHost) missing.push(`CONFIRM_PRODUCTION=${productionHost} in the environment`);
  return missing.length === 0 ? null : missing.join(" and ");
}
