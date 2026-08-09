import Link from "next/link";

import { Button } from "@/components/ui";
import { getFooterLinks, getPublicNav } from "@/lib/content/service";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [nav, footer] = await Promise.all([getPublicNav(), getFooterLinks()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-[15px] font-bold tracking-tight text-navy-500">
            24Therapy
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-navy-500">24Therapy</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                Clinical documentation for therapists. Your notes, written while you work.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
              {nav.concat(footer).map((item) => (
                <Link
                  key={item.slug}
                  href={`/${item.slug}`}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <p className="mt-8 text-xs text-slate-400">
            © {new Date().getFullYear()} 24Therapy. Not a substitute for clinical judgement.
          </p>
        </div>
      </footer>
    </div>
  );
}
