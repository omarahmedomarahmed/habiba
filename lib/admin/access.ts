import { BACK_OFFICE_ROLES, type Role } from "@/lib/db/schema";

/**
 * 🔴 W2-A01 / A5: who may open which back office page, in ONE table.
 *
 * "A role is a list, not a rank" was true of `requireRole` and false of the
 * console around it: the nav decided who saw a link with two booleans of its
 * own, the pages decided who got in with their own guard, and six links were
 * shown to roles the page then bounced to `/dashboard`, which bounced them on
 * to `/onboarding`. A staff sign-in landed on `/admin`, which was not theirs.
 *
 * Now the nav is filtered through `mayOpen`, the sign-in lands on
 * `landingFor`, and `tests/admin-access.test.ts` reads every page's guard and
 * fails when one disagrees with its row here. A new page with no row fails
 * the same test, so the decision cannot be skipped.
 *
 * Pure on purpose, so the nav, the sign-in action and the test all read the
 * same list without a database.
 */

const STAFF = BACK_OFFICE_ROLES;
const OWNER = ["super_admin"] as const satisfies readonly Role[];

export const ADMIN_PAGES: Record<string, readonly Role[]> = {
  "/admin": OWNER,
  /*
   * D9: staff work payouts and verifications. The four-eyes rules that make
   * that safe live in `lib/billing/four-eyes.ts` and in the database.
   */
  "/admin/payouts": STAFF,
  "/admin/verifications": STAFF,
  "/admin/transfers": STAFF,
  "/admin/transfers/receipt/[id]": STAFF,
  "/admin/support": STAFF,
  "/admin/numbers": STAFF,
  "/admin/patients/[id]": STAFF,
  "/admin/sponsors/[id]": STAFF,
  "/admin/not-yours": STAFF,
  "/admin/therapists": OWNER,
  "/admin/therapists/[id]": OWNER,
  "/admin/radar": OWNER,
  "/admin/radar/investigate/[id]": OWNER,
  "/admin/ratings": OWNER,
  "/admin/vault": OWNER,
  "/admin/sponsors": OWNER,
  "/admin/benefits": OWNER,
  "/admin/clinics": OWNER,
  "/admin/partners": OWNER,
  "/admin/checkins": OWNER,
  "/admin/taxonomy": OWNER,
  "/admin/announce": OWNER,
  "/admin/content": OWNER,
  "/admin/content/[id]": OWNER,
  "/admin/settings": OWNER,
  "/admin/strings": OWNER,
  "/admin/audit": OWNER,
  "/admin/usage": OWNER,
  "/admin/usage/sessions": OWNER,
  "/admin/errors": OWNER,
  "/admin/financial-model": OWNER,
  "/admin/actuals": OWNER,
  /*
   * Both keys of Total View are the owner's (`elevated()`), so the page is
   * too. It used to admit managers and then bounce them at the gate.
   */
  "/admin/tv": OWNER,
};

/** The table row a concrete path falls under: `/admin/patients/abc` is `/admin/patients/[id]`. */
export function pageFor(path: string): string | null {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  if (ADMIN_PAGES[clean]) return clean;
  const parts = clean.split("/");
  for (const pattern of Object.keys(ADMIN_PAGES)) {
    const want = pattern.split("/");
    if (want.length !== parts.length) continue;
    if (want.every((segment, i) => segment.startsWith("[") || segment === parts[i])) return pattern;
  }
  return null;
}

/** Fails closed: a path with no row is nobody's. */
export function mayOpen(role: Role | null | undefined, path: string): boolean {
  if (!role) return false;
  const page = pageFor(path);
  return page !== null && ADMIN_PAGES[page]!.includes(role);
}

/**
 * Where a back office sign-in lands. The owner gets the overview; everyone
 * else the queue that is worked by the minute, which is a page they can use.
 */
export function landingFor(role: Role | null | undefined): string {
  return mayOpen(role, "/admin") ? "/admin" : "/admin/transfers";
}

export function isBackOffice(role: Role | null | undefined): boolean {
  return Boolean(role) && (BACK_OFFICE_ROLES as readonly string[]).includes(role!);
}

/** Somebody bounced off a page. Back office people stay in the console. */
export function refusalDestination(role: Role | null | undefined, path: string): string {
  if (!isBackOffice(role)) return "/dashboard";
  const from = path.startsWith("/admin") ? `?from=${encodeURIComponent(path)}` : "";
  return `/admin/not-yours${from}`;
}
