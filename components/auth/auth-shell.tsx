import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { doors, otherWay, type DoorKey } from "@/lib/auth/doors";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * Every door into the product, in the product's own clothes. Task 154.
 *
 * ## What this replaces
 *
 * Six sign in pages, in five route groups, each a centred card on an empty
 * slate ground with the word "24Therapy" set as text in the corner. A person
 * deciding whether to hand us a therapy record was shown, at the exact moment
 * of deciding, a page that looked like it belonged to a different and much
 * smaller product than the one they had just been reading about.
 *
 * So: the real site header, the real site footer, and between them two columns.
 *
 * ## The switcher
 *
 * The left column opens with the four doors. This is the second half of the
 * header's sign in menu and exists for the same reason: a person who followed
 * "Sign in" while thinking of themselves as "the person who books the sessions
 * for our staff" needs to find out, on this page, that they want the company
 * portal. Before this there was nothing on any auth page pointing at any other
 * auth page, so the only way out of the wrong door was the back button.
 *
 * ## The right column is not decoration
 *
 * It says what is behind the door, in three concrete lines, over the navy
 * ground the brand reserves for reversed type. An empty half is what made the
 * old pages feel unfinished; a half filled with a stock photograph would be
 * worse. The lines are about this account and nothing else.
 *
 * At `md` and below the right column moves under the form rather than beside
 * it, because on a phone the form is the only thing that matters.
 */

export type AuthKind = "signin" | "signup";

export async function AuthShell({
  who,
  kind,
  title,
  subtitle,
  promise,
  points,
  children,
  belowForm,
}: {
  /** Which of the four doors this page is. */
  who: DoorKey;
  kind: AuthKind;
  title: string;
  /** One line under the heading, saying what happens when the form is sent. */
  subtitle?: string;
  /** The right column's heading: what this account is, in the reader's words. */
  promise: string;
  /** Three concrete things this account gets. Not adjectives. */
  points: string[];
  children: React.ReactNode;
  /** Anything the page needs under the form, such as a forgotten password link. */
  belowForm?: React.ReactNode;
}) {
  const { t } = await getI18n();
  const here = doors(t, kind);
  const flip = otherWay(who, kind, t);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />

      <main className="flex-1 bg-slate-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10 lg:py-16">
          <div className="min-w-0">
            {/*
              The four doors, as a switcher rather than a paragraph of links.
              The current one is marked and is not a link to itself, because a
              tab that navigates to the page you are on reads as a dead control.
            */}
            <nav aria-label={t("nav.whichAreYou")} className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("nav.whichAreYou")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {here.map((door) =>
                  door.key === who ? (
                    <span
                      key={door.key}
                      aria-current="page"
                      className="rounded-xl bg-navy-500 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {door.label}
                    </span>
                  ) : (
                    <Link
                      key={door.key}
                      href={door.href}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-navy-500"
                    >
                      {door.label}
                    </Link>
                  ),
                )}
              </div>
            </nav>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight text-navy-500">{title}</h1>
              {subtitle ? (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{subtitle}</p>
              ) : null}

              <div className="mt-6">{children}</div>

              {belowForm ? <div className="mt-5">{belowForm}</div> : null}

              {/*
                The way to the other kind of page, for the SAME user type. A
                clinician who cannot sign in wants the clinician signup, not a
                generic one, and before this the only link off a sign in page
                went to a different principal's login entirely.
              */}
              <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">
                {kind === "signin" ? t("nav.noAccount") : t("nav.haveAccount")}{" "}
                <Link href={flip.href} className="font-semibold text-brand-600 hover:text-brand-700">
                  {kind === "signin" ? t("nav.createOne") : t("nav.signIn")}
                </Link>
              </p>
            </div>
          </div>

          <aside className="min-w-0">
            <div className="rounded-3xl bg-navy-500 p-6 text-white sm:p-7">
              <Logo ink="white" height={22} />
              <p className="mt-5 text-lg font-bold leading-snug">{promise}</p>
              <ul className="mt-5 flex flex-col gap-3.5">
                {points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-relaxed text-white/85">
                    {/*
                      Teal on navy, which is one of the two grounds the brand
                      allows it on. It reads 2.19:1 on white, so this mark can
                      never be lifted onto the light column opposite.
                    */}
                    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
                      <path
                        d="M3 8.5l3.2 3.2L13 5"
                        fill="none"
                        stroke="#2EC4B6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500">
              {t("nav.notYou")}{" "}
              {here
                .filter((door) => door.key !== who)
                .map((door, index, list) => (
                  <span key={door.key}>
                    <Link href={door.href} className="font-medium text-slate-700 hover:text-navy-500">
                      {door.label}
                    </Link>
                    {index < list.length - 1 ? " · " : ""}
                  </span>
                ))}
            </p>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * The same chrome for the two doors nobody self serves: staff and partners.
 *
 * No switcher, because offering a marketing visitor a staff login is how a
 * product acquires a back door. The site header and footer stay, because the
 * alternative is the blank page this whole task exists to remove.
 */
export async function QuietAuthShell({
  title,
  subtitle,
  children,
  className,
}: {
  /**
   * Omit it when the form supplies its own heading, which the staff form does:
   * its heading carries the pointer to /login that its copy depends on. An
   * empty string here would render an empty `h1`, which reads to a screen
   * reader as a page with no name.
   */
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <div className={cn("mx-auto max-w-md px-4 py-12 sm:px-6 lg:py-20", className)}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-bold tracking-tight text-navy-500">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
