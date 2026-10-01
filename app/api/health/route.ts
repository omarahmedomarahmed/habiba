/**
 * Liveness for the uptime check (`.github/workflows/uptime.yml`).
 *
 * It answers from the function alone and imports nothing that opens a
 * database connection: the database is allowed to sleep, and a monitor that
 * woke it every fifteen minutes would keep it awake for good. So a 200 here
 * means "the deployment is serving", not "the database is up".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    {
      ok: true,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
