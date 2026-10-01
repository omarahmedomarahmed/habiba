/** The two lists `scripts/ci.ts` and `scripts/ci-db.ts` share. */

/*
 * Unit suites that open a database connection. `npm run ci:db` runs them in CI
 * against a throwaway Postgres (all but test:e2e), and `npm run gates` locally.
 */
export const NEEDS_DATABASE_SUITES = new Set([
  "test:account-links-db",
  "test:admin-lists",
  "test:cms-draft",
  "test:console-round2-db",
  "test:db",
  "test:ledger",
  "test:partner-console",
  "test:rail-exceptions-db",
  "test:sponsor-invoice",
  "test:support-console",
  "test:tenancy",
  "test:e2e",
]);

/* Verifiers that read only the repository. Probed with no database on 2026-10-01. */
export const STATIC_VERIFIERS = [
  "verify:sprint65", "verify:nul", "verify:sprint51", "verify:runbook", "verify:sprint37l2",
  "verify:sprint37l", "verify:sprint35r", "verify:sprint32", "verify:sprint31", "verify:palette",
  "verify:contrast", "verify:machines", "verify:traps", "verify:csp", "verify:email-dns",
  "verify:claims", "verify:reachable", "verify:principals", "verify:sprint59", "verify:sprint60",
  "verify:sprint61", "verify:boundary", "verify:sprint77", "verify:finance", "verify:plan",
  "verify:rail", "verify:blobs", "verify:whatsapp", "verify:launch", "verify:qualified",
  "verify:orb", "verify:money", "verify:notices", "verify:prove", "verify:journal", "verify:claims-defaults",
];
