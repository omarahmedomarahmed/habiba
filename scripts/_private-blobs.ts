/**
 * What `migrate-private-blobs.ts` moves, kept apart from it because that script
 * runs when imported (verify:traps T6): a test reads the rule from here.
 *
 * A sensitive file is any blob on the PUBLIC store that is not a headshot,
 * which is the one kind meant to be public.
 */
const PUBLIC_KINDS = ["headshot/"];

export function isPublicSensitiveBlob(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
    const path = parsed.pathname.replace(/^\//, "");
    return !PUBLIC_KINDS.some((kind) => path.startsWith(kind));
  } catch {
    return false;
  }
}
