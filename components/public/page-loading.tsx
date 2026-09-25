import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 0165: WHAT THE PUBLIC SITE SHOWS WHILE A PAGE IS FETCHED.
 *
 * The radar and the clinician profiles read the database before they render,
 * and a tap that leaves the old page frozen reads as a dead link. Inside the
 * site's own `<main>`, so the header and footer stay put and this is a `div`
 * rather than a second `main`. Its one word is for a screen reader.
 *
 * 🔴 B35: AND IT IS MOUNTED ON THOSE TWO ROUTES, NOT ON THE WHOLE SITE. As
 * `app/(public)/loading.tsx` it put a Suspense boundary above every public
 * page, so the response had started streaming, with its 200, before any page
 * could call `notFound()`. Every missing page on the site answered 200 with
 * the "We could not find that page" body. `radar/loading.tsx` and
 * `t/[id]/loading.tsx` use it now, and a profile that does not exist is
 * refused in `t/[id]/layout.tsx`, which sits above that route's boundary.
 */
export async function PageLoading() {
  const { t } = await getI18n();

  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden className="animate-pulse space-y-4">
        <div className="h-10 w-2/3 max-w-md rounded-2xl bg-navy-100" />
        <div className="h-4 w-full max-w-xl rounded-full bg-navy-50" />
        <div className="h-32 rounded-[28px] bg-navy-50" />
        <div className="h-32 rounded-[28px] bg-navy-50" />
      </div>
    </div>
  );
}
