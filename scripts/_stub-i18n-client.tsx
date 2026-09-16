/**
 * A stand-in for `lib/i18n/client`, used only by `verify-sprint17.ts`.
 *
 * The real module calls `createContext` at import time. Under
 * `--conditions=react-server` that function does not exist, because React's
 * server build has no client context, and a verifier that renders a component
 * outside Next is running with exactly that condition.
 *
 * It arrived in this verifier's path through `<Money>`: sprint 76 made every
 * dollar figure reveal its pounds on demand, and the component reads the
 * reader's locale from the i18n provider rather than from the machine (C84).
 * That is right in the product and unloadable here.
 *
 * Deliberately narrow, for the reason `_stub-link.tsx` gives: one module, two
 * functions, no behaviour. The pricing checks read the TEXT a component
 * renders, and the text of a price is the dollars — which `Money` prints
 * whether or not anybody ever asks it for the pounds.
 */
import { DEFAULT_LOCALE } from "../lib/i18n/config";

/** The identity translator: a key in, the key out. No check reads a key here. */
export function useT() {
  return (key: string) => key;
}

export function useLocale() {
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
