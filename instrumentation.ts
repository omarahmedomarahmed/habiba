/**
 * The hook that catches everything the application throws.
 *
 * Next calls `onRequestError` for every uncaught error in a Server Component,
 * a Server Action, a route handler or middleware — which is the whole server
 * surface, and none of it was being recorded anywhere before this.
 *
 * Note what is *not* passed on to `recordError`: the request body, the query
 * string, the headers and the cookies. That is not an oversight to be tidied
 * up later. This application's errors are thrown while handling therapy
 * transcripts, so a body could be a session, a query string could be a join
 * token, and a cookie is a live credential. The route and the stack are enough
 * to find a bug, and everything else is a disclosure waiting for the day
 * somebody exports the table.
 */
export async function register() {
  // Nothing to do at boot. The hook below is the whole integration, and doing
  // work here would run it during the build as well.
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | undefined> },
) {
  /*
   * Imported lazily and inside the handler.
   *
   * `instrumentation.ts` is evaluated in the edge runtime as well as node, and
   * a top-level import of the database client would pull `server-only` and a
   * WebSocket pool into a runtime that has neither.
   */
  const { recordError } = await import("@/lib/observability/errors");

  await recordError({
    error,
    path: request.path,
    method: request.method,
    kind: "server",
    digest: typeof (error as { digest?: unknown })?.digest === "string"
      ? (error as { digest: string }).digest
      : null,
  });
}
