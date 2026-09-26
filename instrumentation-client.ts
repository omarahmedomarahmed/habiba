import { startNavProgress } from "@/lib/nav-progress";

/**
 * Next calls this on the click itself, before a single byte of the next page
 * has been asked for: every `<Link>`, every `router.push` and `router.replace`,
 * and the back and forward buttons. It is the one place that sees all of them,
 * which is why the page change indicator listens here rather than to clicks.
 *
 * It must stay tiny and must never throw: it runs inside the router's own
 * navigation, so an error here would be an error in every link in the product.
 */
export function onRouterTransitionStart(url: string): void {
  try {
    startNavProgress({ href: url });
  } catch {
    // An indicator that fails is an indicator that does not show. Never a broken link.
  }
}
