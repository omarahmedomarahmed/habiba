/**
 * The current authenticator code for DEMO_TOTP_SECRET, for signing in to the
 * console as the demo support account (DD-2 B2.3). Reads nothing else and
 * writes nothing. The secret itself is never printed.
 *
 *   npm run -s totp:now
 */
import { base32Decode, totpAt } from "../lib/auth/totp";

const secret = process.env.DEMO_TOTP_SECRET?.trim();
if (!secret) {
  console.error("DEMO_TOTP_SECRET is not set (base32, in .env.local).");
  process.exit(1);
}
console.log(totpAt(base32Decode(secret), Date.now()));
