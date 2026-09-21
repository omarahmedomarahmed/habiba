/**
 * 🔴 A pass-through, deliberately. Task 154.
 *
 * This used to be the auth chrome: a slate ground, a text wordmark in the
 * corner, and a 24rem column centred in the viewport. Every page under it
 * inherited a screen that looked like a different and much smaller product
 * than the marketing site the reader had just come from.
 *
 * The chrome is `components/auth/auth-shell.tsx` now, and each page renders it
 * with its own heading and its own three lines about what the account is. A
 * layout cannot do that: it does not know whether the page under it is the
 * clinician's sign in, the clinician's signup or a password reset, and those
 * three want three different right hand columns.
 *
 * The language switch went with it. It is in the site header the shell renders,
 * which is the same corner of the same header as on every other page, rather
 * than a second switch floating over the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
