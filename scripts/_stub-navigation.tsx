/**
 * 🔴 76.23 — `next/navigation`, OUTSIDE NEXT, FOR PHOTOGRAPHS ONLY.
 *
 * `useRouter` throws "invariant expected app router to be mounted" when there
 * is no app router, which there never is in a script. `PayByTransfer` calls it
 * to refresh a waiting payment every fifteen seconds, and `PatientBottomNav`
 * calls it to push a route after somebody answers "leave anyway".
 *
 * ## 🔴 WHY THIS IS NOT IN `_render.ts` WITH THE OTHER TWO
 *
 * That module stubs exactly two ids and says why: *"a broad mock would let a
 * real failure be answered by a stub."* `next/link` and `server-only` are
 * import-time guards with no behaviour to lose. A router is different: it has
 * real behaviour, and a verifier that silently got a fake one could assert that
 * navigation happened when nothing navigated.
 *
 * So this lives beside the capture script that photographs components and is
 * installed by that script alone. A frame is a picture of a first paint, and a
 * first paint never routes.
 *
 * Every method is a no-op rather than a spy for the same reason: there is
 * nothing here for a check to read, so nothing here can be mistaken for
 * evidence.
 */
const router = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  forward: () => undefined,
  prefetch: () => undefined,
  refresh: () => undefined,
};

export function useRouter() {
  return router;
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect(): never {
  throw new Error("redirect() is not available in a capture render");
}

export function notFound(): never {
  throw new Error("notFound() is not available in a capture render");
}
