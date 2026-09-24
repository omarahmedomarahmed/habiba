import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 A18: WHAT THE CONSOLE SHOWS WHILE A PAGE IS STILL ASKING THE DATABASE.
 *
 * Every admin page is `force-dynamic` and several run a dozen queries before
 * they render. With no boundary the click on a nav link
 * did nothing visible until all of them came back, which on a queue worked by
 * the minute reads as a dead button and gets pressed again.
 *
 * Inside `(admin)/layout.tsx`, so the nav stays put and only the page area is
 * stood in for. A title bar and three cards, the shape most console pages
 * have, in grey: light enough to be replaced without a jump. Its one word is
 * for a screen reader and is the word every portal already says.
 */
export default async function AdminLoading() {
  const { t } = await getI18n();
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">{t("common.loading")}</span>
      <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
      ))}
    </div>
  );
}
