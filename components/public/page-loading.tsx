import { RouteLogoLoader } from "@/components/brand/logo-loader";
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

  /*
    Founder, 26 September: the one branded loader, the 24T mark, in place of
    the grey blocks. The same mark the page change overlay shows, so a slow
    stream and a slow round trip look alike. See components/brand/logo-loader.tsx.
  */
  return <RouteLogoLoader label={t("common.loading")} className="mx-auto max-w-5xl" />;
}
