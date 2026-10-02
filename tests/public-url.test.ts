import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import * as net from "../lib/net/public-url";

/* DD-2 B2.6: the webhook connects to the address that was checked, not to a second lookup. */

test("every resolved address must be public, and the first is the one pinned", async () => {
  const real = net.resolver.lookup;
  try {
    net.resolver.lookup = async () => [
      { address: "93.184.215.14", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ];
    assert.equal(await net.resolvePublicAddress("https://mixed.example.com/hook"), null);

    net.resolver.lookup = async () => [
      { address: "93.184.215.14", family: 4 },
      { address: "2606:2800:21f:cb07:6820:80da:af6b:8b2c", family: 6 },
    ];
    assert.deepEqual(await net.resolvePublicAddress("https://ok.example.com/hook"), { address: "93.184.215.14", family: 4 });

    net.resolver.lookup = async () => [];
    assert.equal(await net.resolvePublicAddress("https://nothing.example.com/hook"), null);
  } finally {
    net.resolver.lookup = real;
  }
  assert.equal(await net.resolvePublicAddress("https://169.254.169.254/latest"), null);
  assert.equal(await net.resolvePublicAddress("http://93.184.215.14/"), null, "https only");
  assert.deepEqual(await net.resolvePublicAddress("https://93.184.215.14/"), { address: "93.184.215.14", family: 4 });
});

test("the pinned lookup answers with the checked address in both shapes net.connect asks for", () => {
  const lookup = net.pinnedLookup({ address: "93.184.215.14", family: 4 });
  lookup("anything.example.com", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: "93.184.215.14", family: 4 }]);
  });
  lookup("anything.example.com", {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, "93.184.215.14");
    assert.equal(family, 4);
  });
});

test("a pinned dispatcher connects to the pinned address whatever the name would resolve to", async () => {
  const server = http.createServer((request, response) => response.end(`reached ${request.headers.host}`));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const dispatcher = net.pinnedDispatcher({ address: "127.0.0.1", family: 4 });
  try {
    /* `.invalid` never resolves, so reaching the server proves no second lookup happened. */
    const response = await fetch(`http://rebind.example.invalid:${port}/`, { dispatcher } as RequestInit);
    assert.equal(await response.text(), `reached rebind.example.invalid:${port}`);
  } finally {
    await dispatcher.close();
    server.close();
  }
});
