# The hosts the video room actually talks to

The Content Security Policy has to name every host the browser may open a
connection to. For the video room, that list is **not in the package we
installed**, and writing the policy from the package is how you ship a room
that cannot connect.

- Audit it: `npm run audit:daily-hosts`
- Record it: `npm run audit:daily-hosts -- --write`
- Enforced by: `npm run verify:csp`

---

## 🔴 The package is a loader, the product is a download

`@daily-co/daily-js` in `node_modules` is about 200KB and does almost nothing.
On join it appends a `<script>` at

```
https://c.daily.co/call-machine/versioned/<version>/static/call-machine-object-bundle.js
```

which is 1.8MB, nine times the size, and is the actual client. Every host that
matters is named in there and in nothing you can read locally.

Reading only the installed package finds one host, `daily.co`. The downloaded
bundle says:

```js
getAPIBaseURL = (e) => {
  if (isProduction(e)) return "https://prod-ks.pluot.blue";
  …
}
```

`pluot.blue` is Daily's own infrastructure, from before the company was called
Daily. In production it is the **first branch**, not a fallback: it carries the
signalling API and the region lookup. A policy naming only `*.daily.co` blocks
it, and the failure is a clinician sitting in a room that never connects, with
the explanation in a console nobody has open.

---

## What the audit found

Written by `npm run audit:daily-hosts -- --write`. `verify:csp` reads this
block, so it is data rather than prose.

```audited
daily-js 0.91.0
bundle 1775KB
allow *.daily.co · the bundle, geo lookup, rooms and media
noted *.google.com · the default STUN server, which connect-src does not govern
allow *.pluot.blue · the production signalling API and region lookup
noted *.pluot.co · compared against, never fetched: an origin fallback and the staging test
allow daily.co · the SDK's default domain
allow dailywebrtc.com · an alternate room domain the SDK swaps in
allow dailywebrtc.net · an alternate room domain the SDK swaps in
noted pluot.tv · compared against in the legacy origin test, never fetched
```

---

## What is allowed, and why each one

| Host | What it is | Directive |
|---|---|---|
| `*.daily.co` | the bundle, geo lookup, media, rooms | `script-src` via `strict-dynamic`, `connect-src`, `media-src`, `frame-src` |
| `*.pluot.blue` | the production signalling API and region lookup | `connect-src`, https and wss |
| `*.dailywebrtc.com` | alternate room domain the SDK swaps in | `connect-src`, https and wss |
| `*.dailywebrtc.net` | alternate room domain the SDK swaps in | `connect-src`, https and wss |

The last three are Daily's own list, and `verify:csp` lifts it straight out of
the installed package rather than trusting this table. An upgrade that adds a
fourth domain goes red.

None of this widens the threat model. `*.daily.co` already serves a **script**
into this origin under `strict-dynamic`. A host that may additionally open a
socket is strictly less trusted than one that may already run code.

---

## What is blocked on purpose

**Daily's Sentry**, `o77906.ingest.sentry.io`. The SDK reports its own errors
to a Sentry instance we do not control, with whatever context it chooses to
attach. The transport is a `fetch` whose rejection the SDK swallows, so the
policy costs a console line and nothing else. Consultation data does not leave
this origin to buy somebody else a stack trace.

**WebAssembly**. `script-src` has no `'wasm-unsafe-eval'`. The only wasm in the
bundle is Banuba, the background-blur and virtual-background engine, which this
product does not enable. If background effects or Daily's noise cancellation
are ever turned on, `script-src` needs `'wasm-unsafe-eval'`, and that is the
whole reason this paragraph exists, because the symptom is a feature that
silently does nothing.

**STUN and TURN** are not listed anywhere. ICE servers are not governed by
`connect-src`; a browser that gates them at all does it with the `webrtc`
directive, which this policy does not set. `stun:stun.l.google.com:19302`
appears in the bundle as a default and is unaffected either way.

---

## What does NOT need naming, and why people think it does

The bundle creates blob workers, calls `importScripts`, and loads an
`AudioWorklet` from a blob URL. None of that needs a host in `script-src`,
because under `strict-dynamic` a request that was not inserted by the HTML
parser is allowed outright. That is the same rule that lets the SDK append its
own `<script>` in the first place.

`worker-src 'self' blob:` is still set, because `strict-dynamic` lives in
`script-src` and worker creation is checked against `worker-src`.

---

## After a version bump

`verify:csp` compares the installed `@daily-co/daily-js` version against the
`daily-js` line in the audited block above, and fails when they differ. The fix
is one command:

```bash
npm run audit:daily-hosts -- --write
```

then read the diff. A new host in the block that is not in the table above is a
policy decision, not a formality.
