import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * 🔴 C16 — A PARTNER'S WEBHOOK URL IS A REQUEST WE MAKE FROM INSIDE.
 *
 * "https://" was the whole check, so `https://169.254.169.254/` or a name that
 * resolves to 10.0.0.5 had our server knock on its own network and record the
 * status for the partner to read. Checked twice: the address as typed when it is
 * saved, and every address the name resolves to when it is sent, because a name
 * that was public on Monday can point inside on Tuesday.
 */

const BLOCKED_V4: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 carrier NAT
  [0x7f000000, 8], // loopback
  [0xa9fe0000, 16], // link local, cloud metadata
  [0xac100000, 12], // 172.16/12
  [0xc0000000, 24], // 192.0.0/24
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15 benchmarking
  [0xe0000000, 3], // multicast and reserved
];

function v4Blocked(address: string): boolean {
  const n = address.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
  return BLOCKED_V4.some(([base, bits]) => (n & (bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0)) >>> 0 === base);
}

function v6Blocked(address: string): boolean {
  const a = address.toLowerCase();
  if (a === "::" || a === "::1") return true;
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Blocked(mapped[1]!);
  /* `new URL` writes a mapped address in hex, ::ffff:a00:1 for 10.0.0.1. */
  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    return v4Blocked(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^(fc|fd|fe[89ab]|ff)/.test(a);
}

/** True when this literal address is one our server must not call. */
export function addressBlocked(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return v4Blocked(address);
  if (kind === 6) return v6Blocked(address);
  return true;
}

/** The shape check, with no network: for the moment an endpoint is saved. */
export function publicHttpsProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That is not a web address.";
  }
  if (url.protocol !== "https:") return "The endpoint has to be https.";
  if (url.username || url.password) return "Put no username or password in the address.";
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) return addressBlocked(host) ? "That address is not on the public internet." : null;
  if (host === "localhost" || !host.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/.test(host)) {
    return "That address is not on the public internet.";
  }
  return null;
}

/**
 * The name lookup, as a seam a verifier can stand a resolver in for: its
 * fixture hosts are `example.com` names that resolve nowhere.
 */
export const resolver = {
  lookup: (host: string) => lookup(host, { all: true, verbatim: true }),
};

/** The send-time check: every address the name resolves to must be public. */
export async function resolvesPublic(raw: string): Promise<boolean> {
  if (publicHttpsProblem(raw)) return false;
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !addressBlocked(host);
  try {
    const found = await resolver.lookup(host);
    return found.length > 0 && found.every((entry) => !addressBlocked(entry.address));
  } catch {
    return false;
  }
}
