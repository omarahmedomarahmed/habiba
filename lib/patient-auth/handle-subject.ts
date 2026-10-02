import { accountSubject } from "@/lib/auth/attempts";
import { toE164 } from "@/lib/phone/e164";

/**
 * DD-2 B2.2: what a per-account limit counts against when the handle matched
 * no account. The same spelling `findAccount` would have looked up, so "the
 * same handle typed twice" is one bucket whatever the formatting.
 */
export function handleSubject(handle: string, country: string | null): string {
  if (handle.includes("@")) return accountSubject(handle);
  const phone = toE164(handle, country);
  return phone.ok ? phone.e164 : accountSubject(handle);
}
