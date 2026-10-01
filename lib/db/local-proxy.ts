/**
 * A plain Postgres behind a local WebSocket proxy, for CI and local test runs.
 *
 * The app talks to Neon over WebSockets (`@neondatabase/serverless`). A stock
 * Postgres speaks TCP, so CI runs Neon's `wsproxy` in front of it and sets
 *
 *     DATABASE_WS_PROXY=localhost:5488
 *
 * When the variable is unset nothing here changes the driver, so production
 * behaves exactly as before. When it is set, the proxy is plain `ws://`, so it
 * is only ever used for a database on this machine: a connection string naming
 * any other host fails instead of sending its password unencrypted.
 *
 * No `server-only` here: `scripts/db.ts` uses it too.
 */

/** Hosts a plaintext proxy may be used for. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres"]);

export function isLocalDatabaseHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase());
}

/** The subset of `neonConfig` this touches, so it can be tested without the driver. */
export type ProxyConfig = {
  wsProxy: string | ((host: string, port: number | string) => string);
  useSecureWebSocket: boolean;
  pipelineTLS: boolean;
  pipelineConnect: "password" | false;
};

/**
 * Points the driver at the local proxy when `DATABASE_WS_PROXY` is set.
 * Returns true when it did, false when it left the driver alone.
 */
export function applyLocalProxy(
  config: ProxyConfig,
  proxy: string | undefined = process.env.DATABASE_WS_PROXY,
): boolean {
  const address = proxy?.trim();
  if (!address) return false;

  config.wsProxy = (host: string) => {
    if (!isLocalDatabaseHost(host)) {
      throw new Error(
        `DATABASE_WS_PROXY is set, but the database host is ${host}. ` +
          "The local proxy is unencrypted and is only for a database on this machine.",
      );
    }
    return `${address}/v1`;
  };
  config.useSecureWebSocket = false;
  config.pipelineTLS = false;
  config.pipelineConnect = false;
  return true;
}
