/**
 * A stand-in for `next/link`, used only by `verify-sprint17.ts`.
 *
 * The real module builds a React context at import time and there is no
 * renderer in a verifier script. This renders the anchor and nothing else,
 * which is all the pricing checks need: they read the text and the props
 * around the link, never the routing behaviour.
 */
export default function Link({
  href,
  children,
  ...rest
}: {
  href: string;
  children?: React.ReactNode;
} & Record<string, unknown>) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
