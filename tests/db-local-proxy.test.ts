import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { applyLocalProxy, databaseHost, isLocalDatabaseHost, type ProxyConfig } from "../lib/db/local-proxy";

/** What `neonConfig` holds by default, which production relies on. */
function defaults(): ProxyConfig {
  return { wsProxy: (host) => `${host}/v2`, useSecureWebSocket: true, pipelineTLS: false, pipelineConnect: "password" };
}

test("with DATABASE_WS_PROXY unset the driver is left exactly as it was", () => {
  for (const value of [undefined, "", "   "]) {
    const config = defaults();
    const before = config.wsProxy;
    assert.equal(applyLocalProxy(config, value), false);
    assert.equal(config.wsProxy, before);
    assert.equal(config.useSecureWebSocket, true);
    assert.equal(config.pipelineConnect, "password");
  }
});

test("with it set, a local database goes through the plain proxy", () => {
  const config = defaults();
  assert.equal(applyLocalProxy(config, "localhost:5488"), true);
  assert.equal(config.useSecureWebSocket, false);
  assert.equal(config.pipelineTLS, false);
  assert.equal(config.pipelineConnect, false);
  assert.equal(typeof config.wsProxy, "function");
  const proxy = config.wsProxy as (host: string, port: number | string) => string;
  assert.equal(proxy("localhost", 5432), "localhost:5488/v1");
  assert.equal(proxy("127.0.0.1", 5432), "localhost:5488/v1");
});

test("…and a remote host is refused rather than sent a password in the clear", () => {
  const config = defaults();
  applyLocalProxy(config, "localhost:5488");
  const proxy = config.wsProxy as (host: string, port: number | string) => string;
  assert.throws(() => proxy("ep-example-123.us-west-2.aws.neon.tech", 5432), /only for a database on this machine/);
  assert.equal(isLocalDatabaseHost("db.example.com"), false);
  assert.equal(isLocalDatabaseHost("LOCALHOST"), true);
});

test("ci:db reads the host it is about to write to", () => {
  assert.equal(databaseHost("postgres://postgres:postgres@localhost:5432/ci"), "localhost");
  assert.equal(databaseHost("postgres://u:p@ep-x-pooler.us-west-2.aws.neon.tech/db?sslmode=require"), "ep-x-pooler.us-west-2.aws.neon.tech");
  assert.equal(databaseHost(undefined), null);
  assert.equal(databaseHost("not a url"), null);
});

test("both database modules apply the seam", () => {
  for (const file of ["lib/db/index.ts", "scripts/db.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /applyLocalProxy\(neonConfig\);/, `${file} does not apply the local proxy seam`);
  }
});
